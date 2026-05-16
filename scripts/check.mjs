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
  'src/ui/dangerTheme.js',
  'src/ui/renderNodeMap.js',
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


class MockAudioParam {
  constructor(value = 1) {
    this.value = value;
  }

  setValueAtTime(value) {
    if (value <= 0) throw new Error('AudioParam value must stay positive for exponential ramps');
    this.value = value;
  }

  linearRampToValueAtTime(value) {
    if (value <= 0) throw new Error('AudioParam value must stay positive for linear ramps');
    this.value = value;
  }

  exponentialRampToValueAtTime(value) {
    if (this.value <= 0 || value <= 0) throw new Error('AudioParam exponential ramps require positive values');
    this.value = value;
  }
}

class MockAudioNode {
  connect() {}
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super();
    this.frequency = new MockAudioParam(440);
    this.type = 'sine';
    this.started = false;
  }

  start() {
    this.started = true;
  }

  stop() {
    if (!this.started) {
      const error = new Error('Cannot stop before start');
      error.name = 'InvalidStateError';
      throw error;
    }
    this.started = false;
  }
}

class MockGainNode extends MockAudioNode {
  constructor() {
    super();
    this.gain = new MockAudioParam(1);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor() {
    super();
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1);
    this.type = 'lowpass';
  }
}

class MockDelayNode extends MockAudioNode {
  constructor() {
    super();
    this.delayTime = new MockAudioParam(0.1);
  }
}

class MockBufferSourceNode extends MockAudioNode {
  start() {}
}

class MockAudioContext {
  constructor() {
    this.currentTime = 1;
    this.sampleRate = 8000;
    this.state = 'suspended';
    this.destination = new MockAudioNode();
  }

  async resume() {
    this.state = 'running';
  }

  createGain() { return new MockGainNode(); }
  createOscillator() { return new MockOscillatorNode(); }
  createBiquadFilter() { return new MockBiquadFilterNode(); }
  createDelay() { return new MockDelayNode(); }
  createBufferSource() { return new MockBufferSourceNode(); }
  createBuffer(channels, size) {
    return {
      channels,
      size,
      getChannelData() { return new Float32Array(size); },
    };
  }
}


const { demoPlaces } = await import('../src/world/placeProvider.js');
const { classifyCompany } = await import('../src/world/companyArchetypes.js');
const { valueCompany } = await import('../src/world/companyValuation.js');
const { createRng } = await import('../src/game/rng.js');
const { generateSystem } = await import('../src/game/mapGenerator.js');
const { createInitialRunState } = await import('../src/game/runState.js');
const { reduceRun } = await import('../src/game/runEngine.js');
const { scoreRun } = await import('../src/game/runScoring.js');
const { getDangerTheme } = await import('../src/ui/dangerTheme.js');
const { projectSystemForRun } = await import('../src/game/systemView.js');
const { renderNodeMap } = await import('../src/ui/renderNodeMap.js');

const jackOutPlace = demoPlaces[0];
const jackOutSeed = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const jackOutArchetype = classifyCompany(jackOutPlace);
const jackOutSystem = generateSystem({
  rng: createRng(jackOutSeed),
  seedId: jackOutSeed.slice(0, 12),
  company: jackOutPlace,
  archetype: jackOutArchetype,
  valuation: valueCompany(jackOutPlace, jackOutArchetype, jackOutSeed),
});
const jackOutRun = reduceRun(jackOutSystem, createInitialRunState(jackOutSystem), { type: 'jackOut' });
if (jackOutRun.status !== 'escaped') throw new Error('Jack-out from entry should escape instead of crashing');
if (!Number.isFinite(scoreRun(jackOutSystem, jackOutRun))) throw new Error('Jack-out run score should be finite');

const iceSystem = {
  seedId: 'ice-check',
  alias: 'ICE CHECK',
  company: jackOutPlace,
  archetype: jackOutArchetype,
  valuation: { score: 60, tier: 'B' },
  effectiveSecurity: 4,
  entryNodeId: 'n-0',
  coreNodeId: 'n-1',
  nodes: [
    { id: 'n-0', kind: 'entry', state: 'visited', x: 18, y: 50, risk: 1 },
    { id: 'n-1', kind: 'core', state: 'scanned', x: 72, y: 50, risk: 1, ice: 'watcher' },
  ],
  edges: [{ from: 'n-0', to: 'n-1' }],
};
const movedIntoIce = reduceRun(iceSystem, createInitialRunState(iceSystem), { type: 'move', nodeId: 'n-1' });
const killedIceRun = reduceRun(iceSystem, movedIntoIce, { type: 'runProgram', program: 'spike' });
if (killedIceRun.status !== 'exploring') throw new Error('Successful spike should return to exploring after neutralizing ICE');
if (!killedIceRun.neutralizedIce.includes('n-1')) throw new Error('Successful spike should mark ICE as neutralized');
renderNodeMap(projectSystemForRun(iceSystem, killedIceRun), killedIceRun);

const lowDanger = getDangerTheme(createInitialRunState(iceSystem));
const highDanger = getDangerTheme({ ...createInitialRunState(iceSystem), alert: 10, trace: 8, integrity: 1 });
if (Number(lowDanger.level) >= Number(highDanger.level)) throw new Error('Danger theme should increase as run pressure rises');
if (!lowDanger.color.includes('hsl(214') || !highDanger.color.includes('hsl(0')) throw new Error('Danger theme should scale from blue to bright red');

const audioDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
try {
  Object.defineProperty(globalThis, 'AudioContext', { value: MockAudioContext, configurable: true });
  const { createAudioDirector } = await import('../src/audio/proceduralAudio.js?check-audio');
  const director = createAudioDirector();
  if (!(await director.toggle())) throw new Error('Audio director should enable with mock AudioContext');
  await director.play('jackOut');
  await director.play('success');
  if (!director.isEnabled()) throw new Error('Audio director should remain enabled after jack-out sounds');
  if (await director.toggle()) throw new Error('Audio director should disable cleanly');
} finally {
  if (audioDescriptor) Object.defineProperty(globalThis, 'AudioContext', audioDescriptor);
  else delete globalThis.AudioContext;
}

console.log(`Checked ${requiredFiles.length} required files, PWA manifest, seed hashing fallback, jack-out/ICE flows, danger theme, and audio director.`);
