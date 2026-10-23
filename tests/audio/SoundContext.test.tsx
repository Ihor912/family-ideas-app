import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../../src/services/audio';
import { SoundProvider } from '../../src/state/SoundContext';
import { readSoundPreference, SOUND_STORAGE_KEY, useSound } from '../../src/state/soundState';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(audioEngine, 'prepare').mockImplementation(() => undefined);
  vi.spyOn(audioEngine, 'play').mockImplementation(() => undefined);
  vi.spyOn(audioEngine, 'stop').mockImplementation(() => undefined);
  vi.spyOn(audioEngine, 'dispose').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('SoundProvider', () => {
  it('starts muted, persists a gesture-based preference, and stops sound on mute', () => {
    const { result } = renderHook(useSound, { wrapper: SoundProvider });
    expect(result.current.soundEnabled).toBe(false);
    act(() => { result.current.prepareAudio(); result.current.play('plink'); });
    expect(audioEngine.prepare).not.toHaveBeenCalled();
    expect(audioEngine.play).not.toHaveBeenCalled();
    act(() => result.current.toggleSound());
    expect(audioEngine.prepare).toHaveBeenCalledTimes(1);
    expect(audioEngine.play).toHaveBeenCalledExactlyOnceWith('plink');
    expect(vi.mocked(audioEngine.prepare).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(audioEngine.play).mock.invocationCallOrder[0]);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('true');
    act(() => result.current.play('plink'));
    expect(audioEngine.play).toHaveBeenCalledWith('plink');
    act(() => result.current.toggleSound());
    expect(audioEngine.dispose).toHaveBeenCalledTimes(1);
    expect(audioEngine.play).toHaveBeenCalledTimes(2);
    act(() => result.current.play('chime'));
    expect(audioEngine.play).not.toHaveBeenCalledWith('chime');
  });

  it('restores the preference without creating audio or playing on page load', () => {
    localStorage.setItem(SOUND_STORAGE_KEY, 'true');
    const { result } = renderHook(useSound, { wrapper: SoundProvider });
    expect(result.current.soundEnabled).toBe(true);
    expect(audioEngine.prepare).not.toHaveBeenCalled();
    expect(audioEngine.play).not.toHaveBeenCalled();
  });

  it('disposes on explicit mute so re-enabling can recover a stuck iPhone audio context', () => {
    const { result } = renderHook(useSound, { wrapper: SoundProvider });
    act(() => result.current.toggleSound());
    act(() => result.current.toggleSound());
    act(() => result.current.toggleSound());
    expect(audioEngine.dispose).toHaveBeenCalledTimes(1);
    expect(audioEngine.prepare).toHaveBeenCalledTimes(2);
    expect(audioEngine.play).toHaveBeenCalledTimes(2);
    expect(vi.mocked(audioEngine.prepare).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(audioEngine.dispose).mock.invocationCallOrder[0]);
    expect(vi.mocked(audioEngine.dispose).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(audioEngine.prepare).mock.invocationCallOrder[1]);
    expect(result.current.soundEnabled).toBe(true);
  });

  it('continues to work when persistent browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readSoundPreference()).toBe(false);
    const { result } = renderHook(useSound, { wrapper: SoundProvider });
    act(() => result.current.toggleSound());
    expect(result.current.soundEnabled).toBe(true);
  });
});
