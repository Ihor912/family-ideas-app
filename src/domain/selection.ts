import { ALL_CATEGORIES, type Catalog, type DrawState, type Idea } from './types';

export type SelectionResult =
  | { kind: 'drawn'; idea: Idea; state: DrawState; catalog: Catalog }
  | { kind: 'exhausted'; catalog: Catalog }
  | { kind: 'empty'; catalog: Catalog };

/** Clear only the selected pool, without choosing or marking another activity. */
export function resetSeenHistory(catalog: Catalog, state: DrawState, categoryId: string): DrawState {
  const currentIdeas = new Map(catalog.ideas.map((idea) => [idea.id, idea]));
  const seenIds = [...new Set(state.seenIds)].filter((id) => {
    const idea = currentIdeas.get(id);
    return idea && categoryId !== ALL_CATEGORIES && idea.categoryId !== categoryId;
  });
  return { seenIds, lastIdeaId: seenIds.at(-1) ?? null };
}

/** Global family history; an explicit reset clears only the selected category. */
export function selectIdea(
  catalog: Catalog,
  state: DrawState,
  categoryId: string,
  reset = false,
  rng: () => number = Math.random,
): SelectionResult {
  const eligible = catalog.ideas.filter(
    (idea) => categoryId === ALL_CATEGORIES || idea.categoryId === categoryId,
  );
  if (eligible.length === 0) return { kind: 'empty', catalog };

  const currentIds = new Set(catalog.ideas.map(({ id }) => id));
  const eligibleIds = new Set(eligible.map(({ id }) => id));
  const seenIds = [...new Set(state.seenIds)].filter(
    (id) => currentIds.has(id) && !(reset && eligibleIds.has(id)),
  );
  const seen = new Set(seenIds);
  let candidates = eligible.filter(({ id }) => !seen.has(id));
  if (candidates.length === 0) return { kind: 'exhausted', catalog };
  if (reset && candidates.length > 1) {
    candidates = candidates.filter(({ id }) => id !== state.lastIdeaId);
  }

  const random = rng();
  if (!Number.isFinite(random) || random < 0 || random >= 1) {
    throw new RangeError('The random source must return a number from 0 (inclusive) to 1 (exclusive).');
  }
  const idea = candidates[Math.floor(random * candidates.length)]!;
  return {
    kind: 'drawn',
    idea,
    catalog,
    state: { seenIds: [...seenIds, idea.id], lastIdeaId: idea.id },
  };
}
