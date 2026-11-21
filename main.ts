import { cpSync, existsSync, mkdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

const repository = realpathSync(import.meta.dirname);

// Resolve existing ancestors too, so a symlink cannot bypass the overlap guard.
function physicalPath(path) {
  let ancestor = resolve(path);
  const suffix = [];
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) throw new Error('No existing ancestor for output directory.');
    suffix.unshift(basename(ancestor));
    ancestor = parent;
  }
  return join(realpathSync(ancestor), ...suffix);
}
const destination = physicalPath(process.env.MAKEFUN_OUTPUT_DIR || '/output');

function includesPath(parent, child) {
  const difference = relative(parent, child);
  return difference === '' || (!isAbsolute(difference) && difference !== '..' && !difference.startsWith(`..${sep}`));
}

// Guard the source tree before replacing any previous delivery artifacts.
if (includesPath(repository, destination) || includesPath(destination, repository)) {
  throw new Error('Choose an output directory outside the repository, without overlap.');
}
mkdirSync(destination, { recursive: true });
const finalDossier = join(destination, 'dossier.json');
const pendingDossier = join(destination, '.sunset-dossier.pending');
rmSync(finalDossier, { force: true });
rmSync(pendingDossier, { force: true });

for (const directory of ['app', 'screenshots']) {
  const source = join(repository, directory);
  const target = join(destination, directory);
  rmSync(target, { recursive: true, force: true });
  if (existsSync(source)) cpSync(source, target, { recursive: true });
  else mkdirSync(target, { recursive: true });
}

// Missing screenshots intentionally remain a kit error, never synthetic evidence.
const bytes = buildDossier(destination, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(pendingDossier, bytes);
renameSync(pendingDossier, finalDossier);
