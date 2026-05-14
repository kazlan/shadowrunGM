import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'public/manifest.webmanifest',
  'public/service-worker.js',
  'src/app/main.js',
  'src/styles/theme.css',
  'src/game/mapGenerator.js',
  'src/ui/renderRunLog.js',
  'src/ui/html.js',
  'src/game/systemView.js',
  'src/game/runState.js',
  'src/game/runEngine.js',
  'src/world/companySeed.js',
  'arte/prompts-v1.md',
  'docs/plan-v1.md',
];

for (const file of requiredFiles) {
  await readFile(file, 'utf8');
}

const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
if (manifest.orientation !== 'portrait') throw new Error('Manifest orientation must be portrait');
if (!['fullscreen', 'standalone'].includes(manifest.display)) throw new Error('Manifest display must be fullscreen or standalone');

console.log(`Checked ${requiredFiles.length} required files and PWA manifest.`);
