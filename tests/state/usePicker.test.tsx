import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DrawResult } from '../../src/domain/types';
import { audioEngine } from '../../src/services/audio';
import type { AppServices } from '../../src/services/types';
import { AuthProvider } from '../../src/state/AuthContext';
import { SoundProvider } from '../../src/state/SoundContext';
import { SOUND_STORAGE_KEY } from '../../src/state/soundState';
import { usePicker } from '../../src/state/usePicker';

vi.mock('../../src/services/firebase', () => ({ firebaseServices: { configured: false } }));

const idea = { id: 'example', categoryId: 'example-category', markdown: 'Вигадайте космічний танок.' };
const catalog = { ideas: [idea], categories: [{ id: idea.categoryId, name: 'Вигадки', count: 1 }] };
const result: DrawResult = { kind: 'drawn', idea, catalog, state: { seenIds: [idea.id], lastIdeaId: idea.id }, drawId: 'draw-1' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

function setup(drawIdea: AppServices['drawIdea']) {
  const services: AppServices = {
    configured: true,
    subscribeAuth(next) { next({ uid: 'adult', displayName: null, email: null, photoURL: null }); return () => undefined; },
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    subscribeFamily: () => () => undefined,
    drawIdea,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode><AuthProvider services={services}><SoundProvider>{children}</SoundProvider></AuthProvider></StrictMode>
  );
  return renderHook(({ uid }: { uid: string | null }) => usePicker(uid), { initialProps: { uid: 'adult' as string | null }, wrapper });
}

beforeEach(() => {
  localStorage.setItem(SOUND_STORAGE_KEY, 'true');
  vi.spyOn(audioEngine, 'prepare').mockImplementation(() => undefined);
  vi.spyOn(audioEngine, 'play').mockImplementation(() => undefined);
  vi.spyOn(audioEngine, 'stop').mockImplementation(() => undefined);
  vi.spyOn(audioEngine, 'dispose').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('usePicker', () => {
  it('blocks rapid taps through commit and reveal and plays one success sound in Strict Mode', async () => {
    const selection = deferred<DrawResult>();
    const drawIdea = vi.fn(() => selection.promise);
    const { result: hook } = setup(drawIdea);
    act(() => { void hook.current.draw('all'); void hook.current.draw('all'); });
    expect(drawIdea).toHaveBeenCalledTimes(1);
    expect(hook.current.phase).toBe('drawing');
    expect(audioEngine.prepare).toHaveBeenCalledTimes(1);
    await act(async () => selection.resolve(result));
    expect(hook.current.phase).toBe('revealing');
    act(() => { void hook.current.draw('all'); });
    expect(drawIdea).toHaveBeenCalledTimes(1);
    expect(vi.mocked(audioEngine.play).mock.calls.filter(([effect]) => effect === 'chime')).toHaveLength(1);
    act(() => hook.current.finishReveal());
    expect(hook.current.phase).toBe('result');
    act(() => { void hook.current.draw('all'); });
    expect(drawIdea).toHaveBeenCalledTimes(2);
    await act(async () => undefined);
  });

  it('drops a late selection after sign-out and clears private content', async () => {
    const selection = deferred<DrawResult>();
    const { result: hook, rerender } = setup(() => selection.promise);
    act(() => { void hook.current.draw('all'); });
    rerender({ uid: null });
    await act(async () => selection.resolve(result));
    expect(hook.current.phase).toBe('idle');
    expect(hook.current.idea).toBeNull();
    expect(audioEngine.play).not.toHaveBeenCalledWith('chime');
  });

  it('retains the preceding card on failure and releases the request lock', async () => {
    const drawIdea = vi.fn<AppServices['drawIdea']>()
      .mockResolvedValueOnce(result)
      .mockRejectedValueOnce({ code: 'unavailable' })
      .mockResolvedValueOnce({ kind: 'exhausted', catalog });
    const { result: hook } = setup(drawIdea);
    await act(async () => hook.current.draw('all'));
    act(() => hook.current.finishReveal());
    await act(async () => hook.current.draw('all'));
    expect(hook.current).toMatchObject({ phase: 'error', idea, busy: false });
    expect(hook.current.error).toContain('інтернет');
    await act(async () => hook.current.draw('all'));
    expect(hook.current.phase).toBe('exhausted');
    expect(drawIdea).toHaveBeenCalledTimes(3);
  });

  it('passes an explicit category reset to the shared transaction', async () => {
    const drawIdea = vi.fn<AppServices['drawIdea']>().mockResolvedValue({ kind: 'empty', catalog });
    const { result: hook } = setup(drawIdea);
    await act(async () => hook.current.reset(idea.categoryId));
    expect(drawIdea).toHaveBeenCalledWith(idea.categoryId, true);
    expect(hook.current.phase).toBe('empty');
  });

  it('an old animation completion cannot unlock a newer request', async () => {
    const next = deferred<DrawResult>();
    const drawIdea = vi.fn<AppServices['drawIdea']>().mockResolvedValueOnce(result).mockImplementation(() => next.promise);
    const { result: hook } = setup(drawIdea);
    await act(async () => hook.current.draw('all'));
    const oldCompletion = hook.current.finishReveal;
    act(() => hook.current.finishReveal());
    act(() => { void hook.current.draw('all'); oldCompletion(); void hook.current.draw('all'); });
    expect(drawIdea).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve({ ...result, drawId: 'draw-2' }));
  });
});
