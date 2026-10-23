// @vitest-environment node
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parseCatalog } from '../../src/domain/catalog';
import { selectIdea } from '../../src/domain/selection';
import { ALL_CATEGORIES, type ContentDocument, type DrawState } from '../../src/domain/types';

const sampleContent: ContentDocument = {
  markdown: '## Космос\n- Збудувати паперову ракету.\n- Намалювати нову планету.\n\n## Удома\n- Зробити театр тіней.',
  excludedSections: [],
};
const idA = 'a'.repeat(32);
const idB = 'b'.repeat(32);

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Firestore authorization and transactions', () => {
  let env: RulesTestEnvironment;
  const google = (uid: string) => env.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'google.com', identities: { 'google.com': [uid] } },
  }).firestore();

  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-family-orbit',
      firestore: {
        host,
        port: Number(port),
        rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, 'members/alice'), { active: true }),
        setDoc(doc(db, 'members/bob'), { active: true }),
        setDoc(doc(db, 'members/revoked'), { active: false }),
        setDoc(doc(db, 'content/current'), sampleContent),
      ]);
    });
  });

  afterAll(async () => env?.cleanup());

  it('allows approved Google members to read content and their own approval status', async () => {
    await assertSucceeds(getDoc(doc(google('alice'), 'content/current')));
    await assertSucceeds(getDoc(doc(google('alice'), 'members/alice')));
    const unapproved = await assertSucceeds(getDoc(doc(google('outsider'), 'members/outsider')));
    expect(unapproved.exists()).toBe(false);
    await assertFails(getDoc(doc(google('alice'), 'members/bob')));
    await assertFails(getDocs(collection(google('alice'), 'members')));
  });

  it('denies content and history to signed-out, unapproved, revoked and non-Google identities', async () => {
    const identities = [
      env.unauthenticatedContext().firestore(),
      google('outsider'),
      google('revoked'),
      env.authenticatedContext('alice', {
        firebase: { sign_in_provider: 'password', identities: {} },
      }).firestore(),
    ];
    for (const db of identities) {
      await assertFails(getDoc(doc(db, 'content/current')));
      await assertFails(getDoc(doc(db, 'draws/current')));
      await assertFails(setDoc(doc(db, 'draws/current'), {
        seenIds: [idA], lastIdeaId: idA, updatedAt: serverTimestamp(),
      }));
    }
  });

  it('keeps content and membership writes admin-only and denies unrelated paths/listing', async () => {
    const db = google('alice');
    await assertFails(setDoc(doc(db, 'content/current'), sampleContent));
    await assertFails(deleteDoc(doc(db, 'content/current')));
    await assertFails(setDoc(doc(db, 'members/alice'), { active: false }));
    await assertFails(setDoc(doc(db, 'members/outsider'), { active: true }));
    await assertFails(deleteDoc(doc(db, 'members/alice')));
    await assertFails(getDocs(collection(db, 'content')));
    await assertFails(getDocs(collection(db, 'draws')));
    await assertFails(setDoc(doc(db, 'draws/other'), {
      seenIds: [], lastIdeaId: null, updatedAt: serverTimestamp(),
    }));
    await assertFails(getDoc(doc(db, 'other/secret')));
  });

  it('allows bounded unique history with a server timestamp, and denies deletion', async () => {
    const ref = doc(google('alice'), 'draws/current');
    await assertSucceeds(setDoc(ref, { seenIds: [], lastIdeaId: null, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(ref, { seenIds: [idA], lastIdeaId: idA, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(ref, { seenIds: [idA, idB], lastIdeaId: idB, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(ref));
  });

  it('rejects malformed, oversized, duplicate, injected and client-timestamped history', async () => {
    const ref = doc(google('alice'), 'draws/current');
    const valid = { seenIds: [idA], lastIdeaId: idA, updatedAt: serverTimestamp() };
    const invalid = [
      { ...valid, extra: 'not allowed' },
      { ...valid, seenIds: [idA, idA] },
      { ...valid, seenIds: [42, idA] },
      { ...valid, seenIds: [`${idA},${idB}`, idA] },
      { ...valid, seenIds: ['invalid', idA] },
      { ...valid, seenIds: idA },
      { ...valid, lastIdeaId: idB },
      { ...valid, lastIdeaId: null },
      { ...valid, seenIds: [idA, idB], lastIdeaId: idA },
      { ...valid, updatedAt: Timestamp.fromMillis(0) },
      { seenIds: [idA], lastIdeaId: idA },
      {
        ...valid,
        seenIds: Array.from({ length: 1_001 }, (_, i) => i.toString(16).padStart(32, '0')),
      },
    ];
    for (const state of invalid) await assertFails(setDoc(ref, state));
  });

  it('revokes future reads and writes when dashboard membership is removed', async () => {
    const db = google('alice');
    await assertSucceeds(getDoc(doc(db, 'content/current')));
    await env.withSecurityRulesDisabled((context) => deleteDoc(doc(context.firestore(), 'members/alice')));
    await assertFails(getDoc(doc(db, 'content/current')));
    await assertFails(setDoc(doc(db, 'draws/current'), {
      seenIds: [idA], lastIdeaId: idA, updatedAt: serverTimestamp(),
    }));
  });

  it('serializes simultaneous family draws so two devices receive different unseen ideas', async () => {
    const draw = (uid: string) => {
      const db = google(uid);
      return runTransaction(db, async (transaction) => {
        const content = await transaction.get(doc(db, 'content/current'));
        const history = await transaction.get(doc(db, 'draws/current'));
        const catalog = parseCatalog(content.data() as ContentDocument);
        const state: DrawState = history.exists()
          ? history.data() as DrawState
          : { seenIds: [], lastIdeaId: null };
        const selected = selectIdea(catalog, state, ALL_CATEGORIES, false, () => 0);
        if (selected.kind !== 'drawn') throw new Error('Expected an available activity');
        transaction.set(doc(db, 'draws/current'), { ...selected.state, updatedAt: serverTimestamp() });
        return selected.idea.id;
      });
    };
    const results = await Promise.all([draw('alice'), draw('bob')]);
    expect(new Set(results).size).toBe(2);
    const history = await getDoc(doc(google('alice'), 'draws/current'));
    expect(history.data()?.seenIds).toHaveLength(2);
    expect(new Set(history.data()?.seenIds)).toEqual(new Set(results));
  });

  it('joins an already-reset category cycle when two devices reset concurrently', async () => {
    const catalog = parseCatalog(sampleContent);
    const categoryId = catalog.categories[0]!.id;
    const otherIdea = catalog.ideas.find((idea) => idea.categoryId !== categoryId)!;
    await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), 'draws/current'), {
      seenIds: catalog.ideas.map(({ id }) => id),
      lastIdeaId: otherIdea.id,
      updatedAt: Timestamp.now(),
    }));

    const resetCategory = (uid: string) => {
      const db = google(uid);
      return runTransaction(db, async (transaction) => {
        const content = await transaction.get(doc(db, 'content/current'));
        const history = await transaction.get(doc(db, 'draws/current'));
        const latestCatalog = parseCatalog(content.data() as ContentDocument);
        const state = history.data() as DrawState;
        // A reset click is conditional on current server state. Retried or stale
        // requests must join a cycle another family member has already started.
        let selected = selectIdea(latestCatalog, state, categoryId, false, () => 0);
        if (selected.kind === 'exhausted') {
          selected = selectIdea(latestCatalog, state, categoryId, true, () => 0);
        }
        if (selected.kind !== 'drawn') throw new Error('Expected a reset activity');
        transaction.set(doc(db, 'draws/current'), { ...selected.state, updatedAt: serverTimestamp() });
        return selected.idea.id;
      });
    };

    const results = await Promise.all([resetCategory('alice'), resetCategory('bob')]);
    expect(new Set(results).size).toBe(2);
    const history = await getDoc(doc(google('alice'), 'draws/current'));
    expect(history.data()?.seenIds).toHaveLength(3);
    expect(new Set(history.data()?.seenIds)).toEqual(new Set([otherIdea.id, ...results]));
  });

  it('retries a draw against content replaced while its transaction is in flight', async () => {
    const db = google('alice');
    let announceFirstRead: () => void = () => {};
    let releaseFirstAttempt: () => void = () => {};
    const firstRead = new Promise<void>((resolve) => { announceFirstRead = resolve; });
    const release = new Promise<void>((resolve) => { releaseFirstAttempt = resolve; });
    let attempts = 0;
    const draw = runTransaction(db, async (transaction) => {
      const content = await transaction.get(doc(db, 'content/current'));
      const history = await transaction.get(doc(db, 'draws/current'));
      attempts += 1;
      if (attempts === 1) {
        announceFirstRead();
        await release;
      }
      const catalog = parseCatalog(content.data() as ContentDocument);
      const selected = selectIdea(catalog, history.exists()
        ? history.data() as DrawState
        : { seenIds: [], lastIdeaId: null }, ALL_CATEGORIES, false, () => 0);
      if (selected.kind !== 'drawn') throw new Error('Expected an available activity');
      transaction.set(doc(db, 'draws/current'), { ...selected.state, updatedAt: serverTimestamp() });
      return selected.idea.markdown;
    });
    await firstRead;
    try {
      await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), 'content/current'), {
        markdown: '## Нове\n- Придумати сімейний космічний танець.', excludedSections: [],
      }));
    } finally {
      releaseFirstAttempt();
    }
    expect(await draw).toBe('Придумати сімейний космічний танець.');
    expect(attempts).toBeGreaterThan(1);
  });
});
