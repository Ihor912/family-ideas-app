import { describe, expect, it } from 'vitest';
import { CatalogError, MAX_MARKDOWN_BYTES, parseCatalog } from '../../src/domain/catalog';

describe('parseCatalog', () => {
  it('selects actual H2 activity lists and keeps rich nested content together', () => {
    const catalog = parseCatalog({
      markdown: `# Родинні пригоди

- A preface item is not an activity.

## Зміст
- [Космос](#космос)

## **Космос**
- Змайструвати **ракету**.
  - Папір
  - Ножиці

  Потім придумати назву.
- Намалювати [зоряне небо](https://example.com).

### Ще пригоди
1. Вигадати нову планету.

## Ресурси
- [Посилання](https://example.com)

## Удома
- Влаштувати театр тіней.

# Додаток
- This appendix is not an activity.
`,
      excludedSections: [' зміст ', 'РЕСУРСИ'],
    });
    expect(catalog.categories.map(({ name, count }) => ({ name, count }))).toEqual([
      { name: 'Космос', count: 3 },
      { name: 'Удома', count: 1 },
    ]);
    expect(catalog.ideas).toHaveLength(4);
    expect(catalog.ideas[0]?.markdown).toContain('**ракету**');
    expect(catalog.ideas[0]?.markdown).toContain('- Папір');
    expect(catalog.ideas[0]?.markdown).toContain('Потім придумати назву.');
    expect(catalog.ideas[1]?.markdown).toContain('[зоряне небо](https://example.com)');
    expect(catalog.ideas.every(({ id }) => /^[0-9a-f]{32}$/.test(id))).toBe(true);
  });

  it('keeps IDs stable through reordered lists and equivalent list markers', () => {
    const first = parseCatalog({ markdown: '## Ігри\n- Перша ідея\n- Друга ідея', excludedSections: [] });
    const second = parseCatalog({ markdown: '## Ігри\n* Друга ідея\n* Перша ідея', excludedSections: [] });
    expect(first.categories[0]?.id).toBe(second.categories[0]?.id);
    expect(first.ideas.map(({ id }) => id)).toEqual(second.ideas.map(({ id }) => id).reverse());
  });

  it('deduplicates repeated ideas in a category without merging distinct categories', () => {
    const catalog = parseCatalog({
      markdown: '## Ігри\n- Намалювати сонце\n- Намалювати сонце\n\n## Творчість\n- Намалювати сонце',
      excludedSections: [],
    });
    expect(catalog.ideas).toHaveLength(2);
    expect(new Set(catalog.ideas.map(({ id }) => id)).size).toBe(2);
    expect(catalog.categories.map(({ count }) => count)).toEqual([1, 1]);
  });

  it('does not treat code fences, blockquoted lists or empty sections as activities', () => {
    const catalog = parseCatalog({
      markdown: '## Порожньо\n```md\n- Not an activity\n```\n\n> - A quotation\n\n## Ігри\n- Справжня ідея',
      excludedSections: [],
    });
    expect(catalog.ideas).toHaveLength(1);
    expect(catalog.categories.map(({ name }) => name)).toEqual(['Ігри']);
  });

  it('returns an empty catalog for a valid document without activities', () => {
    expect(parseCatalog({ markdown: '# Назва\nНемає ідей.', excludedSections: [] })).toEqual({
      ideas: [], categories: [],
    });
  });

  it('rejects malformed documents and enforces size in UTF-8 bytes', () => {
    expect(() => parseCatalog({ markdown: 'text', excludedSections: null } as never)).toThrow(CatalogError);
    expect(() => parseCatalog({ markdown: 42, excludedSections: [] } as never)).toThrow(CatalogError);
    expect(() => parseCatalog({
      markdown: 'я'.repeat(MAX_MARKDOWN_BYTES / 2 + 1), excludedSections: [],
    })).toThrow('900 KB');
  });

  it('bounds unique activities to the shared history limit', () => {
    expect(() => parseCatalog({
      markdown: `## Ідеї\n${Array.from({ length: 1_001 }, (_, i) => `- Ідея ${i}`).join('\n')}`,
      excludedSections: [],
    })).toThrow('1,000 activities');
  });
});
