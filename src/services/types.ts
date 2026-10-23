import type { Catalog, DrawResult, DrawState } from '../domain/types';

export type FamilyUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

export type FamilySnapshot = {
  status: 'loading' | 'ready' | 'unapproved';
  catalog: Catalog | null;
  history: DrawState | null;
};

/** The injectable boundary between browser state and the shared family data. */
export interface AppServices {
  configured: boolean;
  subscribeAuth(next: (user: FamilyUser | null) => void, error?: (error: unknown) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  subscribeFamily(
    userId: string,
    next: (snapshot: FamilySnapshot) => void,
    error: (error: unknown) => void,
  ): () => void;
  drawIdea(categoryId: string, reset: boolean): Promise<DrawResult>;
}
