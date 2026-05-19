import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  '.env.example',
  'firebase.json',
  'functions/package.json',
  'functions/.env.example',
  'functions/index.js',
  'functions/src/targetSearch.js',
  'functions/test/targetSearch.test.mjs',
  'public/manifest.webmanifest',
  'public/service-worker.js',
  'src/app/main.js',
  'src/audio/proceduralAudio.js',
  'src/audio/adaptiveMusicDirector.js',
  'src/firebase/firebaseConfig.js',
  'src/firebase/firebaseClient.js',
  'src/firebase/authClient.js',
  'src/firebase/cloudPersistence.js',
  'src/firebase/cloudSync.js',
  'src/firebase/messagingClient.js',
  'src/assets/assetRegistry.js',
  'public/assets/README.md',
  'public/assets/ui/overlay-scanlines.svg',
  'public/assets/ui/source-world.svg',
  'public/assets/ui/source-sandbox.svg',
  'public/assets/characters/decker-placeholder.svg',
  'public/assets/avatars/avatar-runner-01.png',
  'public/assets/avatars/avatar-runner-36.png',
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
  'src/ui/dangerTheme.js',
  'src/ui/renderNodeMap.js',
  'src/ui/renderHelpOverlay.js',
  'src/ui/renderScannerOverlay.js',
  'src/ui/themeStore.js',
  'src/ui/html.js',
  'src/game/systemView.js',
  'src/game/runState.js',
  'src/game/runEngine.js',
  'src/world/progressStore.js',
  'src/world/deckStore.js',
  'src/game/runScoring.js',
  'src/world/companySeed.js',
  'src/world/companyValuation.js',
  'src/world/overpassProvider.js',
  'propuestas/prompts-v1.md',
  'docs/plan-v1.md',
  'docs/assets.md',
  'docs/company-valuation.md',
  'docs/firebase.md',
];

const requiredBinaryFiles = [
  'public/assets/music/base_loop.mp3',
  'public/assets/music/pulse_loop.mp3',
  'public/assets/music/threat_loop.mp3',
  'public/assets/music/ice_loop.mp3',
  'public/assets/music/extract_loop.mp3',
  'public/assets/music/success_stinger.mp3',
  'public/assets/music/failure_stinger.mp3',
];

for (const file of requiredFiles) {
  await readFile(file, 'utf8');
}
for (const file of requiredBinaryFiles) {
  const bytes = await readFile(file);
  if (bytes.length < 1000) throw new Error(`Audio asset is unexpectedly small: ${file}`);
}

const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
if (manifest.orientation !== 'portrait') throw new Error('Manifest orientation must be portrait');
if (!['fullscreen', 'standalone'].includes(manifest.display)) throw new Error('Manifest display must be fullscreen or standalone');
const mainSource = await readFile('src/app/main.js', 'utf8');
const envExample = await readFile('.env.example', 'utf8');
const firebaseJson = JSON.parse(await readFile('firebase.json', 'utf8'));
if (!firebaseJson.functions?.source || firebaseJson.functions.source !== 'functions') throw new Error('Firebase config should deploy the backend Functions source');
if (!envExample.includes('VITE_TARGETS_ENDPOINT=')) throw new Error('Env example should expose optional targets backend endpoint');
const authSource = await readFile('src/firebase/authClient.js', 'utf8');
if (authSource.includes('signInWithPopup') || !authSource.includes('signInWithRedirect') || !authSource.includes('linkWithRedirect') || !authSource.includes('getRedirectResult')) {
  throw new Error('Google auth should use redirect flow and support guest-to-Google linking');
}
if (!mainSource.includes('mapPointers: new Map()') || !mainSource.includes('startMapPinch') || !mainSource.includes('zoomMapAtPoint')) throw new Error('Node map should keep pinch zoom support wired into pointer handling');
if (!mainSource.includes('mapBounds') || !mainSource.includes('getMapBounds') || !mainSource.includes('MAP_GRAPH_OFFSET_Y')) throw new Error('Node map should derive its gesture bounds from the generated graph');
const scanLocalBody = mainSource.match(/async function scanLocalTargets\(\) \{[\s\S]*?\n\}/)?.[0] ?? '';
if (scanLocalBody.includes('startRun(') || !scanLocalBody.includes('appState.isScannerOpen = true;')) throw new Error('Local scanner should keep the target picker open instead of auto-starting a run');
const locationSource = await readFile('src/location/locationService.js', 'utf8');
if (!locationSource.includes('getGeolocationPermissionState') || !locationSource.includes('bloqueado en el navegador') || !mainSource.includes('scannerPermissionMessage')) throw new Error('Local scanner should explain blocked geolocation permissions before falling back');
const overpassSource = await readFile('src/world/overpassProvider.js', 'utf8');
if (!overpassSource.includes('nwr["name"]["tourism"]') || !overpassSource.includes('nwr["name"]["healthcare"]') || !mainSource.includes('EXPANDED_SCAN_RADIUS')) throw new Error('Local scanner should broaden OSM target searches before using demo fallback');
if (!mainSource.includes('VALENCIA_TEST_POSITION') || !mainSource.includes('MIN_SCANNER_TARGETS') || !mainSource.includes('fillWithSandboxTargets')) throw new Error('Local scanner should use Valencia in local testing and fill short OSM result sets with sandbox targets');
if (!mainSource.includes('VITE_TARGETS_ENDPOINT') || !mainSource.includes('searchBackendTargets') || !mainSource.includes('searchOverpassPlaces')) throw new Error('Scanner should try the targets backend before falling back to direct Overpass');
if (!mainSource.includes('scheduleTargetPrefetchForRun') || !mainSource.includes('SCANNER_PREFETCH_LIMIT')) throw new Error('Scanner should prefetch a small number of target zones during runs');
if (!mainSource.includes('ensureBookmarkZoneCached') || !mainSource.includes('SCANNER_BOOKMARK_PREFETCH_LIMIT')) throw new Error('Saving a bookmark should warm the targets cache for that bookmark zone');
const functionsSource = await readFile('functions/src/targetSearch.js', 'utf8');
if (!functionsSource.includes('placesCache') || !functionsSource.includes('fetchGeoapifyPlaces') || !functionsSource.includes('createCacheKey')) throw new Error('Targets backend should cache zones and include Geoapify fallback');
const functionsIndexSource = await readFile('functions/index.js', 'utf8');
if (!functionsIndexSource.includes('defineSecret') || !functionsIndexSource.includes('GEOAPIFY_API_KEY') || functionsIndexSource.includes('f9d6')) throw new Error('Geoapify key should be a backend secret, never committed');
const themeSource = await readFile('src/styles/theme.css', 'utf8');
if (!themeSource.includes('--scrollbar-thumb') || !themeSource.includes('::-webkit-scrollbar-thumb') || !themeSource.includes('scrollbar-color')) throw new Error('Theme CSS should style scrollbars consistently');
if (!themeSource.includes('--button-crt-line') || !themeSource.includes('datastreamSlide') || !themeSource.includes('button:focus-visible')) throw new Error('Theme CSS should keep Cybercore-inspired micro styles available');

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
const { renderHud, renderProgramDock } = await import('../src/ui/renderHud.js');
const { renderPostRunScannerPanel, renderRunLogDialog } = await import('../src/ui/renderRunLog.js');
const { renderScannerOverlay } = await import('../src/ui/renderScannerOverlay.js');
const { applyTheme, normalizeThemeKey, themeCatalog } = await import('../src/ui/themeStore.js');
const { assetPaths } = await import('../src/assets/assetRegistry.js');
const { firebaseFirestoreDatabaseId, getFirebaseConfig, isFirebaseConfigured, isFirebaseMessagingConfigured } = await import('../src/firebase/firebaseConfig.js');
const { getFirebaseStatus } = await import('../src/firebase/firebaseClient.js');
const { cloudPaths } = await import('../src/firebase/cloudPersistence.js');
const { mergeDeckProfiles } = await import('../src/firebase/cloudSync.js');
const { createOverpassProvider } = await import('../src/world/overpassProvider.js');
const { addHostBookmark, avatarCatalog, awardRunCredits, createDefaultDeckProfile, getBookmarkCapacity, getStorageCapacity, updatePlayerProfile, upgradeDeckProfile } = await import('../src/world/deckStore.js');

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
assertStructuredHost(jackOutSystem);
assertMapViewContainsGraph(jackOutSystem);
if (!jackOutSystem.nodes.some((node) => node.event === nodeEvents.archive.kind || node.event === nodeEvents.core.kind)) {
  throw new Error('Generated hosts should include extractable node events');
}
const lowValueSystem = generateSystem({
  rng: createRng('low-value-host-check'),
  seedId: 'low-value-host-check',
  company: demoPlaces[1],
  archetype: classifyCompany(demoPlaces[1]),
  valuation: { score: 15, tier: 'D', difficulty: 'minima', payoutMultiplier: 1.15, securityModifier: -1, sizeModifier: -1 },
});
const highValueSystem = generateSystem({
  rng: createRng('high-value-host-check'),
  seedId: 'high-value-host-check',
  company: demoPlaces[2],
  archetype: classifyCompany(demoPlaces[2]),
  valuation: { score: 92, tier: 'AAA', difficulty: 'letal', payoutMultiplier: 1.92, securityModifier: 2, sizeModifier: 3 },
});
assertStructuredHost(lowValueSystem);
assertStructuredHost(highValueSystem);
assertMapViewContainsGraph(lowValueSystem);
assertMapViewContainsGraph(highValueSystem);
if (countHostDefenses(highValueSystem) <= countHostDefenses(lowValueSystem)) throw new Error('High-value hosts should contain more defenses than low-value hosts');
assertHighTierPayloadApproach(highValueSystem);
const jackOutRun = reduceRun(jackOutSystem, createInitialRunState(jackOutSystem), { type: 'jackOut' });
if (jackOutRun.status !== 'escaped') throw new Error('Jack-out from entry should escape instead of crashing');
if (!Number.isFinite(scoreRun(jackOutSystem, jackOutRun))) throw new Error('Jack-out run score should be finite');
const defaultDeck = createDefaultDeckProfile();
if (defaultDeck.player.shadowName !== 'NEON GHOST' || defaultDeck.player.avatar !== 'runner01' || avatarCatalog.length !== 36 || !assetPaths.avatars.runner36 || assetPaths.avatars.ghost) throw new Error('Default deck should include only the runner PNG avatar presets');
const legacyAvatarDeck = updatePlayerProfile(defaultDeck, { avatar: 'cipher' });
if (legacyAvatarDeck.player.avatar !== 'runner01') throw new Error('Legacy imported avatars should migrate to a runner avatar');
const identityDeck = updatePlayerProfile(defaultDeck, { shadowName: 'HEX MANTA', avatar: 'runner17' });
if (identityDeck.player.shadowName !== 'HEX MANTA' || identityDeck.player.avatar !== 'runner17') throw new Error('Runner identity updates should persist through deck normalization');
const identityMapHtml = renderNodeMap(projectSystemForRun(jackOutSystem, createInitialRunState(jackOutSystem, identityDeck)), createInitialRunState(jackOutSystem, identityDeck), undefined, null, null, false, null, null, identityDeck.player);
if (!identityMapHtml.includes('HEX MANTA') || !identityMapHtml.includes('data-action="toggleSettings"') || !identityMapHtml.includes('/assets/avatars/avatar-runner-17.png')) {
  throw new Error('Node map should render runner identity as the settings avatar control');
}
const identitySettingsHtml = renderSettingsOverlay(true, {}, 'black', null, identityDeck);
if (!identitySettingsHtml.includes('data-shadow-name-input') || !identitySettingsHtml.includes('data-avatar-option="runner17"')) {
  throw new Error('Settings should expose runner identity editing');
}
if (!identitySettingsHtml.includes('/assets/avatars/avatar-runner-01.png') || !themeSource.includes('overflow-x: auto')) {
  throw new Error('Settings should expose the PNG avatar strip as a horizontal scroller');
}
if (!identitySettingsHtml.includes('Conectar deck a Nexus') || !identitySettingsHtml.includes('data-action="signInGoogle"') || !identitySettingsHtml.includes('data-action="continueLocal"')) {
  throw new Error('Settings should render the Nexus connection panel with Google redirect and local continuation');
}
const syncingSettingsHtml = renderSettingsOverlay(true, {}, 'black', { configured: true, status: 'syncing', message: 'Comprobando retorno de Google...', user: null }, identityDeck);
if (!syncingSettingsHtml.includes('data-action="signInGoogle" type="button" >Google')) {
  throw new Error('Background cloud sync should not disable Google sign-in on mobile');
}
const authenticatingSettingsHtml = renderSettingsOverlay(true, {}, 'black', { configured: true, status: 'authenticating', message: 'Saliendo hacia Google...', user: null }, identityDeck);
if (!authenticatingSettingsHtml.includes('data-action="signInGoogle" type="button" disabled>Google')) {
  throw new Error('Explicit Google auth should disable the sign-in button until redirect/error');
}
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
const postRunResult = { status: 'escaped', hostAlias: jackOutSystem.alias, reward: rewardResult.reward, score: 1234, lootTokens: 3 };
const postRunChoiceHtml = renderPostRunScannerPanel(postRunResult, { hostAlias: jackOutSystem.alias, reward: rewardResult.reward, score: 1234, lootTokens: 3, canBookmark: true, bookmarkCapacity: 3, bookmarkDecision: null }, defaultDeck);
if (!postRunChoiceHtml.includes('Guardar host') || !postRunChoiceHtml.includes('Abrir scanner') || postRunChoiceHtml.includes('Reboot deck') || postRunChoiceHtml.includes('No guardar') || postRunChoiceHtml.includes('skipBookmark')) {
  throw new Error('Post-run scanner panel should only offer save host and scanner');
}
const savedPostRunHtml = renderPostRunScannerPanel(postRunResult, { hostAlias: jackOutSystem.alias, reward: rewardResult.reward, score: 1234, lootTokens: 3, canBookmark: false, bookmarkCapacity: 3, bookmarkDecision: 'saved' }, defaultDeck);
if (!savedPostRunHtml.includes('Host guardado') || savedPostRunHtml.includes('Guardar host') || !savedPostRunHtml.includes('Abrir scanner')) {
  throw new Error('Saved hosts should show confirmation and leave only scanner available');
}
if (themeSource.includes('node-diorama') || themeSource.includes('completion-card') || themeSource.includes('completion-shell')) {
  throw new Error('Legacy extract completion windows should not remain in the active stylesheet');
}
if (!themeSource.includes('--threat-accent') || !themeSource.includes('--threat-border') || !themeSource.includes('calc(var(--danger-level) * 100%)') || !themeSource.includes('calc(34px + (var(--danger-level) * 24px))')) {
  throw new Error('Frames and controls should react visually to the current alert danger level');
}
if (!themeSource.includes('.program-card__frame-outer') || !themeSource.includes('.deck-stat-card') || !themeSource.includes('.deck-software-card') || !themeSource.includes('calc(var(--danger-level) * 68%)')) {
  throw new Error('Program and deck frames should intensify with the current alert danger level');
}

function assertStructuredHost(system) {
  assertReadableMapGeometry(system);
  const distances = hostDistances(system);
  if (distances[system.coreNodeId] === undefined || distances[system.coreNodeId] < 4) throw new Error('Generated host core should be at least four hops from entry');
  if (!system.nodes.some((node) => node.kind === 'exit' && distances[node.id] !== undefined)) throw new Error('Generated host should include a reachable exit');
  if (!system.nodes.some((node) => node.event === nodeEvents.archive.kind || node.event === nodeEvents.core.kind)) throw new Error('Generated host should include reachable paydata');
  for (const node of system.nodes) {
    if (node.event === nodeEvents.archive.kind && distances[node.id] < 3) throw new Error('Generated host archive paydata should not sit beside the entry');
  }
}


function assertReadableMapGeometry(system) {
  for (let leftIndex = 0; leftIndex < system.nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < system.nodes.length; rightIndex += 1) {
      const left = system.nodes[leftIndex];
      const right = system.nodes[rightIndex];
      const minimumDistance = left.kind === 'core' || right.kind === 'core' ? 16 : 13;
      if (Math.hypot(left.x - right.x, left.y - right.y) < minimumDistance) {
        throw new Error(`Generated host map nodes should breathe: ${left.id} is too close to ${right.id}`);
      }
    }
  }

  for (let leftIndex = 0; leftIndex < system.edges.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < system.edges.length; rightIndex += 1) {
      const left = system.edges[leftIndex];
      const right = system.edges[rightIndex];
      if (sharesEndpoint(left, right)) continue;
      if (segmentsIntersect(nodePoint(system, left.from), nodePoint(system, left.to), nodePoint(system, right.from), nodePoint(system, right.to))) {
        throw new Error(`Generated host map routes should not cross: ${left.from}-${left.to} crosses ${right.from}-${right.to}`);
      }
    }
  }
}

function assertMapViewContainsGraph(system) {
  const bounds = checkMapBounds(system);
  const html = renderNodeMap(projectSystemForRun(system, createInitialRunState(system)), createInitialRunState(system), bounds);
  if (!html.includes(`viewBox="${formatCheckViewBox(bounds)}"`)) throw new Error('Node map should render the supplied graph-sized viewBox');
  for (const node of system.nodes) {
    const y = node.y + 20;
    if (node.x < bounds.x || node.x > bounds.x + bounds.width || y < bounds.y || y > bounds.y + bounds.height) {
      throw new Error(`Initial map bounds should contain node ${node.id}`);
    }
  }
}

function checkMapBounds(system) {
  const xs = system.nodes.map((node) => node.x);
  const ys = system.nodes.map((node) => node.y + 20);
  const minX = Math.min(...xs) - 22;
  const maxX = Math.max(...xs) + 22;
  const minY = Math.min(...ys) - 22;
  const maxY = Math.max(...ys) + 30;
  return {
    x: minX,
    y: minY,
    width: Math.max(32, maxX - minX),
    height: Math.max(32, maxY - minY),
  };
}

function formatCheckViewBox(view) {
  return [view.x, view.y, view.width, view.height].map((value) => Number(value.toFixed(2))).join(' ');
}

function nodePoint(system, nodeId) {
  const node = system.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`Missing node ${nodeId}`);
  return node;
}

function sharesEndpoint(leftEdge, rightEdge) {
  return leftEdge.from === rightEdge.from
    || leftEdge.from === rightEdge.to
    || leftEdge.to === rightEdge.from
    || leftEdge.to === rightEdge.to;
}

function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (Math.abs(abC) < 0.001 && onSegment(a, c, b)) return true;
  if (Math.abs(abD) < 0.001 && onSegment(a, d, b)) return true;
  if (Math.abs(cdA) < 0.001 && onSegment(c, a, d)) return true;
  if (Math.abs(cdB) < 0.001 && onSegment(c, b, d)) return true;
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) + 0.001
    && b.x + 0.001 >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y) + 0.001
    && b.y + 0.001 >= Math.min(a.y, c.y);
}

function assertHighTierPayloadApproach(system) {
  const distances = hostDistances(system);
  const nearestArchiveDistance = Math.min(...system.nodes
    .filter((node) => node.event === nodeEvents.archive.kind)
    .map((node) => distances[node.id])
    .filter(Number.isFinite));
  const priorDecisions = system.nodes.filter((node) => {
    const distance = distances[node.id];
    return distance > 0
      && distance < nearestArchiveDistance
      && (node.kind === 'firewall' || node.kind === 'camera' || ['gate', 'trap', 'camera', 'decoy'].includes(node.event) || node.ice);
  }).length;
  if (nearestArchiveDistance < 3 || priorDecisions < 2) throw new Error('High-tier hosts should demand at least two tactical decisions before first payload');
}

function countHostDefenses(system) {
  return system.nodes.filter((node) => node.ice || ['gate', 'trap', 'camera'].includes(node.event)).length;
}

function hostDistances(system) {
  const distances = { [system.entryNodeId]: 0 };
  const queue = [system.entryNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = system.edges
      .filter((edge) => edge.from === current || edge.to === current)
      .map((edge) => (edge.from === current ? edge.to : edge.from));
    for (const neighbor of neighbors) {
      if (distances[neighbor] !== undefined) continue;
      distances[neighbor] = distances[current] + 1;
      queue.push(neighbor);
    }
  }
  return distances;
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
if (!movedIntoIce.log.at(-1).includes('ALERTA')) throw new Error('Run log entries should annotate alert pressure deltas when they change');
const unsafeJackOutRun = reduceRun(iceSystem, movedIntoIce, { type: 'jackOut' });
if (!unsafeJackOutRun.log.at(-1).includes('TRAZA') || !unsafeJackOutRun.log.at(-1).includes('SHELL')) throw new Error('Run log entries should annotate trace and shell pressure deltas when they change');
let longLogRun = createInitialRunState(iceSystem);
for (let index = 0; index < 10; index += 1) longLogRun = reduceRun(iceSystem, longLogRun, { type: 'selectProgram', program: index % 2 === 0 ? 'scan' : 'ghost' });
if (longLogRun.log.length <= 7) throw new Error('Run log should retain more than the old seven-line tail for post-run review');
renderNodeMap(projectSystemForRun(iceSystem, killedIceRun), killedIceRun);
const finishedMapHtml = renderNodeMap(projectSystemForRun(jackOutSystem, jackOutRun), jackOutRun, undefined, null, { score: 55, reward: 12, lootTokens: 0, operator: 'usr@sh' });
if (!finishedMapHtml.includes('cerrar_run') || !finishedMapHtml.includes('node-map--result') || !finishedMapHtml.includes('VENTANA DE MAPA CERRADA') || finishedMapHtml.includes('node-map__actions') || finishedMapHtml.includes('node-map__log-button')) throw new Error('Finished runs should render a closed-map completion terminal without the active map action stack');
const cleanedSuccessMapHtml = renderNodeMap(projectSystemForRun(jackOutSystem, { ...jackOutRun, hasPayload: false, lootTokens: 0 }), { ...jackOutRun, hasPayload: false, lootTokens: 0 }, undefined, null, { status: 'escaped', score: 55, reward: 12, lootTokens: 2, operator: 'usr@sh' });
if (!cleanedSuccessMapHtml.includes('EXTRACCIÓN CONFIRMADA') || cleanedSuccessMapHtml.includes('CONEXIÓN CORTADA')) throw new Error('Successful cleaned runs should still render the success terminal from the run result snapshot');
const mapMessageHtml = renderNodeMap(projectSystemForRun(iceSystem, killedIceRun), killedIceRun, undefined, { key: 'check', text: 'Ultima traza visible' });
if (!mapMessageHtml.includes('node-map__message') || !mapMessageHtml.includes('node-map__log-button') || !mapMessageHtml.includes('Ultima traza visible')) throw new Error('Node map should surface the latest log message and log button');
if (!mapMessageHtml.includes('node-map__message-char') || !mapMessageHtml.includes('node-map__message-cursor')) throw new Error('Node map latest-log ticket should render typewriter characters and a cursor');
if (!themeSource.includes('.node-map__message-text') || !themeSource.includes('mapLogTypeChar') || !themeSource.includes('mapLogCursorBlink') || !themeSource.includes('mapLogTicketGlitch')) throw new Error('Latest-log ticket should type from the left, blink a cursor, then glitch-fade');
const nodeVisitHtml = renderNodeMap(projectSystemForRun(iceSystem, movedIntoIce), movedIntoIce, undefined, null, null, true, {
  nodeId: 'n-1',
  fromNodeId: 'n-0',
  phase: 'focus',
  recommendedProgram: 'spike',
  autoDismiss: false,
});
if (!nodeVisitHtml.includes('node-focus-hud') || !nodeVisitHtml.includes('route--focus') || !nodeVisitHtml.includes('ICE Centinela // LVL') || nodeVisitHtml.includes('REC:') || nodeVisitHtml.includes('TIPO')) throw new Error('Node visits should render a non-modal tactical focus HUD with ICE context without duplicating program recommendations');
const deckTraceHtml = renderDeckTrace(upgradedDeckResult.profile, createInitialRunState(iceSystem, upgradedDeckResult.profile), 'Scan mejorado.');
if (deckTraceHtml.includes('deck-memory')) throw new Error('Deck trace should not render the removed local memory box');
if (!deckTraceHtml.includes('deck-extraction') || !deckTraceHtml.includes('EXTR 0/')) throw new Error('Deck trace should render segmented extraction capacity inside the deck box');
const finishedDeckTraceHtml = renderDeckTrace(upgradedDeckResult.profile, { ...createInitialRunState(iceSystem, upgradedDeckResult.profile), status: 'escaped', lootTokens: 3, deckCash: 99 }, 'Run limpia.');
if (!finishedDeckTraceHtml.includes('RUN 0') || !finishedDeckTraceHtml.includes('CTA')) throw new Error('Finished runs should empty deck cash in the deck trace');
const animatedDeckTraceHtml = renderDeckTrace(upgradedDeckResult.profile, createInitialRunState(iceSystem, upgradedDeckResult.profile), 'Transfer.', { phase: 'transfer', maxLoot: 5, loot: 2, deckCash: 40, accountCredits: 120 });
if (!animatedDeckTraceHtml.includes('deck-trace--transfer') || !animatedDeckTraceHtml.includes('RUN 40') || !animatedDeckTraceHtml.includes('CTA 120')) throw new Error('Deck trace should render animated transfer counters');
const runLogDialogHtml = renderRunLogDialog(true, killedIceRun);
if (!runLogDialogHtml.includes('run-log-dialog') || !runLogDialogHtml.includes('run-log-dialog__list') || !runLogDialogHtml.includes('Run terminal') || runLogDialogHtml.includes('overlay-backdrop') || !runLogDialogHtml.includes('aria-modal="false"')) throw new Error('Run log should render as a non-blocking terminal popover with a scrollable history list');
const mapLogOpenHtml = renderNodeMap(projectSystemForRun(iceSystem, killedIceRun), killedIceRun, undefined, null, null, true, null, null, null, true);
if (!mapLogOpenHtml.includes('run-log-dialog') || !mapLogOpenHtml.includes('node-map__log-button')) throw new Error('Node map should open the run log as a contextual terminal window near the log button');
const postRunPanelHtml = renderPostRunScannerPanel({ ...jackOutRun, hostAlias: 'ICE CHECK', score: 10, reward: 1, lootTokens: 0 }, null, upgradedDeckResult.profile);
if (!postRunPanelHtml.includes('data-action="toggleRunLog"') || !postRunPanelHtml.includes('Ver log')) throw new Error('Post-run panel should keep the previous run log accessible before the next host starts');
const deckOverlayHtml = renderDeckOverlay(true, upgradedDeckResult.profile, 'Scan mejorado.');
if (!deckOverlayHtml.includes('Software cargado') || !deckOverlayHtml.includes('cred en cuenta')) throw new Error('Deck overlay should render loaded software and player account credits');
if (!deckOverlayHtml.includes('deck-software-grid')) throw new Error('Deck software should render as a card grid');
if (!deckOverlayHtml.includes('/assets/stats/stat-pulse.svg')) throw new Error('Deck stats should use custom SVG icons');
const mapActionHtml = renderNodeMap(projectSystemForRun(iceSystem, createInitialRunState(iceSystem)), createInitialRunState(iceSystem));
if (!mapActionHtml.includes('node-map__actions') || !mapActionHtml.includes('data-action="toggleSettings"') || !mapActionHtml.includes('node-map__avatar-settings')) throw new Error('Node map should expose settings avatar next to jack-out');
if (!mapActionHtml.includes('node-map__meters') || !mapActionHtml.includes('ALERTA') || !mapActionHtml.includes('node-map-meter__icon') || !mapActionHtml.includes('data-meter-ratio') || !themeSource.includes('.node-map__actions') || !themeSource.includes('top: 10px') || !themeSource.includes('grid-template-columns: repeat(3, minmax(0, 1fr))') || !themeSource.includes('grid-template-areas: "icon bar"') || !themeSource.includes('mapMeterFillProgress')) throw new Error('Node map should keep actions top-right and render pressure meters as a bottom icon row with animated bar values');
if (mapActionHtml.includes('data-action="toggleMusic"') || mapActionHtml.includes('data-action="toggleSfx"')) throw new Error('Audio controls should live inside settings, not the main HUD');
const finishedActionMapHtml = renderNodeMap(projectSystemForRun(iceSystem, { ...jackOutRun, selectedProgram: 'scan', disabledPrograms: [] }), { ...jackOutRun, selectedProgram: 'scan', disabledPrograms: [] }, undefined, null, null, true);
if (finishedActionMapHtml.includes('node-map__actions') || finishedActionMapHtml.includes('node-map__jack-out')) throw new Error('Finished maps should remove the active top-right action stack');
if (!renderProgramDock({ ...jackOutRun, selectedProgram: 'scan', disabledPrograms: [] }, true).includes('program-dock--inactive')) throw new Error('Finished runs should fade and disable program controls');
const cyberProgramDockHtml = renderProgramDock({ ...jackOutRun, selectedProgram: 'scan', disabledPrograms: [] }, false, 'spike', upgradedDeckResult.profile);
if (!cyberProgramDockHtml.includes('is-recommended') || !cyberProgramDockHtml.includes('program-card__frame') || !cyberProgramDockHtml.includes('LVL')) throw new Error('Program dock should render cyberdeck cards with levels and mark the recommended node visit program');
const settingsHtml = renderSettingsOverlay(true, { music: true, sfx: false, musicVolume: 0.42, sfxVolume: 0.18 }, 'workbench-light');
if (!settingsHtml.includes('settings-audio') || !settingsHtml.includes('data-audio-volume="music"') || !settingsHtml.includes('value="42"')) throw new Error('Settings overlay should render real music volume controls');
if (!settingsHtml.includes('data-action="toggleMusic"') || !settingsHtml.includes('data-action="openHelp"')) throw new Error('Settings overlay should contain audio toggles and a help button');
if (settingsHtml.includes('help-tabs') || settingsHtml.includes('help-panel__content')) throw new Error('Settings overlay should not embed the help manual');
if (!settingsHtml.includes('settings-themes') || !settingsHtml.includes('theme-dropdown') || !settingsHtml.includes('theme-menu')) throw new Error('Settings overlay should render theme choices as a dropdown');
if (!settingsHtml.includes('data-theme-option="workbench-light"') || !settingsHtml.includes('data-theme-option="solar-light"') || !settingsHtml.includes('data-theme-option="atari-light"') || !settingsHtml.includes('aria-pressed="true"')) throw new Error('Settings theme dropdown should expose light themes and active state');
if (themeCatalog.length !== 7 || normalizeThemeKey('missing') !== 'black') throw new Error('Theme catalog should expose seven stable presets and normalize invalid values');
globalThis.document = { documentElement: { setAttribute(name, value) { this[name] = value; } } };
if (applyTheme('kali') !== 'kali' || globalThis.document.documentElement['data-theme'] !== 'kali') throw new Error('Theme application should update the document theme attribute');
delete globalThis.document;
if (!renderHelpOverlay(true, 'deck').includes('help-tabs')) throw new Error('Help overlay should render compact tab navigation in its own dialog');
if (isFirebaseConfigured() || isFirebaseMessagingConfigured() || getFirebaseConfig() !== null) throw new Error('Firebase should stay disabled without env config');
if (getFirebaseStatus().configured) throw new Error('Firebase status should report unconfigured in checks');
if (firebaseFirestoreDatabaseId !== '(default)' || getFirebaseStatus().databaseId !== '(default)') throw new Error('Firebase database id should default to the default database without env config');
if (cloudPaths.deckProfile('u1').join('/') !== 'users/u1/deck/profile') throw new Error('Firebase deck profile path should stay stable');
if (cloudPaths.hostProgress('u1', 'seed').join('/') !== 'users/u1/hostProgress/seed') throw new Error('Firebase host progress path should stay stable');
const mergedCloudDeck = mergeDeckProfiles(
  { ...defaultDeck, totalEarned: 20, credits: 20, bookmarks: [{ seedId: 'local', name: 'Local', hostAlias: 'LOCAL', category: 'shop', lat: 1, lon: 1, savedAt: '2026-01-02T00:00:00.000Z' }] },
  { ...defaultDeck, totalEarned: 40, credits: 40, bookmarks: [{ seedId: 'remote', name: 'Remote', hostAlias: 'REMOTE', category: 'shop', lat: 2, lon: 2, savedAt: '2026-01-01T00:00:00.000Z' }] },
);
if (mergedCloudDeck.credits !== 40 || mergedCloudDeck.bookmarks.length !== 2) throw new Error('Cloud deck merge should keep richer deck and combine bookmarks');
const scannerHtml = renderScannerOverlay({
  isOpen: true,
  places: [
    { provider: 'osm', providerId: 'node/1', name: 'Real Shop', category: 'shop', address: 'Calle Real 1' },
    { provider: 'geoapify', providerId: 'geoapify/1', name: 'Geo Office', category: 'office', address: 'Geoapify Way' },
    { provider: 'manual', providerId: 'demo/1', name: 'Demo Shop', category: 'shop' },
  ],
  selectedPlace: { providerId: 'node/1' },
  locationMessage: 'Scanner activo.',
  describeTarget: (place) => place.category,
  bookmarks: [{ provider: 'osm', providerId: 'node/2', hostAlias: 'BOOKMARK', name: 'Saved Real', address: 'Calle Bookmark 2' }],
  bookmarkCapacity: 3,
});
if (!scannerHtml.includes('/assets/ui/source-world.svg') || !scannerHtml.includes('/assets/ui/source-sandbox.svg')) throw new Error('Scanner should identify real world and sandbox host sources');
if (!scannerHtml.includes('Mundo real') || !scannerHtml.includes('Geoapify') || !scannerHtml.includes('Sandbox') || !scannerHtml.includes('Calle Real 1')) throw new Error('Scanner should show source labels and real-world anchor data when available');
if (!scannerHtml.includes('Proxy remoto')) throw new Error('Scanner bookmarks should be labelled as proxy scans');

const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
try {
  const calls = [];
  globalThis.fetch = async (endpoint) => {
    calls.push(endpoint);
    if (calls.length === 1) return { ok: false, status: 504, json: async () => ({ elements: [] }) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        elements: [{
          type: 'node',
          id: 1,
          lat: 40.4168,
          lon: -3.7038,
          tags: { name: 'Fallback Host', amenity: 'cafe' },
        }],
      }),
    };
  };
  const overpassProvider = createOverpassProvider({ endpoints: ['https://first.example/api', 'https://second.example/api'], timeoutMs: 1000 });
  const fallbackPlaces = await overpassProvider.searchNearbyPlaces({ lat: 40.4168, lon: -3.7038 }, 700);
  if (calls.length !== 2 || fallbackPlaces[0]?.name !== 'Fallback Host') throw new Error('Overpass provider should retry a second endpoint after a 504');
} finally {
  if (fetchDescriptor) Object.defineProperty(globalThis, 'fetch', fetchDescriptor);
  else delete globalThis.fetch;
}


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

const scanSpamSystem = {
  ...eventSystem,
  entryNodeId: 'n-0',
  nodes: [
    { id: 'n-0', kind: 'entry', state: 'visited', x: 10, y: 50, risk: 1 },
    { id: 'n-1', kind: 'camera', state: 'visited', x: 26, y: 50, risk: 1 },
    { id: 'n-2', kind: 'data', state: 'unknown', x: 42, y: 50, risk: 1 },
    { id: 'n-3', kind: 'data', state: 'unknown', x: 58, y: 50, risk: 1 },
    { id: 'n-4', kind: 'data', state: 'unknown', x: 74, y: 50, risk: 1 },
    { id: 'n-5', kind: 'data', state: 'unknown', x: 90, y: 50, risk: 1 },
  ],
  edges: [
    { from: 'n-1', to: 'n-2' },
    { from: 'n-2', to: 'n-3' },
    { from: 'n-2', to: 'n-4' },
    { from: 'n-2', to: 'n-5' },
  ],
};
const boostedScanDeck = { deck: { lens: 3 }, programs: { scan: 3 } };
const scanSpamInitial = { ...createInitialRunState(scanSpamSystem), currentNodeId: 'n-1', nodeStates: { 'n-0': 'visited', 'n-1': 'visited', 'n-2': 'unknown', 'n-3': 'unknown', 'n-4': 'unknown', 'n-5': 'unknown' } };
const usefulScanRun = reduceRun(scanSpamSystem, scanSpamInitial, { type: 'runProgram', program: 'scan' }, boostedScanDeck);
if (usefulScanRun.alert !== scanSpamInitial.alert || !usefulScanRun.scannedFromNodeIds.includes('n-1')) throw new Error('First useful scan from a node should reveal cleanly and remember the scan origin');
const repeatedUsefulScanRun = reduceRun(scanSpamSystem, usefulScanRun, { type: 'runProgram', program: 'scan' }, boostedScanDeck);
if (repeatedUsefulScanRun.alert <= usefulScanRun.alert || !repeatedUsefulScanRun.log.at(-1).includes('Scan repetido')) throw new Error('Repeated scans from the same node should raise alert even when they still reveal nodes');

const gateRun = reduceRun(eventSystem, { ...eventInitialRun, currentNodeId: 'n-3', nodeStates: { ...eventInitialRun.nodeStates, 'n-3': 'visited' } }, { type: 'runProgram', program: 'spike' });
if (!gateRun.resolvedEvents.includes('n-3')) throw new Error('Spike should resolve gate events');
if (gateRun.nodeStates['n-4'] !== 'scanned') throw new Error('Resolved gates should reveal connected unknown nodes');
const trapRun = reduceRun(eventSystem, { ...eventInitialRun, currentNodeId: 'n-4', nodeStates: { ...eventInitialRun.nodeStates, 'n-4': 'visited' } }, { type: 'runProgram', program: 'shield' });
if (!trapRun.resolvedEvents.includes('n-4')) throw new Error('Shield should resolve trap events');
const lootRun = reduceRun(eventSystem, { ...eventInitialRun, currentNodeId: 'n-5', nodeStates: { ...eventInitialRun.nodeStates, 'n-5': 'visited' } }, { type: 'runProgram', program: 'extract' });
if (lootRun.lootTokens !== 3 || lootRun.deckCash <= 0 || !lootRun.hasPayload) throw new Error('Core extraction should load loot tokens and run cash into deck memory');
const relootRun = reduceRun(eventSystem, lootRun, { type: 'runProgram', program: 'extract' });
if (relootRun.lootTokens !== lootRun.lootTokens || relootRun.turn !== lootRun.turn) throw new Error('Extracted paydata nodes should not be lootable twice in one run');
const lootedPathRun = reduceRun(eventSystem, { ...eventInitialRun, currentNodeId: 'n-5', nodeStates: { ...eventInitialRun.nodeStates, 'n-4': 'visited', 'n-5': 'visited' } }, { type: 'runProgram', program: 'extract' });
const backtrackRun = reduceRun(eventSystem, lootedPathRun, { type: 'move', nodeId: 'n-4' });
const returnedLootRun = reduceRun(eventSystem, backtrackRun, { type: 'move', nodeId: 'n-5' });
if (returnedLootRun.nodeStates['n-5'] !== 'compromised') throw new Error('Backtracking into extracted nodes should preserve their compromised state');
const relootAfterReturnRun = reduceRun(eventSystem, returnedLootRun, { type: 'runProgram', program: 'extract' });
if (relootAfterReturnRun.lootTokens !== returnedLootRun.lootTokens) throw new Error('Backtracked paydata nodes should not be lootable twice in one run');
const fullMemoryRun = reduceRun(eventSystem, { ...eventInitialRun, currentNodeId: 'n-5', lootTokens: eventInitialRun.maxLootTokens, nodeStates: { ...eventInitialRun.nodeStates, 'n-5': 'visited' } }, { type: 'runProgram', program: 'extract' });
if (fullMemoryRun.lootTokens !== eventInitialRun.maxLootTokens || fullMemoryRun.hasPayload) throw new Error('Full memory should block new payload extraction');

const ghostPressureRun = reduceRun(iceSystem, { ...createInitialRunState(iceSystem), alert: 3, trace: 2 }, { type: 'runProgram', program: 'ghost' });
if (ghostPressureRun.alert !== 2 || ghostPressureRun.trace !== 1) throw new Error('Ghost should reduce alert and trace when pressure exists');
if (ghostPressureRun.integrity !== 9) throw new Error('Ghost should cost one shell when hiding an active signature');
const ghostIdleRun = reduceRun(iceSystem, createInitialRunState(iceSystem), { type: 'runProgram', program: 'ghost' });
if (ghostIdleRun.turn !== 1 || ghostIdleRun.integrity !== 10) throw new Error('Ghost should not be spammable at zero pressure');

const lowDanger = getDangerTheme(createInitialRunState(iceSystem));
const warningDanger = getDangerTheme({ ...createInitialRunState(iceSystem), alert: 5 });
const redOrangeDanger = getDangerTheme({ ...createInitialRunState(iceSystem), alert: 7 });
const highDanger = getDangerTheme({ ...createInitialRunState(iceSystem), alert: 10, trace: 8, integrity: 1 });
if (Number(lowDanger.level) >= Number(highDanger.level)) throw new Error('Danger theme should increase as run pressure rises');
if (!lowDanger.color.includes('hsl(214') || !warningDanger.color.includes('hsl(32') || !redOrangeDanger.color.includes('hsl(19') || !highDanger.color.includes('hsl(0')) {
  throw new Error('Danger theme should ease through marked blue, orange, orange-red, and red pressure bands');
}

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
  if (!lowScore.startsWith('adaptive-buffer-web-audio://')) throw new Error('Music should use adaptive WebAudio buffers instead of Strudel or oscillator-only loops');
  if (!mediumScore.includes('stage=1')) throw new Error('Adaptive music descriptor should react to pressure stage');
  if (!(await director.toggleMusic())) throw new Error('Music should enable with mock AudioContext');
  if (!director.isMusicEnabled() || director.isSfxEnabled()) throw new Error('Music and SFX toggles should be independent');
  const musicDebug = director.getMusicDebugState();
  if (musicDebug.engine !== 'adaptive-buffer-web-audio' || !musicDebug.loaded || !('base' in musicDebug.layers) || !('threat' in musicDebug.layers)) {
    throw new Error('Music should start an adaptive layered buffer engine');
  }
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
  if (!highScore.includes('stage=3')) throw new Error('High danger should move adaptive music descriptor to stage 3');
  const iceAudioProfile = director.updateRunState(movedIntoIce, iceSystem);
  if (!iceAudioProfile.iceActive) throw new Error('Adaptive music profile should detect active ICE on the current node');
  await director.play('scan');
  await director.play('spike');
  await director.play('ghost');
  await director.play('shield');
  await director.play('extract');
  if (director.getMusicDebugState().layers.extract <= 0.0001) throw new Error('Extract action should raise the adaptive extraction layer');
  if (!director.isEnabled()) throw new Error('Audio director should remain enabled after jack-out sounds');
  if (await director.toggleSfx()) throw new Error('SFX should disable cleanly');
  if (await director.toggleMusic()) throw new Error('Music should disable cleanly');
  if (director.isEnabled()) throw new Error('Audio director should be fully disabled after both toggles are off');
} finally {
  if (audioDescriptor) Object.defineProperty(globalThis, 'AudioContext', audioDescriptor);
  else delete globalThis.AudioContext;
}

console.log(`Checked ${requiredFiles.length} required files, PWA manifest, seed hashing fallback, jack-out/ICE/event/deck flows, danger theme, and audio director.`);
