import type { FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  initializeFirestore,
  memoryLocalCache,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { parseCatalog } from '../domain/catalog';
import { selectIdea } from '../domain/selection';
import type { Catalog, ContentDocument, DrawState } from '../domain/types';
import type { AppServices, FamilySnapshot } from './types';

export type FamilyServices = Pick<AppServices, 'subscribeFamily' | 'drawIdea'>;

const emptyHistory = (): DrawState => ({ seenIds: [], lastIdeaId: null });
const emptySnapshot = (status: FamilySnapshot['status']): FamilySnapshot => ({ status, catalog: null, history: null });

function readContent(data: DocumentData | undefined): ContentDocument {
  if (!data || typeof data.markdown !== 'string' || !Array.isArray(data.excludedSections)
    || !data.excludedSections.every((section: unknown) => typeof section === 'string')) {
    throw new Error('The private activity collection is missing or invalid.');
  }
  return { markdown: data.markdown, excludedSections: data.excludedSections as string[] };
}

function readHistory(data: DocumentData | undefined): DrawState {
  if (!data) return emptyHistory();
  if (!Array.isArray(data.seenIds) || !data.seenIds.every((id: unknown) => typeof id === 'string')
    || (data.lastIdeaId !== null && typeof data.lastIdeaId !== 'string')) {
    throw new Error('The shared progress document is invalid.');
  }
  return { seenIds: [...new Set(data.seenIds as string[])], lastIdeaId: data.lastIdeaId as string | null };
}

/** Loaded only after authentication, so the public landing page stays light. */
export function createFamilyServices(app: FirebaseApp, getUserId: () => string | null): FamilyServices {
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return {
  subscribeFamily(userId, next, error) {
    if (!getUserId()) {
      error(new Error('Firebase is not configured.'));
      return () => undefined;
    }
    const database = db;
    let disposed = false;
    let active = false;
    let generation = 0;
    let stopContent: (() => void) | undefined;
    let stopHistory: (() => void) | undefined;
    let catalog: Catalog | null = null;
    let history: DrawState | null = null;

    function stopPrivateListeners() {
      generation += 1;
      stopContent?.();
      stopHistory?.();
      stopContent = undefined;
      stopHistory = undefined;
      catalog = null;
      history = null;
    }
    function reportError(reason: unknown) {
      if (disposed) return;
      active = false;
      stopPrivateListeners();
      error(reason);
    }
    function publish() {
      if (!disposed && active && catalog && history) next({ status: 'ready', catalog, history });
    }

    next(emptySnapshot('loading'));
    const stopMember = onSnapshot(doc(database, 'members', userId), { includeMetadataChanges: true }, (snapshot) => {
      if (disposed) return;
      // Confirm approval with the server before opening private listeners after
      // sign-in. A previous session's in-memory membership cache is insufficient.
      if (snapshot.metadata.fromCache) return;
      if (snapshot.data()?.active !== true) {
        active = false;
        stopPrivateListeners();
        next(emptySnapshot('unapproved'));
        return;
      }
      if (active) return;
      active = true;
      next(emptySnapshot('loading'));
      const listenerGeneration = ++generation;
      const reportCurrentError = (reason: unknown) => {
        if (generation === listenerGeneration) reportError(reason);
      };
      stopContent = onSnapshot(doc(database, 'content', 'current'), (content) => {
        if (disposed || generation !== listenerGeneration) return;
        try {
          catalog = parseCatalog(readContent(content.data()));
          publish();
        } catch (reason) {
          reportError(reason);
        }
      }, reportCurrentError);
      stopHistory = onSnapshot(doc(database, 'draws', 'current'), (progress) => {
        if (disposed || generation !== listenerGeneration) return;
        try {
          history = readHistory(progress.data());
          publish();
        } catch (reason) {
          reportError(reason);
        }
      }, reportCurrentError);
    }, reportError);

    return () => {
      disposed = true;
      stopMember();
      stopPrivateListeners();
    };
  },
  async drawIdea(categoryId, reset) {
    const requestingUserId = getUserId();
    if (!requestingUserId) throw new Error('Sign in before drawing an activity.');
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw Object.assign(new Error('Offline'), { code: 'unavailable' });
    }
    const database = db;
    const contentRef = doc(database, 'content', 'current');
    const historyRef = doc(database, 'draws', 'current');
    const result = await runTransaction(database, async (transaction) => {
      if (getUserId() !== requestingUserId) throw new Error('The signed-in account changed.');
      const [content, progress] = await Promise.all([
        transaction.get(contentRef),
        transaction.get(historyRef),
      ]);
      const catalog = parseCatalog(readContent(content.data()));
      const history = readHistory(progress.data());
      // A stale exhausted screen or transaction retry must join a round another
      // device has already started, rather than erase its first selection.
      let selected = selectIdea(catalog, history, categoryId);
      if (selected.kind === 'exhausted' && reset) {
        selected = selectIdea(catalog, history, categoryId, true);
      }
      if (selected.kind === 'drawn') {
        transaction.set(historyRef, { ...selected.state, updatedAt: serverTimestamp() });
      }
      return selected;
    });
    return result.kind === 'drawn'
      ? { ...result, drawId: crypto.randomUUID() }
      : result;
  },
  };
}
