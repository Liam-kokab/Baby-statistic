/**
 * Client-side white noise / fan noise / wave (rising & falling) / mother's hush noise generator
 * using the Web Audio API. No audio files are used — noise buffers are synthesized on the fly and looped.
 */

export type TNoiseType = 'white' | 'fan' | 'wave' | 'hush';

type TListener = () => void;

const BUFFER_SECONDS = 5;

/** Generates BUFFER_SECONDS worth of white noise samples in [-1, 1]. */
const generateWhiteNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
  const length = Math.floor(ctx.sampleRate * BUFFER_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  data.set(Float32Array.from({ length }, () => Math.random() * 2 - 1));
  return buffer;
};

/**
 * Fan noise: white noise smoothed through two one-pole low-pass stages for a deep, steady
 * "whoosh", plus a faint 120Hz motor hum. 120Hz * BUFFER_SECONDS is an integer number of
 * cycles, so the hum loops seamlessly with no click at the buffer boundary.
 */
const generateFanNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
  const length = Math.floor(ctx.sampleRate * BUFFER_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const white = Float32Array.from({ length }, () => Math.random() * 2 - 1);

  const stage1 = new Float32Array(length);
  white.reduce((lastOut, w, i): number => {
    const next = (lastOut + 0.02 * w) / 1.02;
    stage1[i] = next;
    return next;
  }, 0);

  stage1.reduce((lastOut, s, i): number => {
    const next = lastOut + 0.15 * (s - lastOut);
    data[i] = next;
    return next;
  }, 0);

  const humFreq = 120;
  data.forEach((sample, i) => {
    data[i] = sample * 4 + Math.sin((2 * Math.PI * humFreq * i) / ctx.sampleRate) * 0.03;
  });

  return buffer;
};

/**
 * Wave noise: a soft filtered-noise carrier with a slow amplitude swell (rises & falls like
 * ocean waves). The swell is exactly one cycle per buffer, so it loops seamlessly.
 */
const generateWaveNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
  const length = Math.floor(ctx.sampleRate * BUFFER_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const white = Float32Array.from({ length }, () => Math.random() * 2 - 1);

  const carrier = new Float32Array(length);
  white.reduce((lastOut, w, i): number => {
    const next = lastOut + 0.05 * (w - lastOut);
    carrier[i] = next;
    return next;
  }, 0);

  const swellHz = 1 / BUFFER_SECONDS;
  carrier.forEach((sample, i) => {
    const swell = 0.55 + 0.45 * Math.sin((2 * Math.PI * swellHz * i) / ctx.sampleRate - Math.PI / 2);
    data[i] = sample * 6 * swell;
  });

  return buffer;
};

/** Length of one Mother's Hush pulse cycle, in seconds (silence → rise → hold → fall → silence). */
const HUSH_CYCLE_SECONDS = 4;

/**
 * Mother's hush: band-limited "sh" noise (~1.2kHz–6kHz — cutting both the low rumble and the
 * ultra-high hiss that made earlier versions sound like radio static) so it reads as a breathy
 * human "shhh" rather than broadband noise, shaped by a repeating 4-second envelope like a
 * caregiver repeating "shhh": 500ms silence → 1250ms ease-in rise → 500ms at max → 1250ms
 * ease-out fall → 500ms silence. The rise/fall use a smootherstep curve (not linear) so the
 * volume change accelerates out of silence and decelerates into the hold/silence, avoiding
 * an abrupt/mechanical ramp.
 */
const generateHushNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
  const length = Math.floor(ctx.sampleRate * HUSH_CYCLE_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const white = Float32Array.from({ length }, () => Math.random() * 2 - 1);

  const sr = ctx.sampleRate;
  // -3dB cutoff coefficient for a one-pole IIR low-pass at frequency fc.
  const lowpassAlpha = (fc: number): number => 1 - Math.exp((-2 * Math.PI * fc) / sr);
  const alphaLowCut = lowpassAlpha(1200);  // rumble removed below this
  const alphaHighCut = lowpassAlpha(6000); // harsh top-end hiss removed above this

  // Low-passed component of the raw noise — subtracted below to form a highpass at ~1.2kHz.
  const rumble = new Float32Array(length);
  white.reduce((lastOut, w, i): number => {
    const next = lastOut + alphaLowCut * (w - lastOut);
    rumble[i] = next;
    return next;
  }, 0);

  const smootherstep = (x: number): number => x * x * x * (x * (x * 6 - 15) + 10);

  const envelopeAt = (t: number): number => {
    if (t < 0.5) return 0;
    if (t < 1.75) return smootherstep((t - 0.5) / 1.25);
    if (t < 2.25) return 1;
    if (t < 3.5) return 1 - smootherstep((t - 2.25) / 1.25);
    return 0;
  };

  // Second pass: low-pass the highpassed signal at ~6kHz to band-limit it, then apply the envelope.
  let topOut = 0;
  white.forEach((w, i) => {
    const highpassed = w - rumble[i];
    topOut = topOut + alphaHighCut * (highpassed - topOut);
    const t = i / sr;
    data[i] = topOut * 7 * envelopeAt(t);
  });

  return buffer;
};

const BUFFER_GENERATORS: Record<TNoiseType, (ctx: AudioContext) => AudioBuffer> = {
  white: generateWhiteNoiseBuffer,
  fan: generateFanNoiseBuffer,
  wave: generateWaveNoiseBuffer,
  hush: generateHushNoiseBuffer,
};

class WhiteNoisePlayer {
  private audioContext: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private buffers = new Map<TNoiseType, AudioBuffer>();
  private playingType: TNoiseType | null = null;
  private endAt: number | null = null;
  /** Requested duration for the current playback — null means infinite. Only meaningful while playingType !== null. */
  private activeDurationMinutes: number | null = null;
  private listeners = new Set<TListener>();

  private notify = (): void => {
    this.listeners.forEach((listener) => listener());
  };

  subscribe = (listener: TListener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getPlayingType = (): TNoiseType | null => this.playingType;

  getEndAt = (): number | null => this.endAt;

  getActiveDurationMinutes = (): number | null => this.activeDurationMinutes;

  private getContext = (): AudioContext => {
    if (!this.audioContext) this.audioContext = new AudioContext();
    return this.audioContext;
  };

  private getBuffer = (type: TNoiseType): AudioBuffer => {
    const cached = this.buffers.get(type);
    if (cached) return cached;
    const buffer = BUFFER_GENERATORS[type](this.getContext());
    this.buffers.set(type, buffer);
    return buffer;
  };

  private stopInternal = (): void => {
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // already stopped
      }
      this.source.disconnect();
      this.source = null;
    }
    if (this.gain) {
      this.gain.disconnect();
      this.gain = null;
    }
  };

  /** Starts looping the given noise type. durationMinutes = null means play forever. */
  play = (type: TNoiseType, durationMinutes: number | null): void => {
    this.stopInternal();
    const ctx = this.getContext();
    if (ctx.state === 'suspended') void ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = this.getBuffer(type);
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = 1;

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.source = source;
    this.gain = gain;
    this.playingType = type;
    this.activeDurationMinutes = durationMinutes;
    this.endAt = durationMinutes !== null ? Date.now() + durationMinutes * 60_000 : null;

    if (durationMinutes !== null) {
      this.stopTimer = setTimeout(this.stop, durationMinutes * 60_000);
    }

    this.notify();
  };

  stop = (): void => {
    this.stopInternal();
    this.playingType = null;
    this.endAt = null;
    this.activeDurationMinutes = null;
    this.notify();
  };
}

export const whiteNoisePlayer = new WhiteNoisePlayer();

// In dev, Vite hot-reloads this module whenever it's edited, which would otherwise create a
// brand-new `whiteNoisePlayer` instance while any sound started by the old instance keeps
// looping with nothing left able to stop it. Stop playback before the module is replaced.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    whiteNoisePlayer.stop();
  });
}


