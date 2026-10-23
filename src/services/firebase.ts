import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  GoogleAuthProvider,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import type { AppServices } from './types';
import type { FamilyServices } from './firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const configured = Object.values(config).every((value) => typeof value === 'string' && value.trim().length > 0);
const app = configured ? initializeApp(config) : null;
const auth = app ? initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
}) : null;

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true' && auth) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

let familyServices: Promise<FamilyServices> | null = null;
function loadFamilyServices(): Promise<FamilyServices> {
  if (!app || !auth) return Promise.reject(new Error('Firebase is not configured.'));
  const firebaseApp = app;
  const firebaseAuth = auth;
  familyServices ??= import('./firestore').then(({ createFamilyServices }) =>
    createFamilyServices(firebaseApp, () => firebaseAuth.currentUser?.uid ?? null),
  ).catch((reason: unknown) => {
    familyServices = null;
    throw reason;
  });
  return familyServices;
}

export const firebaseServices: AppServices = {
  configured,
  subscribeAuth(next, error) {
    if (!auth) {
      next(null);
      return () => undefined;
    }
    return onAuthStateChanged(auth, (user) => next(user ? {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    } : null), error);
  },
  async signIn() {
    if (!auth) throw new Error('Firebase is not configured.');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    // Do not await anything before opening the popup: this is a user-gesture operation.
    await signInWithPopup(auth, provider);
  },
  async signOut() {
    if (auth) await signOut(auth);
  },
  subscribeFamily(userId, next, error) {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    next({ status: 'loading', catalog: null, history: null });
    void loadFamilyServices().then((services) => {
      if (!disposed && auth?.currentUser?.uid === userId) {
        unsubscribe = services.subscribeFamily(userId, next, error);
      }
    }).catch((reason: unknown) => {
      if (!disposed) error(reason);
    });
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  },
  async drawIdea(categoryId, reset) {
    const userId = auth?.currentUser?.uid;
    if (!userId) throw new Error('Sign in before drawing an activity.');
    const services = await loadFamilyServices();
    if (auth?.currentUser?.uid !== userId) throw new Error('The signed-in account changed.');
    return services.drawIdea(categoryId, reset);
  },
};
