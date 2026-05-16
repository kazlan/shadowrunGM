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
  'public/assets/ui/source-world.svg',
  'public/assets/ui/source-sandbox.svg',
  'public/assets/characters/decker-placeholder.svg',
  'public/assets/defenses/ice-watcher.svg',
  'public/assets/programs/program-scan.svg',
  'public/assets/stats/stat-pulse.svg',
  'public/assets/stats/stat-veil.svg',
  'public/assets/stats/stat-lens.svg',
  'public/assets/stats/stat-shell.svg',
  'public/assets/logos/splash-shadowhack.svg',
  'public/assets/logos/logo-shadowhack.svg',
  'public/assets/backgrounds/bg-finance.svg',
  'public/assets/backgrounds/bg-default.svg',
  'scripts/generate-placeholders.mjs',
  'src/styles/theme.css',
  'src/game/mapGenerator.js',
  'src/game/nodeEvents.js',
  'src/ui/renderRunLog.js',
  'src/ui/renderDeckPanel.js',
  'src/ui/renderCompletionScreen.js',
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
  'src/world/deckStore.js',
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
const { nodeEvents } = await import('../src/game/nodeEvents.js');
const { reduceRun } = await import('../src/game/runEngine.js');
const { scoreRun } = await import('../src/game/runScoring.js');
const { getDangerTheme } = await import('../src/ui/dangerTheme.js');
const { projectSystemForRun } = await import('../src/game/systemView.js');
const { renderNodeMap } = await import('../src/ui/renderNodeMap.js');
const { renderDeckOverlay, renderDeckTrace } = await import('../src/ui/renderDeckPanel.js');
const { renderHelpOverlay, renderSettingsOverlay } = await import('../src/ui/renderHelpOverlay.js');
const { renderHud } = await import('../src/ui/renderHud.js');
const { renderScannerOverlay } = await import('../src/ui/renderScannerOverlay.js');
const { renderProgressPanel } = await import('../src/ui/renderProgress.js');
const { renderCompletionScreen } = await import('../src/ui/renderCompletionScreen.js');
const { addHostBookmark, awardRunCredits, createDefaultDeckProfile, getBookmarkCapacity, getStorageCapacity, upgradeDeckProfile } = await import('../src/world/deckStore.js');

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
const jackOutSystemAgain = generateSystem({
  rng: createRng(jackOutSeed),
  seedId: jackOutSeed.slice(0, 12),
  company: jackOutPlace,
  archetype: jackOutArchetype,
  valuation: valueCompany(jackOutPlace, jackOutArchetype, jackOutSeed),
});
if (JSON.stringify(jackOutSystem.nodes.map(({ id, kind, event }) => ({ id, kind, event }))) !== JSON.stringify(jackOutSystemAgain.nodes.map(({ id, kind, event }) => ({ id, kind, event })))) {
  throw new Error('Generated node events must be deterministic for the same host seed');
}
if (!jackOutSystem.nodes.some((node) => node.event === nodeEvents.archive.kind || node.event === nodeEvents.core.kind)) {
  throw new Error('Generated hosts should include extractable node events');
}
const jackOutRun = reduceRun(jackOutSystem, createInitialRunState(jackOutSystem), { type: 'jackOut' });
if (jackOutRun.status !== 'escaped') throw new Error('Jack-out from entry should escape instead of crashing');
if (!Number.isFinite(scoreRun(jackOutSystem, jackOutRun))) throw new Error('Jack-out run score should be finite');
const defaultDeck = createDefaultDeckProfile();
const upgradedShellDeck = { ...defaultDeck, deck: { ...defaultDeck.deck, shell: 4 }, programs: { ...defaultDeck.programs } };
const upgradedInitialRun = createInitialRunState(jackOutSystem, upgradedShellDeck);
if (upgradedInitialRun.maxIntegrity <= createInitialRunState(jackOutSystem).maxIntegrity) throw new Error('Shell deck upgrades should increase max integrity');
const richDeck = { ...defaultDeck, credits: 1000 };
const upgradedDeckResult = upgradeDeckProfile(richDeck, 'program', 'scan');
if (!upgradedDeckResult.changed || upgradedDeckResult.profile.programs.scan !== 2) throw new Error('Program upgrades should spend credits and increase rating');
const upgradedStorageResult = upgradeDeckProfile(richDeck, 'hardware', 'storage');
if (!upgradedStorageResult.changed || getStorageCapacity(upgradedStorageResult.profile) <= getStorageCapacity(defaultDeck)) throw new Error('Storage upgrades should increase loot capacity');
if (getBookmarkCapacity(defaultDeck) !== 3) throw new Error('Initial bookmark capacity should be 3');
const upgradedBookmarkResult = upgradeDeckProfile(richDeck, 'hardware', 'bookmarks');
if (!upgradedBookmarkResult.changed || getBookmarkCapacity(upgradedBookmarkResult.profile) <= getBookmarkCapacity(defaultDeck)) throw new Error('Bookmark upgrades should increase saved host capacity');
const bookmarkResult = addHostBookmark(defaultDeck, jackOutSystem);
if (!bookmarkResult.changed || bookmarkResult.profile.bookmarks.length !== 1) throw new Error('Successful hosts should be bookmarkable');
const rewardResult = awardRunCredits(defaultDeck, jackOutSystem, jackOutRun, scoreRun(jackOutSystem, jackOutRun));
if (rewardResult.reward <= 0 || rewardResult.profile.credits <= 0) throw new Error('Completed runs should award deck upgrade credits');
if (!renderCompletionScreen({ hostAlias: jackOutSystem.alias, reward: rewardResult.reward, score: 1234, lootTokens: 3, canBookmark: true, bookmarkCapacity: 3, bookmarkDecision: null }, defaultDeck).includes('Guardar host')) {
  throw new Error('Completion screen should prompt for bookmark saving');
}

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
if (!renderDeckTrace(upgradedDeckResult.profile, createInitialRunState(iceSystem, upgradedDeckResult.profile), 'Scan mejorado.').includes('deck-memory')) throw new Error('Deck trace should show segmented memory');
const deckOverlayHtml = renderDeckOverlay(true, upgradedDeckResult.profile, 'Scan mejorado.');
if (!deckOverlayHtml.includes('Software cargado')) throw new Error('Deck overlay should render loaded software');
if (!deckOverlayHtml.includes('deck-software-grid')) throw new Error('Deck software should render as a card grid');
if (!deckOverlayHtml.includes('/assets/stats/stat-pulse.svg')) throw new Error('Deck stats should use custom SVG icons');
const hudHtml = renderHud(iceSystem, createInitialRunState(iceSystem));
if (!hudHtml.includes('data-action="toggleSettings"') || !hudHtml.includes('settings-icon')) throw new Error('HUD should expose settings cog next to jack-out');
if (hudHtml.includes('data-action="toggleMusic"') || hudHtml.includes('data-action="toggleSfx"')) throw new Error('Audio controls should live inside settings, not the main HUD');
const settingsHtml = renderSettingsOverlay(true, { music: true, sfx: false, musicVolume: 0.42, sfxVolume: 0.18 });
if (!settingsHtml.includes('settings-audio') || !settingsHtml.includes('data-audio-volume="music"') || !settingsHtml.includes('value="42"')) throw new Error('Settings overlay should render real music volume controls');
if (!settingsHtml.includes('data-action="toggleMusic"') || !settingsHtml.includes('data-action="openHelp"')) throw new Error('Settings overlay should contain audio toggles and a help button');
if (settingsHtml.includes('help-tabs') || settingsHtml.includes('help-panel__content')) throw new Error('Settings overlay should not embed the help manual');
if (!renderHelpOverlay(true, 'deck').includes('help-tabs')) throw new Error('Help overlay should render compact tab navigation in its own dialog');
const scannerHtml = renderScannerOverlay({
  isOpen: true,
  places: [
    { provider: 'osm', providerId: 'node/1', name: 'Real Shop', category: 'shop', address: 'Calle Real 1' },
    { provider: 'manual', providerId: 'demo/1', name: 'Demo Shop', category: 'shop' },
  ],
  selectedPlace: { providerId: 'node/1' },
  locationMessage: 'Scanner activo.',
  describeTarget: (place) => place.category,
  bookmarks: [{ provider: 'osm', providerId: 'node/2', hostAlias: 'BOOKMARK', name: 'Saved Real', address: 'Calle Bookmark 2' }],
  bookmarkCapacity: 3,
});
if (!scannerHtml.includes('/assets/ui/source-world.svg') || !scannerHtml.includes('/assets/ui/source-sandbox.svg')) throw new Error('Scanner should identify real world and sandbox host sources');
if (!scannerHtml.includes('Mundo real') || !scannerHtml.includes('Sandbox') || !scannerHtml.includes('Calle Real 1')) throw new Error('Scanner should show source labels and real-world anchor data when available');
renderProgressPanel({ valueTier: 'B', companyValue: 60, completedRuns: 2, bestScore: 140 }, []);

const eventSystem = {
  seedId: 'event-check',
  alias: 'EVENT CHECK',
  company: jackOutPlace,
  archetype: jackOutArchetype,
  valuation: { score: 60, tier: 'B' },
  effectiveSecurity: 4,
  entryNodeId: 'n-0',
  coreNodeId: 'n-5',
  nodes: [
    { id: 'n-0', kind: 'entry', state: 'visited', x: 10, y: 50, risk: 1 },
    { id: 'n-1', kind: 'camera', event: 'camera', state: 'scanned', x: 26, y: 50, risk: 1 },
    { id: 'n-2', kind: 'data', event: 'decoy', state: 'scanned', x: 42, y: 50, risk: 1 },
    { id: 'n-3', kind: 'firewall', event: 'gate', state: 'scanned', x: 58, y: 50, risk: 1 },
    { id: 'n-4', kind: 'firewall', event: 'trap', state: 'unknown', x: 74, y: 50, risk: 1 },
    { id: 'n-5', kind: 'core', event: 'core', state: 'unknown', x: 90, y: 50, risk: 1 },
  ],
  edges: [
    { from: 'n-0', to: 'n-1' },
    { from: 'n-0', to: 'n-2' },
    { from: 'n-0', to: 'n-3' },
    { from: 'n-3', to: 'n-4' },
    { from: 'n-4', to: 'n-5' },
  ],
};
const eventInitialRun = createInitialRunState(eventSystem);
const cameraRun = reduceRun(eventSystem, eventInitialRun, { type: 'move', nodeId: 'n-1' });
if (cameraRun.alert < 2) throw new Error('Camera event should add pressure after moving into the node');
const ghostedCameraRun = reduceRun(eventSystem, cameraRun, { type: 'runProgram', program: 'ghost' });
if (!ghostedCameraRun.resolvedEvents.includes('n-1')) throw new Error('Ghost should resolve camera events');
if (ghostedCameraRun.integrity !== cameraRun.integrity) throw new Error('Camera Ghost resolution should not burn shell');

const decoyScanRun = reduceRun(eventSystem, { ...eventInitialRun, currentNodeId: 'n-2', nodeStates: { ...eventInitialRun.nodeStates, 'n-2': 'visited' } }, { type: 'runProgram', program: 'scan' });
if (!decoyScanRun.resolvedEvents.includes('n-2')) throw new Error('Scan should resolve decoy events');
const cleanedDecoyExtractRun = reduceRun(eventSystem, decoyScanRun, { type: 'runProgram', program: 'extract' });
if (cleanedDecoyExtractRun.hasPayload) throw new Error('Cleaned decoys should stay non-extractable');
const decoyExtractRun = reduceRun(eventSystem, { ...eventInitialRun, currentNodeId: 'n-2', nodeStates: { ...eventInitialRun.nodeStates, 'n-2': 'visited' } }, { type: 'runProgram', program: 'extract' });
if (decoyExtractRun.hasPayload) throw new Error('Extracting a decoy should not grant payload');
if (decoyExtractRun.alert < 2 || decoyExtractRun.trace < 1) throw new Error('Extracting a decoy should raise alert and trace');

const gateRun = reduceRun(eventSystem, { ...eventInitialRun, currentNodeId: 'n-3', nodeStates: { ...eventInitialRun.nodeStates, 'n-3': 'visited' } }, { type: 'runProgram', program: 'spike' });
if (!gateRun.resolvedEvents.includes('n-3')) throw new Error('Spike should resolve gate events');
if (gateRun.nodeStates['n-4'] !== 'scanned') throw new Error('Resolved gates should reveal connected unknown nodes');
const trapRun = reduceRun(eventSystem, { ...eventInitialRun, currentNodeId: 'n-4', nodeStates: { ...eventInitialRun.nodeStates, 'n-4': 'visited' } }, { type: 'runProgram', program: 'shield' });
if (!trapRun.resolvedEvents.includes('n-4')) throw new Error('Shield should resolve trap events');
const lootRun = reduceRun(eventSystem, { ...eventInitialRun, currentNodeId: 'n-5', nodeStates: { ...eventInitialRun.nodeStates, 'n-5': 'visited' } }, { type: 'runProgram', program: 'extract' });
if (lootRun.lootTokens !== 3 || !lootRun.hasPayload) throw new Error('Core extraction should load loot tokens into deck memory');
const fullMemoryRun = reduceRun(eventSystem, { ...eventInitialRun, currentNodeId: 'n-5', lootTokens: eventInitialRun.maxLootTokens, nodeStates: { ...eventInitialRun.nodeStates, 'n-5': 'visited' } }, { type: 'runProgram', program: 'extract' });
if (fullMemoryRun.lootTokens !== eventInitialRun.maxLootTokens || fullMemoryRun.hasPayload) throw new Error('Full memory should block new payload extraction');

const ghostPressureRun = reduceRun(iceSystem, { ...createInitialRunState(iceSystem), alert: 3, trace: 2 }, { type: 'runProgram', program: 'ghost' });
if (ghostPressureRun.alert !== 2 || ghostPressureRun.trace !== 1) throw new Error('Ghost should reduce alert and trace when pressure exists');
if (ghostPressureRun.integrity !== 9) throw new Error('Ghost should cost one shell when hiding an active signature');
const ghostIdleRun = reduceRun(iceSystem, createInitialRunState(iceSystem), { type: 'runProgram', program: 'ghost' });
if (ghostIdleRun.turn !== 1 || ghostIdleRun.integrity !== 10) throw new Error('Ghost should not be spammable at zero pressure');

const lowDanger = getDangerTheme(createInitialRunState(iceSystem));
const highDanger = getDangerTheme({ ...createInitialRunState(iceSystem), alert: 10, trace: 8, integrity: 1 });
if (Number(lowDanger.level) >= Number(highDanger.level)) throw new Error('Danger theme should increase as run pressure rises');
if (!lowDanger.color.includes('hsl(214') || !highDanger.color.includes('hsl(0')) throw new Error('Danger theme should scale from blue to bright red');

const audioDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
try {
  Object.defineProperty(globalThis, 'AudioContext', { value: MockAudioContext, configurable: true });
  const { createAudioDirector, createNativeMusicDescriptor } = await import('../src/audio/proceduralAudio.js?check-audio');
  const director = createAudioDirector();
  const initialProfile = director.updateRunState(createInitialRunState(iceSystem), iceSystem);
  if (initialProfile.level !== 'low') throw new Error('Initial audio profile should start at low pressure');
  const mediumAlertProfile = director.updateRunState({ ...createInitialRunState(iceSystem), alert: 4 }, iceSystem);
  if (mediumAlertProfile.level !== 'medium') throw new Error('Medium alert should make audio more dramatic');
  const hostProfile = { variant: initialProfile.hostVariant, tempoOffset: 0 };
  const lowScore = createNativeMusicDescriptor(initialProfile, hostProfile);
  const mediumScore = createNativeMusicDescriptor(mediumAlertProfile, hostProfile);
  if (!lowScore.startsWith('native-web-audio://')) throw new Error('Music should use native WebAudio descriptor instead of Strudel');
  if (!mediumScore.includes('stage=1')) throw new Error('Native music descriptor should react to pressure stage');
  if (!(await director.toggleMusic())) throw new Error('Music should enable with mock AudioContext');
  if (!director.isMusicEnabled() || director.isSfxEnabled()) throw new Error('Music and SFX toggles should be independent');
  if (director.setMusicVolume(0.42) !== 0.42 || director.getState().musicVolume !== 0.42) throw new Error('Music volume should be adjustable');
  if (director.setSfxVolume(0.18) !== 0.18 || director.getState().sfxVolume !== 0.18) throw new Error('SFX volume should be adjustable');
  if (director.setMusicVolume(2) !== 1 || director.setSfxVolume(-1) !== 0) throw new Error('Audio volume should be clamped');
  if (!(await director.toggleSfx())) throw new Error('SFX should enable with mock AudioContext');
  if (!director.getState().music || !director.getState().sfx) throw new Error('Audio state should expose separate music and SFX flags');
  await director.play('jackOut');
  await director.play('success');
  const highProfile = director.updateRunState({ ...createInitialRunState(iceSystem), alert: 10, trace: 8, integrity: 1 }, iceSystem);
  if (highProfile.level !== 'high') throw new Error('High danger should move audio profile to high pressure');
  const highScore = createNativeMusicDescriptor(highProfile, hostProfile);
  if (!highScore.includes('stage=3')) throw new Error('High danger should move native music descriptor to stage 3');
  await director.play('scan');
  await director.play('spike');
  await director.play('ghost');
  await director.play('shield');
  await director.play('extract');
  if (!director.isEnabled()) throw new Error('Audio director should remain enabled after jack-out sounds');
  if (await director.toggleSfx()) throw new Error('SFX should disable cleanly');
  if (await director.toggleMusic()) throw new Error('Music should disable cleanly');
  if (director.isEnabled()) throw new Error('Audio director should be fully disabled after both toggles are off');
} finally {
  if (audioDescriptor) Object.defineProperty(globalThis, 'AudioContext', audioDescriptor);
  else delete globalThis.AudioContext;
}

console.log(`Checked ${requiredFiles.length} required files, PWA manifest, seed hashing fallback, jack-out/ICE/event/deck flows, danger theme, and audio director.`);
