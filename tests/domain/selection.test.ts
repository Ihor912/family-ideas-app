import { describe, expect, it } from 'vitest';
import { resetSeenHistory, selectIdea } from '../../src/domain/selection';
import { ALL_CATEGORIES, type Catalog, type DrawState } from '../../src/domain/types';

const catalog: Catalog = {
  ideas: [
    { id: 'a', categoryId: 'space', markdown: 'Rocket' },
    { id: 'b', categoryId: 'space', markdown: 'Stars' },
    { id: 'c', categoryId: 'home', markdown: 'Shadows' },
  ],
  categories: [
    { id: 'space', name: 'Space', count: 2 },
    { id: 'home', name: 'Home', count: 1 },
  ],
};
const emptyState: DrawState = { seenIds: [], lastIdeaId: null };

describe('resetSeenHistory', () => {
  it('clears a partially explored category without drawing or altering other categories', () => {
    const state: DrawState = { seenIds: ['c', 'a'], lastIdeaId: 'a' };
    expect(resetSeenHistory(catalog, state, 'space')).toEqual({ seenIds: ['c'], lastIdeaId: 'c' });
    expect(state).toEqual({ seenIds: ['c', 'a'], lastIdeaId: 'a' });
  });

  it('clears all progress from All and keeps an already empty history empty', () => {
    expect(resetSeenHistory(catalog, { seenIds: ['a', 'c'], lastIdeaId: 'c' }, ALL_CATEGORIES)).toEqual(emptyState);
    expect(resetSeenHistory(catalog, emptyState, 'space')).toEqual(emptyState);
  });

  it('prunes deleted entries and duplicates while restoring the last remaining seen activity', () => {
    const state: DrawState = { seenIds: ['c', 'c', 'a', 'removed'], lastIdeaId: 'removed' };
    expect(resetSeenHistory(catalog, state, 'space')).toEqual({ seenIds: ['c'], lastIdeaId: 'c' });
    expect(resetSeenHistory({ ideas: [], categories: [] }, state, 'space')).toEqual(emptyState);
  });

  it('uses current category membership and preserves valid history for a removed category', () => {
    const state: DrawState = { seenIds: ['a', 'b', 'c'], lastIdeaId: 'c' };
    const moved = { ...catalog, ideas: catalog.ideas.map((idea) => idea.id === 'a' ? { ...idea, categoryId: 'home' } : idea) };
    expect(resetSeenHistory(moved, state, 'space')).toEqual({ seenIds: ['a', 'c'], lastIdeaId: 'c' });
    expect(resetSeenHistory(catalog, state, 'removed-category')).toEqual(state);
  });
});

describe('selectIdea', () => {
  it('shares seen ideas across category and all-category draws', () => {
    const first = selectIdea(catalog, emptyState, 'space', false, () => 0);
    expect(first.kind).toBe('drawn');
    if (first.kind !== 'drawn') throw new Error('Expected a draw');
    expect(first.idea.id).toBe('a');
    const second = selectIdea(catalog, first.state, ALL_CATEGORIES, false, () => 0);
    expect(second.kind).toBe('drawn');
    if (second.kind !== 'drawn') throw new Error('Expected a draw');
    expect(second.idea.id).toBe('b');
    expect(second.state.seenIds).toEqual(['a', 'b']);
  });

  it('reports exhaustion without silently resetting history', () => {
    const state = { seenIds: ['a', 'b'], lastIdeaId: 'b' };
    expect(selectIdea(catalog, state, 'space')).toEqual({ kind: 'exhausted', catalog });
    expect(state.seenIds).toEqual(['a', 'b']);
  });

  it('resets only the chosen category and avoids the last result', () => {
    const state = { seenIds: ['c', 'a', 'b'], lastIdeaId: 'b' };
    const result = selectIdea(catalog, state, 'space', true, () => 0.999);
    expect(result.kind).toBe('drawn');
    if (result.kind !== 'drawn') throw new Error('Expected a draw');
    expect(result.idea.id).toBe('a');
    expect(result.state).toEqual({ seenIds: ['c', 'a'], lastIdeaId: 'a' });
    expect(state.seenIds).toEqual(['c', 'a', 'b']);
  });

  it('resets every category from All and allows a singleton on explicit reset', () => {
    const all = selectIdea(catalog, { seenIds: ['a', 'b', 'c'], lastIdeaId: 'c' }, ALL_CATEGORIES, true, () => 0.999);
    expect(all.kind === 'drawn' && all.state.seenIds).toEqual(['b']);
    const single = selectIdea(catalog, { seenIds: ['c'], lastIdeaId: 'c' }, 'home', true, () => 0);
    expect(single.kind === 'drawn' && single.idea.id).toBe('c');
  });

  it('reconciles deleted history while making newly added ideas eligible', () => {
    const result = selectIdea(catalog, { seenIds: ['a', 'a', 'removed'], lastIdeaId: 'removed' }, 'space', false, () => 0);
    expect(result.kind === 'drawn' && result.state).toEqual({ seenIds: ['a', 'b'], lastIdeaId: 'b' });
  });

  it('reports missing or empty categories without consuming randomness', () => {
    const rng = () => { throw new Error('Must not draw'); };
    expect(selectIdea(catalog, emptyState, 'missing', false, rng)).toEqual({ kind: 'empty', catalog });
    expect(selectIdea({ ideas: [], categories: [] }, emptyState, ALL_CATEGORIES, false, rng).kind).toBe('empty');
  });

  it('maps random interval endpoints to the first and last eligible ideas', () => {
    const first = selectIdea(catalog, emptyState, ALL_CATEGORIES, false, () => 0);
    const last = selectIdea(catalog, emptyState, ALL_CATEGORIES, false, () => 1 - Number.EPSILON);
    expect(first.kind === 'drawn' && first.idea.id).toBe('a');
    expect(last.kind === 'drawn' && last.idea.id).toBe('c');
    for (const invalid of [-1, 1, NaN, Infinity]) {
      expect(() => selectIdea(catalog, emptyState, ALL_CATEGORIES, false, () => invalid)).toThrow(RangeError);
    }
  });
});
