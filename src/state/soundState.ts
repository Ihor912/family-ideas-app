import { createContext, useContext } from 'react';
import type { SoundEffect } from '../services/audio';

export const SOUND_STORAGE_KEY = 'family-orbit:sound';

export type SoundContextValue = {
  soundEnabled: boolean;
  toggleSound: () => void;
  prepareAudio: () => void;
  play: (effect: SoundEffect) => void;
  stopSounds: () => void;
};

export const SoundContext = createContext<SoundContextValue | null>(null);

export function readSoundPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useSound(): SoundContextValue {
  const value = useContext(SoundContext);
  if (!value) throw new Error('useSound must be called inside SoundProvider.');
  return value;
}
