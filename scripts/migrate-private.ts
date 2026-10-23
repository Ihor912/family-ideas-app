import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { prepareContentMigration } from './content-migration';

const args = process.argv.slice(2);
const force = args.includes('--force');
const [file, ...excludedSections] = args.filter((argument) => argument !== '--force');

async function main() {
  if (!file) throw new Error('Usage: npm run migrate:private -- /path/to/ideas.md "Excluded heading" ... [--force]');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const outputDirectory = new URL('../private/', import.meta.url);
  const outputs = [
    new URL('content-v2.json', outputDirectory),
    new URL('content-v2.firestore.json', outputDirectory),
    new URL('content-v2.migration.json', outputDirectory),
  ];

  // Private artifacts are never placed under public/, src/, or the build tree.
  // Refuse to continue if repository ignore rules no longer protect the outputs.
  for (const output of outputs) {
    try {
      execFileSync('git', ['check-ignore', '--quiet', fileURLToPath(output)], { cwd: root, stdio: 'ignore' });
    } catch {
      throw new Error('The private output directory must be ignored by Git before migration.');
    }
    if (!force) {
      const exists = await access(output).then(() => true, () => false);
      if (exists) throw new Error('Private migration output already exists. Review it, then use --force to replace it.');
    }
  }
  const markdown = await readFile(file, 'utf8');
  const prepared = prepareContentMigration({ markdown, excludedSections });
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  if ((await lstat(outputDirectory)).isSymbolicLink()) {
    throw new Error('The private output directory must not be a symbolic link.');
  }
  const contentJson = `${JSON.stringify(prepared.content, null, 2)}\n`;
  const firestoreJson = `${JSON.stringify(prepared.firestoreDocument, null, 2)}\n`;
  const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
  const manifest = {
    manifestVersion: 1,
    targetSchemaVersion: 2,
    originalMarkdownSha256: hash(markdown),
    excludedSections,
    structuredContentSha256: hash(contentJson),
    firestoreDocumentSha256: hash(firestoreJson),
    categories: prepared.summary.categories,
    activities: prepared.summary.activities,
    idsPreserved: true,
  };
  const flag = force ? 'w' : 'wx';
  await writeFile(outputs[0]!, contentJson, { flag, mode: 0o600 });
  await writeFile(outputs[1]!, firestoreJson, { flag, mode: 0o600 });
  await writeFile(outputs[2]!, `${JSON.stringify(manifest, null, 2)}\n`, { flag, mode: 0o600 });
  console.log(JSON.stringify({
    ...prepared.summary,
    outputs: ['private/content-v2.json', 'private/content-v2.firestore.json', 'private/content-v2.migration.json'],
    cloudModified: false,
    originalModified: false,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Content migration preparation failed.');
  process.exitCode = 1;
});
