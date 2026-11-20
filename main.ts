import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const appSource = join(root, 'app');
const screenshotSource = join(root, 'screenshots');
const appDestination = join(output, 'app');
const screenshotDestination = join(output, 'screenshots');

function containsPath(parent, target) {
  const path = relative(parent, target);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !path.startsWith('/'));
}

if (
  output === root ||
  [appSource, screenshotSource, join(root, 'vendor'), join(root, 'scripts')].some((source) => containsPath(source, output))
) {
  throw new Error('MAKEFUN_OUTPUT_DIR must be separate from the entry source directories.');
}

mkdirSync(output, { recursive: true });
if (!existsSync(appSource) || !statSync(appSource).isDirectory()) {
  throw new Error('The entry needs its static app/ directory beside main.ts.');
}
rmSync(appDestination, { recursive: true, force: true });
rmSync(screenshotDestination, { recursive: true, force: true });
rmSync(join(output, 'dossier.json'), { force: true });
cpSync(appSource, appDestination, { recursive: true });
mkdirSync(screenshotDestination, { recursive: true });
if (existsSync(screenshotSource)) cpSync(screenshotSource, screenshotDestination, { recursive: true });

const dossier = buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(output, 'dossier.json'), dossier);
