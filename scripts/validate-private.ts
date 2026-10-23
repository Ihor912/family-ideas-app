import { readFile } from 'node:fs/promises';
import { parseCatalog } from '../src/domain/catalog';

const [file, ...excludedSections] = process.argv.slice(2);
if (!file) {
  console.error('Usage: npm run validate:private -- /path/to/ideas.md "Excluded heading" ...');
  process.exitCode = 1;
} else {
  try {
    const markdown = await readFile(file, 'utf8');
    const catalog = parseCatalog({ markdown, excludedSections });
    // Print aggregate validation only. Private titles and activities stay local.
    console.log(JSON.stringify({
      valid: true,
      bytes: new TextEncoder().encode(markdown).length,
      categories: catalog.categories.length,
      activities: catalog.ideas.length,
      uniqueIds: new Set(catalog.ideas.map(({ id }) => id)).size,
    }, null, 2));
    if (catalog.ideas.length === 0) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Validation failed.');
    process.exitCode = 1;
  }
}
