import { describe, expect, it } from 'vitest';
import { MAX_MARKDOWN_BYTES, parseCatalog, toStructuredContent } from '../../src/domain/catalog';
import { selectIdea } from '../../src/domain/selection';
import { ALL_CATEGORIES, type StructuredContentDocument } from '../../src/domain/types';
import { prepareContentMigration } from '../../scripts/content-migration';

const legacy = {
  markdown: '# Синтетичні приклади\n## Зміст\n- Посилання\n## Космос\n- Вигадаймо назву сузір’я.\n- Змайструймо паперову комету.\n## Удома\n- Зробімо театр тіней.\n## Джерела\n- Довідка',
  excludedSections: ['Зміст', 'Джерела'],
};

function sample(): StructuredContentDocument {
  return toStructuredContent(legacy);
}

describe('structured activity records', () => {
  it('migrates the precise IDs, formatting and category order without the source document', () => {
    const before = parseCatalog(legacy);
    const content = sample();
    const after = parseCatalog(content);
    expect(content.schemaVersion).toBe(2);
    expect(content).not.toHaveProperty('markdown');
    expect(content).not.toHaveProperty('excludedSections');
    expect(after.categories).toEqual(before.categories);
    expect(new Map(after.ideas.map((idea) => [idea.id, idea]))).toEqual(new Map(before.ideas.map((idea) => [idea.id, idea])));
    expect(JSON.stringify(content)).not.toContain('Синтетичні приклади');
    expect(JSON.stringify(content)).not.toContain('Довідка');
  });

  it('keeps shared history intact when an idea or its category is renamed', () => {
    const content = sample();
    const before = parseCatalog(content);
    const seen = before.ideas[0]!;
    content.ideas[seen.id]!.markdown = 'Оновлена **ідея** з [посиланням](https://example.com).';
    content.categories[seen.categoryId]!.name = 'Нова назва';
    const after = parseCatalog(content);
    expect(after.ideas.find(({ id }) => id === seen.id)?.markdown).toContain('Оновлена **ідея**');
    const result = selectIdea(after, { seenIds: [seen.id], lastIdeaId: seen.id }, ALL_CATEGORIES, false, () => 0);
    expect(result.kind).toBe('drawn');
    if (result.kind !== 'drawn') throw new Error('Expected another activity');
    expect(result.idea.id).not.toBe(seen.id);
    expect(result.state.seenIds).toContain(seen.id);
  });

  it('treats map keys as identity and order as display order, independent of map insertion', () => {
    const content = sample();
    const original = parseCatalog(content);
    const categoryIds = Object.keys(content.categories);
    content.categories[categoryIds[0]!]!.order = 5;
    content.categories[categoryIds[1]!]!.order = 1;
    content.ideas = Object.fromEntries(Object.entries(content.ideas).reverse());
    const reordered = parseCatalog(content);
    expect(reordered.categories.map(({ id }) => id)).toEqual([...original.categories.map(({ id }) => id)].reverse());
    expect(reordered.ideas).toEqual(original.ideas);
  });

  it('supports adding/removing records and moving an idea without changing identity', () => {
    const content = sample();
    const ids = Object.keys(content.ideas);
    const categoryIds = Object.keys(content.categories);
    content.ideas[ids[0]!]!.categoryId = categoryIds[1]!;
    delete content.ideas[ids[1]!];
    const newId = 'f'.repeat(32);
    content.ideas[newId] = { categoryId: categoryIds[0]!, markdown: 'Нова пригода.' };
    const catalog = parseCatalog(content);
    const result = selectIdea(catalog, { seenIds: [ids[0]!, ids[1]!], lastIdeaId: ids[1]! }, ALL_CATEGORIES, false, () => 0);
    expect(catalog.ideas.find(({ id }) => id === ids[0])?.categoryId).toBe(categoryIds[1]);
    expect(catalog.ideas.some(({ id }) => id === newId)).toBe(true);
    expect(result.kind === 'drawn' && result.state.seenIds.includes(ids[1]!)).toBe(false);
    expect(result.kind === 'drawn' && result.state.seenIds.includes(ids[0]!)).toBe(true);
  });

  it('accepts empty maps and hides empty categories until they contain an idea', () => {
    expect(parseCatalog({ schemaVersion: 2, categories: {}, ideas: {} })).toEqual({ categories: [], ideas: [] });
    const content = sample();
    content.categories['e'.repeat(32)] = { name: 'Майбутні ідеї', order: 50 };
    expect(parseCatalog(content).categories).toHaveLength(2);
  });

  it('fails closed for unsupported versions and mixed legacy/structured documents', () => {
    expect(() => parseCatalog({ ...legacy, schemaVersion: 3 })).toThrow('unsupported schema');
    expect(() => parseCatalog({ ...sample(), ...legacy })).toThrow('only schemaVersion');
    expect(() => parseCatalog({ schemaVersion: 2, categories: [], ideas: {} })).toThrow('maps');
    expect(() => parseCatalog(null)).toThrow('missing or invalid');
  });

  it('rejects malformed identifiers, missing references, blank values and extra fields', () => {
    const cases: ((value: StructuredContentDocument) => void)[] = [
      (value) => { value.ideas.bad = { categoryId: Object.keys(value.categories)[0]!, markdown: 'Idea' }; },
      (value) => { value.ideas[Object.keys(value.ideas)[0]!]!.categoryId = '0'.repeat(32); },
      (value) => { value.ideas[Object.keys(value.ideas)[0]!]!.markdown = '  '; },
      (value) => { Object.assign(value.ideas[Object.keys(value.ideas)[0]!]!, { privateExtra: 'unexpected' }); },
      (value) => { value.categories[Object.keys(value.categories)[0]!]!.name = ''; },
      (value) => { value.categories[Object.keys(value.categories)[0]!]!.order = 0.5; },
      (value) => { value.categories[Object.keys(value.categories)[0]!]!.order = -1; },
      (value) => { value.categories[Object.keys(value.categories)[1]!]!.order = 0; },
    ];
    for (const change of cases) {
      const content = sample();
      change(content);
      expect(() => parseCatalog(content)).toThrow();
    }
  });

  it('bounds structured content by bytes, activity count and category count', () => {
    const bytes = sample();
    bytes.ideas[Object.keys(bytes.ideas)[0]!]!.markdown = 'я'.repeat(MAX_MARKDOWN_BYTES / 2);
    expect(() => parseCatalog(bytes)).toThrow('900 KB');
    const categories = sample();
    categories.categories = Object.fromEntries(Array.from({ length: 65 }, (_, index) => [index.toString(16).padStart(32, '0'), { name: 'Category', order: index }]));
    expect(() => parseCatalog(categories)).toThrow('64 categories');
    const ideas = sample();
    ideas.ideas = Object.fromEntries(Array.from({ length: 1_001 }, (_, index) => [index.toString(16).padStart(32, '0'), { categoryId: Object.keys(ideas.categories)[0]!, markdown: 'Idea' }]));
    expect(() => parseCatalog(ideas)).toThrow('1,000 activities');
  });
});

describe('private migration preparation', () => {
  it('produces a Firestore typed replacement payload and preserves prior draw IDs', () => {
    const migration = prepareContentMigration(legacy);
    const before = parseCatalog(legacy);
    const beforeState = { seenIds: [before.ideas[0]!.id], lastIdeaId: before.ideas[0]!.id };
    expect(migration.summary).toEqual({ schemaVersion: 2, categories: 2, activities: 3, idsPreserved: true });
    expect(migration.firestoreDocument.fields.schemaVersion).toEqual({ integerValue: '2' });
    expect(Object.keys(migration.firestoreDocument.fields)).toEqual(['schemaVersion', 'categories', 'ideas']);
    const ideas = migration.firestoreDocument.fields.ideas;
    expect(ideas && 'mapValue' in ideas && Object.keys(ideas.mapValue.fields)).toEqual(before.ideas.map(({ id }) => id));
    const draw = selectIdea(parseCatalog(migration.content), beforeState, ALL_CATEGORIES, false, () => 0);
    expect(draw.kind === 'drawn' && draw.idea.id).not.toBe(beforeState.lastIdeaId);
    expect(draw.kind === 'drawn' && draw.state.seenIds).toContain(beforeState.lastIdeaId);
    expect(beforeState.seenIds).toHaveLength(1);
  });

  it('refuses to prepare an empty replacement', () => {
    expect(() => prepareContentMigration({ markdown: '# No activities', excludedSections: [] })).toThrow('empty migration');
  });
});
