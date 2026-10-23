import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { audioEngine } from '../services/audio';
import { errorMessage } from '../services/errors';
import { firebaseServices } from '../services/firebase';
import type { AppServices, FamilyUser } from '../services/types';
import { AuthContext, ServicesContext, type AuthContextValue } from './authState';

export function AuthProvider({ children, services = firebaseServices }: { children: ReactNode; services?: AppServices }) {
  const [status, setStatus] = useState<AuthContextValue['status']>(services.configured ? 'loading' : 'signed-out');
  const [user, setUser] = useState<FamilyUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signInPending, setSignInPending] = useState(false);
  const mounted = useRef(false);
  const popupPending = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = services.subscribeAuth((nextUser) => {
      if (!mounted.current) return;
      setUser(nextUser);
      setStatus(nextUser ? 'signed-in' : 'signed-out');
      setError(null);
      if (!nextUser) audioEngine.stop();
    }, (reason) => {
      if (!mounted.current) return;
      setUser(null);
      setStatus('signed-out');
      setError(errorMessage(reason, 'Не вдалося перевірити вхід. Спробуйте ще раз.'));
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [services]);

  const signIn = useCallback(async () => {
    if (popupPending.current) return;
    popupPending.current = true;
    setError(null);
    setSignInPending(true);
    try {
      await services.signIn();
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason, 'Не вдалося увійти. Спробуйте ще раз.'));
    } finally {
      popupPending.current = false;
      if (mounted.current) setSignInPending(false);
    }
  }, [services]);

  const signOut = useCallback(async () => {
    audioEngine.stop();
    setError(null);
    try {
      await services.signOut();
      if (mounted.current) {
        setUser(null);
        setStatus('signed-out');
      }
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason, 'Не вдалося вийти. Спробуйте ще раз.'));
    }
  }, [services]);

  return (
    <ServicesContext.Provider value={services}>
      <AuthContext.Provider value={{ status, user, error, configured: services.configured, signInPending, signIn, signOut }}>
        {children}
      </AuthContext.Provider>
    </ServicesContext.Provider>
  );
}
