import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'public/manifest.webmanifest',
  'public/service-worker.js',
  'src/app/main.js',
  'src/audio/proceduralAudio.js',
  'src/assets/assetRegistry.js',
  'public/assets/README.md',
  'public/assets/ui/overlay-scanlines.svg',
  'public/assets/characters/decker-placeholder.svg',
  'public/assets/defenses/ice-watcher.svg',
  'public/assets/programs/program-scan.svg',
  'public/assets/logos/splash-shadowhack.svg',
  'public/assets/logos/logo-shadowhack.svg',
  'public/assets/backgrounds/bg-finance.svg',
  'public/assets/backgrounds/bg-default.svg',
  'scripts/generate-placeholders.mjs',
  'src/styles/theme.css',
  'src/game/mapGenerator.js',
  'src/ui/renderRunLog.js',
  'src/ui/renderHelpOverlay.js',
  'src/ui/renderScannerOverlay.js',
  'src/ui/html.js',
  'src/game/systemView.js',
  'src/game/runState.js',
  'src/game/runEngine.js',
  'src/ui/renderProgress.js',
  'src/world/progressStore.js',
  'src/game/runScoring.js',
  'src/world/companySeed.js',
  'src/world/companyValuation.js',
  'src/world/overpassProvider.js',
  'arte/prompts-v1.md',
  'docs/plan-v1.md',
  'docs/assets.md',
  'docs/company-valuation.md',
];

for (const file of requiredFiles) {
  await readFile(file, 'utf8');
}

const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
if (manifest.orientation !== 'portrait') throw new Error('Manifest orientation must be portrait');
if (!['fullscreen', 'standalone'].includes(manifest.display)) throw new Error('Manifest display must be fullscreen or standalone');

const { hashCompany } = await import('../src/world/companySeed.js');
const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
try {
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  const fallbackSeed = await hashCompany({
    provider: 'manual',
    providerId: 'demo-crash-check',
    name: 'Clínica Norte',
    category: 'medical clinic',
    lat: 40.41715,
    lon: -3.70412,
  });
  if (!/^[a-f0-9]{64}$/.test(fallbackSeed.seedHex)) throw new Error('Fallback seed hash must produce 64 hex characters');
  if (fallbackSeed.seedId !== fallbackSeed.seedHex.slice(0, 12)) throw new Error('Fallback seed id must derive from seed hash');
} finally {
  if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
  else delete globalThis.crypto;
}

console.log(`Checked ${requiredFiles.length} required files, PWA manifest, and seed hashing fallback.`);
