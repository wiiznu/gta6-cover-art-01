import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

const root = import.meta.dirname;
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
mkdirSync(output, { recursive: true });

// A rerun must not retain files from an earlier app or screenshot set.
rmSync(join(output, 'app'), { recursive: true, force: true });
rmSync(join(output, 'screenshots'), { recursive: true, force: true });
cpSync(join(root, 'app'), join(output, 'app'), { recursive: true });
const screenshotSource = join(root, 'screenshots');
const screenshotTarget = join(output, 'screenshots');
if (existsSync(screenshotSource)) {
  cpSync(screenshotSource, screenshotTarget, { recursive: true });
} else {
  mkdirSync(screenshotTarget, { recursive: true });
}

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
