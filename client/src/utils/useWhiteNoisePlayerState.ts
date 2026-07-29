import { useEffect, useState } from 'react';
import type { TNoiseType } from './whiteNoise';
import { whiteNoisePlayer } from './whiteNoise';

export type TWhiteNoisePlayerState = {
  playingType: TNoiseType | null;
  endAt: number | null;
  activeDuration: number | null;
};

const readState = (): TWhiteNoisePlayerState => ({
  playingType: whiteNoisePlayer.getPlayingType(),
  endAt: whiteNoisePlayer.getEndAt(),
  activeDuration: whiteNoisePlayer.getActiveDurationMinutes(),
});

/** Subscribes to the shared `whiteNoisePlayer` singleton and re-renders whenever playback
 * starts/stops/changes — used by both `/white-noise` and the HomePage white-noise widget so
 * their controls always reflect the same live playback state. Also ticks once per second
 * while a timed duration is active, so any countdown display derived from `endAt` stays live. */
export const useWhiteNoisePlayerState = (): TWhiteNoisePlayerState => {
  const [state, setState] = useState<TWhiteNoisePlayerState>(readState);

  useEffect(() => whiteNoisePlayer.subscribe(() => setState(readState())), []);

  useEffect(() => {
    if (state.endAt === null) return;
    const id = setInterval(() => setState(readState()), 1000);
    return () => clearInterval(id);
  }, [state.endAt]);

  return state;
};

