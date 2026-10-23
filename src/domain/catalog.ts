import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import type { RootContent } from 'mdast';
import type { Catalog, LegacyContentDocument, StructuredContentDocument } from './types';

export const MAX_IDEAS = 1_000;
export const MAX_MARKDOWN_BYTES = 900_000;
export const MAX_CATEGORIES = 64;
const RECORD_ID = /^[0-9a-f]{32}$/;

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogError';
  }
}

function normalize(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function sectionKey(value: string): string {
  return normalize(value).toLocaleLowerCase('uk');
}

function textOf(node: RootContent | { value?: string; children?: unknown[] }): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => textOf(child as RootContent)).join('');
  }
  return '';
}

function stableId(value: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(value)).subarray(0, 16));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function parseStructuredCatalog(content: Record<string, unknown>): Catalog {
  if (!exactKeys(content, ['schemaVersion', 'categories', 'ideas'])
    || !isRecord(content.categories) || !isRecord(content.ideas)) {
    throw new CatalogError('Version 2 content must contain only schemaVersion, categories and ideas maps.');
  }
  let encoded: string;
  try {
    encoded = JSON.stringify(content);
  } catch {
    throw new CatalogError('The activity collection must contain JSON-compatible values.');
  }
  if (new TextEncoder().encode(encoded).length > MAX_MARKDOWN_BYTES) {
    throw new CatalogError('The activity collection exceeds the 900 KB size limit.');
  }
  const categoryEntries = Object.entries(content.categories);
  const ideaEntries = Object.entries(content.ideas);
  if (categoryEntries.length > MAX_CATEGORIES) {
    throw new CatalogError('The activity collection contains more than 64 categories.');
  }
  if (ideaEntries.length > MAX_IDEAS) {
    throw new CatalogError('The document contains more than 1,000 activities.');
  }

  const categories = new Map<string, Catalog['categories'][number] & { order: number }>();
  const orders = new Set<number>();
  for (const [id, value] of categoryEntries) {
    if (!RECORD_ID.test(id) || !isRecord(value) || !exactKeys(value, ['name', 'order'])
      || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200
      || typeof value.order !== 'number' || !Number.isSafeInteger(value.order) || value.order < 0) {
      throw new CatalogError('Each category needs a 32-character ID, a name and a non-negative integer order.');
    }
    if (orders.has(value.order)) throw new CatalogError('Category order values must be unique.');
    orders.add(value.order);
    categories.set(id, { id, name: value.name, order: value.order, count: 0 });
  }

  const ideas: Catalog['ideas'] = [];
  // Map field order is not meaningful in Firestore. Sort IDs for deterministic
  // catalog reads without deriving identity from an activity's editable text.
  for (const [id, value] of ideaEntries.sort(([left], [right]) => left.localeCompare(right))) {
    if (!RECORD_ID.test(id) || !isRecord(value) || !exactKeys(value, ['categoryId', 'markdown'])
      || typeof value.categoryId !== 'string' || !categories.has(value.categoryId)
      || typeof value.markdown !== 'string' || !value.markdown.trim()) {
      throw new CatalogError('Each activity needs a 32-character ID, an existing category and non-empty Markdown.');
    }
    ideas.push({ id, categoryId: value.categoryId, markdown: value.markdown });
    categories.get(value.categoryId)!.count += 1;
  }
  return {
    ideas,
    categories: [...categories.values()]
      .filter(({ count }) => count > 0)
      .sort((left, right) => left.order - right.order)
      .map(({ id, name, count }) => ({ id, name, count })),
  };
}

/** Accept the structured catalog and legacy Markdown during deployment migration. */
export function parseCatalog(content: unknown): Catalog {
  if (!isRecord(content)) throw new CatalogError('The private activity collection is missing or invalid.');
  if (Object.hasOwn(content, 'schemaVersion')) {
    if (content.schemaVersion !== 2) throw new CatalogError('The activity collection has an unsupported schema version.');
    return parseStructuredCatalog(content);
  }
  return parseLegacyCatalog(content);
}

/** Migration keeps the exact legacy IDs; future edits retain these stored keys. */
export function toStructuredContent(content: LegacyContentDocument): StructuredContentDocument {
  const catalog = parseCatalog(content);
  const structured: StructuredContentDocument = {
    schemaVersion: 2,
    categories: Object.fromEntries(catalog.categories.map(({ id, name }, order) => [id, { name, order }])),
    ideas: Object.fromEntries(catalog.ideas.map(({ id, categoryId, markdown }) => [id, { categoryId, markdown }])),
  };
  parseCatalog(structured);
  return structured;
}

/** Parse only top-level list items belonging to non-excluded H2 sections. */
function parseLegacyCatalog(content: Record<string, unknown>): Catalog {
  if (typeof content.markdown !== 'string') {
    throw new CatalogError('The content document must contain a Markdown string.');
  }
  if (new TextEncoder().encode(content.markdown).length > MAX_MARKDOWN_BYTES) {
    throw new CatalogError('The Markdown document exceeds the 900 KB size limit.');
  }
  if (
    !Array.isArray(content.excludedSections) ||
    content.excludedSections.length > 64 ||
    content.excludedSections.some((name) => typeof name !== 'string' || name.length > 200)
  ) {
    throw new CatalogError('excludedSections must be a list of section names.');
  }

  const excluded = new Set((content.excludedSections as string[]).map(sectionKey));
  const categories = new Map<string, Catalog['categories'][number]>();
  const ideas: Catalog['ideas'] = [];
  const ids = new Set<string>();
  let category: Catalog['categories'][number] | null = null;

  for (const node of fromMarkdown(content.markdown).children) {
    if (node.type === 'heading' && node.depth <= 2) {
      category = null;
      if (node.depth === 1) continue;
      const name = normalize(textOf(node));
      if (!name || excluded.has(sectionKey(name))) continue;
      const id = stableId(`category\n${sectionKey(name)}`);
      category = categories.get(id) ?? { id, name, count: 0 };
      categories.set(id, category);
      continue;
    }
    if (node.type !== 'list' || !category) continue;

    for (const item of node.children) {
      const markdown = toMarkdown(
        { type: 'root', children: item.children },
        { bullet: '-', emphasis: '*', strong: '*', fences: true },
      ).trim();
      if (!markdown || !normalize(textOf(item))) continue;
      const id = stableId(`idea\n${category.id}\n${normalize(markdown)}`);
      // The same activity repeated within a category should not gain extra odds.
      if (ids.has(id)) continue;
      ids.add(id);
      ideas.push({ id, categoryId: category.id, markdown });
      category.count += 1;
      if (ideas.length > MAX_IDEAS) {
        throw new CatalogError('The document contains more than 1,000 activities.');
      }
    }
  }

  return { ideas, categories: [...categories.values()].filter(({ count }) => count > 0) };
}
