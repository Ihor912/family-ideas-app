import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../../src/services/audio';
import type { AppServices, FamilyUser } from '../../src/services/types';
import { AuthProvider } from '../../src/state/AuthContext';
import { useAuth } from '../../src/state/authState';

vi.mock('../../src/services/firebase', () => ({ firebaseServices: { configured: false } }));
afterEach(cleanup);

function setup(signIn: AppServices['signIn'] = async () => undefined) {
  let authChanged: (user: FamilyUser | null) => void = () => undefined;
  const unsubscribe = vi.fn();
  const services: AppServices = {
    configured: true,
    subscribeAuth(next) { authChanged = next; next(null); return unsubscribe; },
    signIn,
    signOut: vi.fn(async () => authChanged(null)),
    subscribeFamily: () => () => undefined,
    drawIdea: async () => { throw new Error('unused'); },
  };
  const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider services={services}>{children}</AuthProvider>;
  return { ...renderHook(useAuth, { wrapper }), services, authChanged: (user: FamilyUser | null) => authChanged(user), unsubscribe };
}

describe('AuthProvider', () => {
  it('opens sign-in in the click stack and prevents duplicate popup requests', async () => {
    let resolve!: () => void;
    const signIn = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    const { result } = setup(signIn);
    act(() => {
      void result.current.signIn();
      expect(signIn).toHaveBeenCalledTimes(1);
      void result.current.signIn();
    });
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(result.current.signInPending).toBe(true);
    await act(async () => resolve());
    expect(result.current.signInPending).toBe(false);
  });

  it('translates a blocked popup into a retryable Ukrainian error', async () => {
    const signIn = vi.fn<AppServices['signIn']>().mockRejectedValueOnce({ code: 'auth/popup-blocked' }).mockResolvedValueOnce(undefined);
    const { result } = setup(signIn);
    await act(async () => result.current.signIn());
    expect(result.current.status).toBe('signed-out');
    expect(result.current.error).toContain('спливні вікна');
    await act(async () => result.current.signIn());
    expect(result.current.error).toBeNull();
  });

  it('clears identity and stops sounds when signing out', async () => {
    const stop = vi.spyOn(audioEngine, 'stop').mockImplementation(() => undefined);
    const { result, authChanged, services, unmount, unsubscribe } = setup();
    act(() => authChanged({ uid: 'synthetic-adult', displayName: 'Дослідник', email: null, photoURL: null }));
    expect(result.current.status).toBe('signed-in');
    await act(async () => result.current.signOut());
    expect(result.current.user).toBeNull();
    expect(result.current.status).toBe('signed-out');
    expect(services.signOut).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
