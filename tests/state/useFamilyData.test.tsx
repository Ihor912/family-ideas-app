import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppServices, FamilySnapshot, FamilyUser } from '../../src/services/types';
import { AuthProvider } from '../../src/state/AuthContext';
import { useFamilyData } from '../../src/state/useFamilyData';

vi.mock('../../src/services/firebase', () => ({ firebaseServices: { configured: false } }));

const user: FamilyUser = { uid: 'approved-adult', displayName: null, email: null, photoURL: null };
const ready: FamilySnapshot = {
  status: 'ready',
  catalog: { ideas: [{ id: 'synthetic', categoryId: 'synthetic', markdown: 'Придумайте назву сузір’я.' }], categories: [] },
  history: { seenIds: [], lastIdeaId: null },
};

afterEach(cleanup);

function setup() {
  const listeners: { next: (snapshot: FamilySnapshot) => void; error: (reason: unknown) => void; unsubscribe: ReturnType<typeof vi.fn> }[] = [];
  const services: AppServices = {
    configured: true,
    subscribeAuth: () => () => undefined,
    signIn: async () => undefined,
    signOut: async () => undefined,
    subscribeFamily(_uid, next, error) {
      const unsubscribe = vi.fn();
      listeners.push({ next, error, unsubscribe });
      return unsubscribe;
    },
    drawIdea: async () => { throw new Error('unused'); },
  };
  const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider services={services}>{children}</AuthProvider>;
  return { ...renderHook(({ currentUser }) => useFamilyData(currentUser), { initialProps: { currentUser: user as FamilyUser | null }, wrapper }), listeners };
}

describe('useFamilyData', () => {
  it('clears private snapshots on sign-out and ignores callbacks from the old subscription', () => {
    const { result, rerender, listeners } = setup();
    act(() => listeners[0].next(ready));
    expect(result.current.catalog).toEqual(ready.catalog);
    rerender({ currentUser: null });
    expect(result.current.catalog).toBeNull();
    expect(listeners[0].unsubscribe).toHaveBeenCalledTimes(1);
    act(() => listeners[0].next(ready));
    expect(result.current.catalog).toBeNull();
  });

  it('clears private data on revoked access and retries with a fresh listener', () => {
    const { result, listeners } = setup();
    act(() => listeners[0].next(ready));
    act(() => listeners[0].error({ code: 'permission-denied' }));
    expect(result.current).toMatchObject({ status: 'error', catalog: null, history: null });
    act(() => result.current.retry());
    expect(listeners[0].unsubscribe).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(2);
    act(() => listeners[1].next({ status: 'unapproved', catalog: null, history: null }));
    expect(result.current.status).toBe('unapproved');
  });
});
