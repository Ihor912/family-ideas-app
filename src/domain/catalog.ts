import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import type { RootContent } from 'mdast';
import type { Catalog, ContentDocument } from './types';

export const MAX_IDEAS = 1_000;
export const MAX_MARKDOWN_BYTES = 900_000;

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

/** Parse only top-level list items belonging to non-excluded H2 sections. */
export function parseCatalog(content: ContentDocument): Catalog {
  if (!content || typeof content.markdown !== 'string') {
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

  const excluded = new Set(content.excludedSections.map(sectionKey));
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
