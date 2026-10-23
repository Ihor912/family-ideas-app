import { createContext, useContext } from 'react';
import type { AppServices, FamilyUser } from '../services/types';

export type AuthContextValue = {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: FamilyUser | null;
  error: string | null;
  configured: boolean;
  signInPending: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
export const ServicesContext = createContext<AppServices | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be called inside AuthProvider.');
  return value;
}

export function useAppServices(): AppServices {
  const value = useContext(ServicesContext);
  if (!value) throw new Error('useAppServices must be called inside AuthProvider.');
  return value;
}
