import { useCallback, useEffect, useState } from 'react';
import type { Catalog, DrawState } from '../domain/types';
import { errorMessage } from '../services/errors';
import type { FamilyUser } from '../services/types';
import { useAppServices } from './authState';

type FamilyData = {
  status: 'loading' | 'ready' | 'unapproved' | 'error';
  catalog: Catalog | null;
  history: DrawState | null;
  error: string | null;
};
const loading: FamilyData = { status: 'loading', catalog: null, history: null, error: null };

export function useFamilyData(user: FamilyUser | null): FamilyData & { retry: () => void } {
  const services = useAppServices();
  const uid = user?.uid ?? null;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ userId: string | null; attempt: number; data: FamilyData }>({ userId: uid, attempt, data: loading });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  // Reset during the account/retry render so no previous account's content survives
  // until an effect runs. This is React's conditional state-adjustment pattern.
  if (state.userId !== uid || state.attempt !== attempt) {
    setState({ userId: uid, attempt, data: loading });
  }

  useEffect(() => {
    let active = true;
    if (!uid) return () => { active = false; };
    const unsubscribe = services.subscribeFamily(uid, (snapshot) => {
      if (active) setState({ userId: uid, attempt, data: { ...snapshot, error: null } });
    }, (reason) => {
      if (active) setState({
        userId: uid,
        attempt,
        data: {
          status: 'error',
          catalog: null,
          history: null,
          error: errorMessage(reason, 'Не вдалося завантажити сімейні пригоди. Спробуйте ще раз.'),
        },
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid, services, attempt]);

  return { ...(state.userId === uid && state.attempt === attempt ? state.data : loading), retry };
}
