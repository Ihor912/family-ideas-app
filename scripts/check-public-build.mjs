import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const forbidden = tracked.filter((file) => /(^|\/)(private\/|\.env(?!\.example$))|service-account|adminsdk|Idei_dlya_simeinoho_dozvillia/i.test(file));
if (forbidden.length) throw new Error('Private paths are tracked. Remove them from Git before publishing.');
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) { await inspect(file); continue; }
    if (/\.(md|map)$/.test(file)) throw new Error('Markdown or source map found in public build.');
    if (/\.(js|html|json)$/.test(file)) {
      const text = await readFile(file, 'utf8');
      if (/BEGIN PRIVATE KEY|firebase-adminsdk|demo-adult|Тестова експедиція/.test(text)) {
        throw new Error('Private credentials or development fixtures found in public build.');
      }
    }
  }
}
await inspect('dist');
console.log('Public build boundary verified: no private paths, admin credentials, maps, or demo fixture.');
