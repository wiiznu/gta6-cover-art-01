import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

const root = import.meta.dirname;
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

function contains(parent, child) {
  const path = relative(parent, child);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

// Reject overlap before removing previous generated artifacts.
if (contains(root, output) || contains(output, root)) {
  throw new Error('MAKEFUN_OUTPUT_DIR must be outside the repository tree.');
}
mkdirSync(output, { recursive: true });
// A failed rebuild must never leave an earlier successful dossier beside new files.
rmSync(join(output, 'dossier.json'), { force: true });
rmSync(join(output, '.dossier.pending'), { force: true });
for (const name of ['app', 'screenshots']) {
  const target = join(output, name);
  rmSync(target, { recursive: true, force: true });
  const source = join(root, name);
  if (existsSync(source)) cpSync(source, target, { recursive: true });
  else mkdirSync(target, { recursive: true });
}

// The kit intentionally rejects missing screenshots; never fabricate evidence.
const dossier = buildDossier(output, {
  text_max_bytes: 160 * 1024,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  app_max_files: 993,
  app_max_bytes: 48 * 1024 * 1024,
  app_path_max_bytes: 1000,
});
const pending = join(output, '.dossier.pending');
writeFileSync(pending, dossier);
renameSync(pending, join(output, 'dossier.json'));
