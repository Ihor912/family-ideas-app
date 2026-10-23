export type Idea = { id: string; categoryId: string; markdown: string };
export type Category = { id: string; name: string; count: number };
export type Catalog = { ideas: Idea[]; categories: Category[] };
export type ContentDocument = { markdown: string; excludedSections: string[] };
export type DrawState = { seenIds: string[]; lastIdeaId: string | null };
export type DrawResult =
  | { kind: 'drawn'; idea: Idea; state: DrawState; catalog: Catalog; drawId: string }
  | { kind: 'exhausted'; catalog: Catalog }
  | { kind: 'empty'; catalog: Catalog };
export const ALL_CATEGORIES = 'all';
