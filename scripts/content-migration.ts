import { parseCatalog, toStructuredContent } from '../src/domain/catalog';
import type { LegacyContentDocument, StructuredContentDocument } from '../src/domain/types';

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

function encodeMap(value: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (typeof item === 'string') return [key, { stringValue: item }];
    if (typeof item === 'number' && Number.isSafeInteger(item)) return [key, { integerValue: String(item) }];
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return [key, { mapValue: { fields: encodeMap(item as Record<string, unknown>) } }];
    }
    throw new Error('The catalog contains an unsupported Firestore field value.');
  }));
}

export function prepareContentMigration(legacy: LegacyContentDocument): {
  content: StructuredContentDocument;
  firestoreDocument: { fields: Record<string, FirestoreValue> };
  summary: { schemaVersion: 2; categories: number; activities: number; idsPreserved: true };
} {
  const before = parseCatalog(legacy);
  if (before.ideas.length === 0) throw new Error('No activities were found; refusing to prepare an empty migration.');
  const content = toStructuredContent(legacy);
  const after = parseCatalog(content);
  if (before.ideas.length !== after.ideas.length
    || before.ideas.some((idea) => !after.ideas.some((next) => next.id === idea.id && next.categoryId === idea.categoryId))) {
    throw new Error('Activity IDs changed during migration; the private collection was not exported.');
  }
  return {
    content,
    firestoreDocument: { fields: encodeMap(content) },
    summary: { schemaVersion: 2, categories: after.categories.length, activities: after.ideas.length, idsPreserved: true },
  };
}
