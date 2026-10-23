import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { audioEngine, type SoundEffect } from '../services/audio';
import { readSoundPreference, SOUND_STORAGE_KEY, SoundContext } from './soundState';

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(readSoundPreference);
  const enabledRef = useRef(soundEnabled);

  const toggleSound = useCallback(() => {
    const enabled = !enabledRef.current;
    enabledRef.current = enabled;
    if (enabled) {
      audioEngine.prepare();
      audioEngine.play('plink');
    }
    // A fresh context on the next enable also recovers iOS audio devices that
    // remain silent after an interruption even while reporting "running".
    else audioEngine.dispose();
    setSoundEnabled(enabled);
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
    } catch {
      // The setting still works for this tab when persistent storage is blocked.
    }
  }, []);

  const prepareAudio = useCallback(() => {
    if (enabledRef.current) audioEngine.prepare();
  }, []);

  const play = useCallback((effect: SoundEffect) => {
    if (enabledRef.current) audioEngine.play(effect);
  }, []);

  const stopSounds = useCallback(() => audioEngine.stop(), []);

  useEffect(() => () => audioEngine.dispose(), []);

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound, prepareAudio, play, stopSounds }}>
      {children}
    </SoundContext.Provider>
  );
}
