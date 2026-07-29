/**
 * Client-side white noise / fan noise / wave (rising & falling) noise generator using the Web Audio API.
 * No audio files are used — noise buffers are synthesized on the fly and looped.
 */

export type TNoiseType = 'white' | 'fan' | 'wave';

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

const BUFFER_GENERATORS: Record<TNoiseType, (ctx: AudioContext) => AudioBuffer> = {
  white: generateWhiteNoiseBuffer,
  fan: generateFanNoiseBuffer,
  wave: generateWaveNoiseBuffer,
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
