import { createAudioDirector } from '../audio/proceduralAudio.js';
import { getHostBackground } from '../assets/assetRegistry.js';
import { createCloudSyncController } from '../firebase/cloudSync.js';
import { generateSystem } from '../game/mapGenerator.js';
import { reduceRun } from '../game/runEngine.js';
import { scoreRun } from '../game/runScoring.js';
import { createInitialRunState, isRunFinished, NODE_RUNTIME_STATE } from '../game/runState.js';
import { nodeEvents } from '../game/nodeEvents.js';
import { createRng } from '../game/rng.js';
import { projectSystemForRun } from '../game/systemView.js';
import { getGeolocationPermissionState, requestCurrentPosition } from '../location/locationService.js';
import { registerServiceWorker } from '../pwa/registerServiceWorker.js';
import { getDangerTheme } from '../ui/dangerTheme.js';
import { renderDeckOverlay } from '../ui/renderDeckPanel.js';
import { renderHelpOverlay, renderSettingsOverlay } from '../ui/renderHelpOverlay.js';
import { renderHud, renderProgramDock } from '../ui/renderHud.js';
import { renderLandingPage } from '../ui/renderLandingPage.js';
import { renderNodeMap } from '../ui/renderNodeMap.js';
import { renderPostRunScannerPanel } from '../ui/renderRunLog.js';
import { renderScannerOverlay } from '../ui/renderScannerOverlay.js';
import { applyTheme, loadThemePreference, saveThemePreference } from '../ui/themeStore.js';
import { classifyCompany } from '../world/companyArchetypes.js';
import { hashCompany } from '../world/companySeed.js';
import { valueCompany } from '../world/companyValuation.js';
import { createOverpassProvider } from '../world/overpassProvider.js';
import { createDemoNearbyProvider, demoPlaces, searchNearbyPlaces } from '../world/placeProvider.js';
import { addHostBookmark, awardRunCredits, getBookmarkCapacity, loadDeckProfile, removeHostBookmark, updatePlayerProfile, upgradeDeckProfile } from '../world/deckStore.js';
import { getHostProgress, getPlayerProgressStats, listRecentProgress, recordRunResult } from '../world/progressStore.js';

const root = document.querySelector('#root');
const audioDirector = createAudioDirector();
const overpassProvider = createOverpassProvider();
const demoNearbyProvider = createDemoNearbyProvider();
const DEFAULT_MAP_VIEW = { x: -12, y: 12, width: 124, height: 124 };
const DEFAULT_MAP_BOUNDS = { ...DEFAULT_MAP_VIEW };
const MAP_GRAPH_OFFSET_Y = 20;
const MAP_VIEW_PADDING = 22;
const MAP_LABEL_PADDING = 8;
const MAP_GRAPH_SIDE_PADDING = 12;
const MAP_GRAPH_TOP_PADDING = 12;
const MAP_GRAPH_BOTTOM_PADDING = 14;
const MAP_FIT_SIDE_SAFE_PX = 10;
const MAP_FIT_CHROME_GAP_PX = 10;
const MAP_OPEN_OVERVIEW_SCALE = 1.14;
const MIN_MAP_SIZE = 32;
const MAP_DRAG_THRESHOLD_PX = 12;
const MAP_LOG_MESSAGE_MS = 5200;
const MAP_REVEAL_MS = 1000;
const DISCONNECT_GLITCH_MS = 2000;
const DECK_COUNTER_ANIMATION_MS = 1000;
const MAP_FOCUS_ANIMATION_MS = 680;
const MAP_OPEN_ANIMATION_MS = 1080;
const NODE_VISIT_EMPTY_MS = 460;
const NODE_VISIT_RESOLVE_MS = 1800;
const DEBUG_LOG_LIMIT = 90;
const DEBUG_LOG_STORAGE_KEY = 'shadowHack.debugLog';
const EXPANDED_SCAN_RADIUS = 1500;
const MIN_SCANNER_TARGETS = 4;
const SCANNER_BACKEND_LIMIT = 10;
const SCANNER_PREFETCH_LIMIT = 3;
const SCANNER_BOOKMARK_PREFETCH_LIMIT = 1;
const targetsEndpoint = import.meta.env?.VITE_TARGETS_ENDPOINT ?? '';
const VALENCIA_TEST_POSITION = { lat: 39.4699, lon: -0.3763 };
const PLAY_ROUTE = '/play';
const appState = {
  places: demoPlaces,
  selectedPlace: demoPlaces[0],
  system: null,
  run: null,
  locationMessage: 'Objetivos demo cargados. Puedes activar scanner local cuando quieras.',
  currentProgress: null,
  recentProgress: [],
  deckProfile: loadDeckProfile(),
  deckMessage: '',
  cloud: null,
  theme: applyTheme(loadThemePreference()),
  mapLogMessage: null,
  mapReveal: null,
  lastMapLogKey: null,
  completion: null,
  runResult: null,
  lastRecordedStatus: null,
  isSettingsOpen: false,
  isHelpOpen: false,
  helpTab: 'run',
  isDeckOpen: false,
  isScannerOpen: false,
  isRunLogOpen: false,
  mapView: { ...DEFAULT_MAP_VIEW },
  mapBounds: { ...DEFAULT_MAP_BOUNDS },
  mapPointer: null,
  mapPointers: new Map(),
  mapPinch: null,
  mapGestureMoved: false,
  ignoreNextNodeClick: false,
  disconnectGlitchUntil: 0,
  disconnectGlitchStartedAt: 0,
  disconnectGlitchTimer: null,
  disconnectGlitchFrame: null,
  nodeVisit: null,
  nodeVisitTimer: null,
  nodeVisitSequence: 0,
  runSessionId: 0,
  deckAnimation: null,
  deckAnimationFrame: null,
  mapViewAnimationFrame: null,
  targetPrefetchKeys: new Set(),
  targetPrefetchQueue: [],
  targetPrefetchRunning: false,
  targetPrefetchCount: 0,
  bookmarkPrefetchKeys: new Set(),
};
const cloudSync = createCloudSyncController({
  onDeckLoaded(profile) {
    appState.deckProfile = profile;
    renderActiveView();
  },
  onStatusChange(cloud) {
    appState.cloud = cloud;
    renderActiveView();
  },
});
appState.cloud = cloudSync.getState();

async function buildSystem(place) {
  const seed = await hashCompany(place);
  const archetype = classifyCompany(place);
  const valuation = valueCompany(place, archetype, seed.seedHex);
  const rng = createRng(seed.seedHex);
  const isFirstRun = getPlayerProgressStats().totalRuns === 0;
  return generateSystem({ rng, seedId: seed.seedId, company: place, archetype, valuation, tutorial: isFirstRun });
}

async function startRun(place) {
  stopDeckAnimation();
  appState.runSessionId += 1;
  debugLog('startRun:begin', { place: place?.name, providerId: place?.providerId });
  appState.selectedPlace = place;
  appState.completion = null;
  appState.runResult = null;
  appState.system = await buildSystem(place);
  appState.deckProfile = loadDeckProfile();
  appState.deckMessage = '';
  appState.isDeckOpen = false;
  appState.isRunLogOpen = false;
  appState.run = createInitialRunState(appState.system, appState.deckProfile);
  appState.lastMapLogKey = null;
  appState.mapReveal = null;
  updateMapLogMessage(true);
  appState.currentProgress = getHostProgress(appState.system.seedId);
  appState.recentProgress = listRecentProgress();
  appState.lastRecordedStatus = null;
  const graphMapBounds = getMapBounds(appState.system);
  appState.mapView = getInitialMapView(graphMapBounds);
  appState.mapBounds = expandBoundsToContainView(graphMapBounds, appState.mapView);
  appState.mapPointer = null;
  appState.mapPointers.clear();
  appState.mapPinch = null;
  appState.mapGestureMoved = false;
  appState.ignoreNextNodeClick = false;
  stopMapViewAnimation();
  clearNodeVisit();
  stopDisconnectGlitch();
  syncAudioState();
  debugLog('startRun:ready', {
    seedId: appState.system.seedId,
    entryNodeId: appState.system.entryNodeId,
    nodeCount: appState.system.nodes.length,
    template: appState.system.template,
    tutorial: appState.system.tutorial,
  });
  scheduleTargetPrefetchForRun(place);
  render();
  scheduleOpeningMapFit(appState.runSessionId);
}

function dispatch(action) {
  if (!appState.system || !appState.run) return;
  const previousRun = appState.run;
  const previousStatus = appState.run.status;
  debugLog('dispatch:before', { action });
  appState.deckMessage = '';
  appState.run = reduceRun(appState.system, appState.run, action, appState.deckProfile);
  debugLog('dispatch:afterReduce', {
    action,
    previous: summarizeRun(previousRun),
    next: summarizeRun(appState.run),
  });
  syncMapReveal(previousRun, appState.run);
  startExtractAnimation(action, previousRun, appState.run);
  syncNodeVisit(action, previousRun, appState.run);
  if (previousStatus !== 'dumped' && appState.run.status === 'dumped') {
    triggerDisconnectGlitch();
  }
  updateMapLogMessage();
  syncAudioState();
  void audioDirector.play(audioEventForAction(action));
  syncRunResult();
  debugLog('dispatch:render', { action, runResultStatus: appState.runResult?.status ?? null });
  render();
}

function render() {
  if (!root) return;
  setDocumentMode('play');
  applyTheme(appState.theme);
  if (!appState.system || !appState.run) {
    root.innerHTML = '<main class="app-shell app-shell--loading">Sincronizando deck...</main>';
    return;
  }

  const runtimeSystem = projectSystemForRun(appState.system, appState.run);
  const finished = isRunFinished(appState.run);
  const shockActive = appState.run.status === 'dumped' && isDisconnectGlitchActive();
  const resultVisible = finished && !shockActive;
  const postRunPanelVisible = finished && !shockActive;
  const backgroundUrl = getHostBackground(appState.system.archetype.archetype);
  const themeRun = appState.run;
  const dangerTheme = getDangerTheme(themeRun);
  const signalFxClass = getSignalFxClass(dangerTheme.level, themeRun.status, shockActive);
  const previousMapMeters = readVisibleMapMeters();
  root.innerHTML = `<main class="app-shell ${signalFxClass}" style="--host-bg: url('${backgroundUrl}'); --danger-level: ${dangerTheme.level}; --danger-color: ${dangerTheme.color}; --danger-border: ${dangerTheme.border}; --danger-glow: ${dangerTheme.glow}">
    ${shockActive ? renderDisconnectFilter() : ''}
    ${shockActive ? '<div class="disconnect-shock" aria-hidden="true"></div>' : ''}
    <div class="scanline"></div>
    <div class="crt-vignette"></div>
    ${renderHud(runtimeSystem, appState.run, finished, appState.deckProfile.player)}
    ${renderNodeMap(runtimeSystem, appState.run, appState.mapView, getVisibleMapLogMessage(), appState.runResult, resultVisible, appState.nodeVisit, getVisibleMapReveal(), appState.deckProfile.player, appState.isRunLogOpen, previousMapMeters, getDeckTraceView())}
    ${renderProgramDock(appState.run, finished, appState.nodeVisit?.recommendedProgram, appState.deckProfile)}
    ${postRunPanelVisible ? renderPostRunScannerPanel(appState.runResult, appState.completion, appState.deckProfile) : ''}
    ${renderDeckOverlay(appState.isDeckOpen, appState.deckProfile, appState.deckMessage)}
    ${renderSettingsOverlay(appState.isSettingsOpen, audioDirector.getState(), appState.theme, appState.cloud, appState.deckProfile)}
    ${renderHelpOverlay(appState.isHelpOpen, appState.helpTab)}
    ${renderScannerOverlay({
      isOpen: appState.isScannerOpen,
      places: appState.places,
      selectedPlace: appState.selectedPlace,
      locationMessage: appState.locationMessage,
      describeTarget,
      bookmarks: appState.deckProfile.bookmarks,
      bookmarkCapacity: getBookmarkCapacity(appState.deckProfile),
    })}
  </main>`;

  bindEvents();
  syncDisconnectGlitchAnimation(shockActive);
}

function readVisibleMapMeters() {
  if (!root) return null;
  const meters = {};
  root.querySelectorAll('.node-map-meter[data-meter-kind], .node-map-extraction[data-meter-kind]').forEach((meter) => {
    const kind = meter.dataset.meterKind;
    const ratio = Number(meter.dataset.meterRatio);
    if (!kind || !Number.isFinite(ratio)) return;
    meters[kind] = Math.max(0, Math.min(1, ratio));
    const value = Number(meter.dataset.meterValue);
    const max = Number(meter.dataset.meterMax);
    if (Number.isFinite(value)) meters[`${kind}Value`] = Math.max(0, value);
    if (Number.isFinite(max)) meters[`${kind}Max`] = Math.max(0, max);
  });
  return Object.keys(meters).length > 0 ? meters : null;
}

function getSignalFxClass(level, status, disconnectGlitchActive = false) {
  const dangerLevel = Number(level);
  const classes = [];
  if (status === 'dumped' || dangerLevel >= 0.78) classes.push('app-shell--critical');
  if (status === 'encounter' || dangerLevel >= 0.48) classes.push('app-shell--unstable');
  if (disconnectGlitchActive) classes.push('app-shell--disconnect-glitch');
  return classes.join(' ');
}

async function boot() {
  if (getAppRoute() !== 'play') {
    renderLanding();
    return;
  }

  await startRun(appState.selectedPlace);
}

function renderActiveView() {
  if (getAppRoute() !== 'play') {
    renderLanding();
    return;
  }
  if (!appState.system || !appState.run) return;
  render();
}

function renderLanding() {
  if (!root) return;
  setDocumentMode('landing');
  applyTheme(appState.theme);
  root.innerHTML = renderLandingPage();
}

function setDocumentMode(mode) {
  const documentElement = globalThis.document?.documentElement;
  const body = globalThis.document?.body;
  if (!documentElement || !body) return;
  [documentElement, body].forEach((element) => {
    element.classList.toggle('is-landing-page', mode === 'landing');
    element.classList.toggle('is-play-page', mode === 'play');
  });
}

function getAppRoute() {
  const pathname = normalizePathname(globalThis.location?.pathname ?? '/');
  if (pathname === PLAY_ROUTE) return 'play';
  if (pathname !== '/') replaceUnknownPathWithLanding();
  return 'landing';
}

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function replaceUnknownPathWithLanding() {
  if (!globalThis.history?.replaceState || !globalThis.location) return;
  const hash = globalThis.location.hash ?? '';
  globalThis.history.replaceState(null, '', `/${hash}`);
}

function renderDisconnectFilter() {
  return `<svg class="disconnect-filter" aria-hidden="true" focusable="false">
    <filter id="disconnectDisplacement" x="-16%" y="-16%" width="132%" height="132%">
      <feTurbulence id="disconnectTurbulence" type="fractalNoise" baseFrequency="0.035 0.11" numOctaves="2" seed="7" result="noise" />
      <feDisplacementMap id="disconnectDisplacementMap" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>`;
}

function triggerDisconnectGlitch() {
  appState.disconnectGlitchStartedAt = Date.now();
  appState.disconnectGlitchUntil = Date.now() + DISCONNECT_GLITCH_MS;
  if (appState.disconnectGlitchTimer) {
    globalThis.clearTimeout(appState.disconnectGlitchTimer);
  }
  appState.disconnectGlitchTimer = globalThis.setTimeout(() => {
    appState.disconnectGlitchTimer = null;
    appState.disconnectGlitchUntil = 0;
    stopDisconnectGlitchAnimation();
    render();
  }, DISCONNECT_GLITCH_MS);
}

function stopDisconnectGlitch() {
  appState.disconnectGlitchUntil = 0;
  appState.disconnectGlitchStartedAt = 0;
  stopDisconnectGlitchAnimation();
  if (!appState.disconnectGlitchTimer) return;
  globalThis.clearTimeout(appState.disconnectGlitchTimer);
  appState.disconnectGlitchTimer = null;
}

function isDisconnectGlitchActive() {
  return Date.now() < appState.disconnectGlitchUntil;
}

function syncDisconnectGlitchAnimation(active) {
  if (active) startDisconnectGlitchAnimation();
  else stopDisconnectGlitchAnimation();
}

function startDisconnectGlitchAnimation() {
  if (appState.disconnectGlitchFrame) return;
  let lastUpdate = 0;
  const tick = (now) => {
    if (!isDisconnectGlitchActive()) {
      stopDisconnectGlitchAnimation();
      return;
    }

    if (now - lastUpdate > 48) {
      lastUpdate = now;
      updateDisconnectFilter();
    }

    appState.disconnectGlitchFrame = globalThis.requestAnimationFrame?.(tick) ?? null;
  };

  updateDisconnectFilter();
  appState.disconnectGlitchFrame = globalThis.requestAnimationFrame?.(tick) ?? null;
}

function stopDisconnectGlitchAnimation() {
  if (appState.disconnectGlitchFrame) {
    globalThis.cancelAnimationFrame?.(appState.disconnectGlitchFrame);
    appState.disconnectGlitchFrame = null;
  }

  root?.querySelector('#disconnectDisplacementMap')?.setAttribute('scale', '0');
}

function updateDisconnectFilter() {
  const turbulence = root?.querySelector('#disconnectTurbulence');
  const displacement = root?.querySelector('#disconnectDisplacementMap');
  const shell = root?.querySelector('.app-shell--disconnect-glitch');
  if (!turbulence || !displacement) return;

  const elapsed = Math.max(0, Date.now() - appState.disconnectGlitchStartedAt);
  const progress = Math.min(1, elapsed / DISCONNECT_GLITCH_MS);
  const envelope = progress < 0.18 ? progress / 0.18 : Math.max(0.18, 1 - ((progress - 0.18) / 0.82) * 0.62);
  const tear = 10 + Math.random() * 42 * envelope;
  const xFrequency = 0.025 + Math.random() * 0.16;
  const yFrequency = 0.06 + Math.random() * 0.2;

  turbulence.setAttribute('baseFrequency', `${xFrequency.toFixed(3)} ${yFrequency.toFixed(3)}`);
  turbulence.setAttribute('seed', String(Math.floor(1 + Math.random() * 97)));
  displacement.setAttribute('scale', tear.toFixed(1));
  shell?.style.setProperty('--disconnect-tear', tear.toFixed(1));
}

function bindEvents() {
  root.querySelectorAll('[data-place-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextPlace = appState.places[Number(button.dataset.placeIndex)];
      if (!nextPlace) return;
      appState.isScannerOpen = false;
      void audioDirector.play('target');
      void startRun(nextPlace);
    });
  });

  root.querySelectorAll('[data-bookmark-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const bookmark = appState.deckProfile.bookmarks[Number(button.dataset.bookmarkIndex)];
      if (!bookmark) return;
      void audioDirector.play('scanner');
      void scanFromBookmark(bookmark);
    });
  });

  root.querySelectorAll('[data-bookmark-destroy]').forEach((button) => {
    button.addEventListener('click', () => {
      destroyBookmark(button.dataset.bookmarkDestroy);
    });
  });

  root.querySelectorAll('[data-program]').forEach((button) => {
    button.addEventListener('click', () => {
      dispatch({ type: 'runProgram', program: button.dataset.program });
    });
  });

  root.querySelectorAll('[data-node-id]').forEach((node) => {
    node.addEventListener('click', () => {
      if (isRunFinished(appState.run)) return;
      if (appState.ignoreNextNodeClick) {
        appState.ignoreNextNodeClick = false;
        return;
      }
      handleNodeClick(node.dataset.nodeId);
    });
  });

  root.querySelectorAll('[data-deck-upgrade]').forEach((button) => {
    button.addEventListener('click', () => {
      const [category, key] = button.dataset.deckUpgrade.split(':');
      const result = upgradeDeckProfile(appState.deckProfile, category, key);
      appState.deckProfile = result.profile;
      appState.deckMessage = deckUpgradeMessage(result, category, key);
      if (result.changed) void syncDeckProfile();
      render();
    });
  });

  root.querySelectorAll('[data-help-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      appState.helpTab = button.dataset.helpTab;
      void audioDirector.play('selectProgram');
      render();
    });
  });

  root.querySelectorAll('[data-audio-volume]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = Number(input.value) / 100;
      if (input.dataset.audioVolume === 'music') audioDirector.setMusicVolume(value);
      if (input.dataset.audioVolume === 'sfx') audioDirector.setSfxVolume(value);
      const output = input.closest('.settings-audio-row')?.querySelector('strong');
      if (output) output.textContent = String(Math.round(value * 100));
    });
  });

  root.querySelectorAll('[data-theme-option]').forEach((button) => {
    button.addEventListener('click', () => {
      appState.theme = applyTheme(saveThemePreference(button.dataset.themeOption));
      void audioDirector.play('selectProgram');
      render();
    });
  });

  root.querySelectorAll('[data-avatar-option]').forEach((button) => {
    button.addEventListener('click', () => {
      updateRunnerIdentity({ avatar: button.dataset.avatarOption });
    });
  });

  root.querySelector('[data-shadow-name-save]')?.addEventListener('click', () => {
    saveShadowNameFromInput();
  });

  root.querySelector('[data-shadow-name-input]')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    saveShadowNameFromInput();
  });

  bindNodeMapEvents();

  root.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'jackOut') dispatch({ type: 'jackOut' });
      if (action === 'scanLocal') void scanLocalTargets();
      if (action === 'toggleMusic') void toggleMusic();
      if (action === 'toggleSfx') void toggleSfx();
      if (action === 'signInGuest') void signInGuestCloud();
      if (action === 'signInGoogle') void signInGoogleCloud();
      if (action === 'linkGoogle') void linkGoogleCloud();
      if (action === 'signOutCloud') void signOutCloud();
      if (action === 'continueLocal') {
        appState.isSettingsOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'toggleSettings') {
        appState.isSettingsOpen = !appState.isSettingsOpen;
        appState.isHelpOpen = false;
        appState.isScannerOpen = false;
        appState.isDeckOpen = false;
        appState.isRunLogOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'openHelp') {
        appState.isHelpOpen = true;
        appState.isSettingsOpen = false;
        appState.isScannerOpen = false;
        appState.isDeckOpen = false;
        appState.isRunLogOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'closeHelp') {
        appState.isHelpOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'closeSettings') {
        appState.isSettingsOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'toggleScanner') {
        appState.isScannerOpen = true;
        appState.isSettingsOpen = false;
        appState.isHelpOpen = false;
        appState.isDeckOpen = false;
        appState.isRunLogOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'closeScanner') {
        appState.isScannerOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'toggleDeck') {
        appState.isDeckOpen = !appState.isDeckOpen;
        appState.isSettingsOpen = false;
        appState.isHelpOpen = false;
        appState.isScannerOpen = false;
        appState.isRunLogOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'closeDeck') {
        appState.isDeckOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'toggleRunLog') {
        appState.isRunLogOpen = !appState.isRunLogOpen;
        appState.isSettingsOpen = false;
        appState.isHelpOpen = false;
        appState.isScannerOpen = false;
        appState.isDeckOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'closeRunLog') {
        appState.isRunLogOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
    });
  });

  scrollRunLogToLatest();
}

async function toggleMusic() {
  syncAudioState();
  await audioDirector.toggleMusic();
  render();
}

async function toggleSfx() {
  await audioDirector.toggleSfx();
  render();
}

async function scanLocalTargets() {
  appState.isScannerOpen = true;
  void audioDirector.play('scanner');

  if (isLocalTestServer()) {
    appState.locationMessage = 'Proxy local de pruebas activo: scanner centrado en Valencia.';
    render();
    await scanFromPosition(VALENCIA_TEST_POSITION, 'Scanner local activo desde Valencia');
    appState.selectedPlace = appState.places[0] ?? appState.selectedPlace;
    appState.isScannerOpen = true;
    render();
    return;
  }

  const permissionState = await getGeolocationPermissionState();
  appState.locationMessage = scannerPermissionMessage(permissionState);
  render();

  try {
    const position = await requestCurrentPosition();
    await scanFromPosition(position, 'Scanner local activo');
    appState.selectedPlace = appState.places[0] ?? appState.selectedPlace;
    appState.isScannerOpen = true;
    render();
  } catch (error) {
    appState.places = demoPlaces;
    appState.locationMessage = `No se pudo usar ubicación: ${error.message}. Seguimos con objetivos demo.`;
    appState.selectedPlace = appState.places[0] ?? appState.selectedPlace;
    appState.isScannerOpen = true;
    render();
  }
}

function isLocalTestServer() {
  return ['127.0.0.1', 'localhost', '::1'].includes(globalThis.location?.hostname);
}

function scannerPermissionMessage(permissionState) {
  if (permissionState === 'denied') {
    return 'La ubicación está bloqueada para este sitio. Actívala en los permisos del navegador para escanear objetivos reales.';
  }
  if (permissionState === 'prompt') {
    return 'El navegador debería pedir permiso de ubicación ahora. Solo se usa para buscar objetivos cercanos.';
  }
  if (permissionState === 'granted') {
    return 'Permiso de ubicación concedido. Buscando objetivos cercanos...';
  }
  return 'Solicitando ubicación para buscar objetivos cercanos...';
}

void boot();
registerServiceWorker();

function audioEventForAction(action) {
  if (action.type === 'runProgram') {
    return {
      scan: 'scan',
      extract: 'extract',
      spike: 'spike',
      ghost: 'ghost',
      shield: 'shield',
    }[action.program] ?? 'runProgram';
  }

  return {
    move: 'move',
    selectProgram: 'selectProgram',
    jackOut: 'jackOut',
  }[action.type];
}

function scrollRunLogToLatest() {
  const log = root?.querySelector('.run-log-dialog__list');
  if (!log) return;
  log.scrollTop = log.scrollHeight;
}

function updateMapLogMessage(force = false) {
  const length = appState.run?.log?.length ?? 0;
  const text = appState.run?.log?.[length - 1];
  if (!text) {
    appState.lastMapLogKey = null;
    appState.mapLogMessage = null;
    return;
  }

  const key = `${appState.runSessionId}:${appState.run?.turn ?? 0}:${appState.run?.status ?? 'run'}:${text}`;
  if (!force && key === appState.lastMapLogKey) return;
  appState.lastMapLogKey = key;
  appState.mapLogMessage = {
    key,
    text,
    expiresAt: Date.now() + MAP_LOG_MESSAGE_MS,
  };
}

function getVisibleMapLogMessage() {
  if (!appState.mapLogMessage) return null;
  if (Date.now() > appState.mapLogMessage.expiresAt) return null;
  return appState.mapLogMessage;
}

function syncMapReveal(previousRun, nextRun) {
  if (!appState.system) return;
  const nodeIds = Object.entries(nextRun.nodeStates)
    .filter(([nodeId, state]) => state !== NODE_RUNTIME_STATE.UNKNOWN
      && (previousRun.nodeStates[nodeId] ?? NODE_RUNTIME_STATE.UNKNOWN) === NODE_RUNTIME_STATE.UNKNOWN)
    .map(([nodeId]) => nodeId);

  if (nodeIds.length === 0) return;

  const nodeIdSet = new Set(nodeIds);
  const edgeKeys = appState.system.edges
    .filter((edge) => nodeIdSet.has(edge.from) || nodeIdSet.has(edge.to))
    .filter((edge) => nextRun.nodeStates[edge.from] !== NODE_RUNTIME_STATE.UNKNOWN
      && nextRun.nodeStates[edge.to] !== NODE_RUNTIME_STATE.UNKNOWN)
    .map(getMapEdgeKey);

  appState.mapReveal = {
    nodeIds,
    edgeKeys,
    expiresAt: Date.now() + MAP_REVEAL_MS,
  };
  debugLog('mapReveal:sync', { nodeIds, edgeKeys });
}

function getVisibleMapReveal() {
  if (!appState.mapReveal) return null;
  if (Date.now() > appState.mapReveal.expiresAt) return null;
  return appState.mapReveal;
}

function getMapEdgeKey(edge) {
  return [edge.from, edge.to].sort().join(':');
}

function syncNodeVisit(action, previousRun, nextRun) {
  if (action.type === 'move') {
    const startedVisit = maybeStartNodeVisit(action, previousRun, nextRun);
    const moved = action.nodeId
      && action.nodeId === nextRun.currentNodeId
      && previousRun.currentNodeId !== nextRun.currentNodeId;
    if (!startedVisit && moved && appState.nodeVisit) clearNodeVisit();
    return;
  }

  if (!appState.nodeVisit) return;
  if (!['runProgram', 'scan', 'extract', 'jackOut'].includes(action.type)) return;
  if (appState.nodeVisit.mode === 'visited') {
    clearNodeVisit();
    return;
  }

  const node = getSystemNode(appState.nodeVisit.nodeId);
  if (!node) {
    clearNodeVisit();
    return;
  }

  const resolution = getNodeVisitResolutionLabel(node, previousRun, nextRun);
  if (resolution) {
    finishNodeVisit(resolution);
    return;
  }

  if (isRunFinished(nextRun)) {
    failNodeVisit(true);
    return;
  }

  if (didRunPressureIncrease(previousRun, nextRun)) {
    failNodeVisit();
  }
}

function maybeStartNodeVisit(action, previousRun, nextRun) {
  if (!action.nodeId || action.nodeId !== nextRun.currentNodeId) return false;
  if (isRunFinished(nextRun)) return false;
  const previousState = previousRun.nodeStates[action.nodeId] ?? NODE_RUNTIME_STATE.UNKNOWN;
  return startNodeVisit(action.nodeId, previousRun, nextRun, {
    fromNodeId: previousRun.currentNodeId,
    previousState,
  });
}

function handleNodeClick(nodeId) {
  if (!nodeId || !appState.run) return;
  const state = appState.run.nodeStates[nodeId] ?? NODE_RUNTIME_STATE.UNKNOWN;
  const isKnown = state !== NODE_RUNTIME_STATE.UNKNOWN;
  const isCurrent = nodeId === appState.run.currentNodeId;
  const isReachable = isNodeReachableFromCurrent(nodeId);

  if (isKnown && (isCurrent || !isReachable)) {
    startNodeVisit(nodeId, appState.run, appState.run, {
      fromNodeId: isCurrent ? null : appState.run.currentNodeId,
      previousState: state,
    });
    void audioDirector.play('selectProgram');
    render();
    return;
  }

  dispatch({ type: 'move', nodeId });
}

function startNodeVisit(nodeId, previousRun, nextRun, options = {}) {
  const node = getSystemNode(nodeId);
  if (!node) return false;

  stopNodeVisitTimer();
  const visitId = `${appState.runSessionId}:${appState.nodeVisitSequence + 1}`;
  appState.nodeVisitSequence += 1;
  const previousState = options.previousState ?? previousRun.nodeStates[nodeId] ?? NODE_RUNTIME_STATE.UNKNOWN;
  const hasObjective = hasNodeVisitObjective(node, nextRun);
  const mode = !hasObjective && [NODE_RUNTIME_STATE.VISITED, NODE_RUNTIME_STATE.COMPROMISED].includes(previousState)
    ? 'visited'
    : 'active';
  const recommendedProgram = mode === 'visited' ? null : getRecommendedProgram(node, nextRun);
  const autoDismiss = mode === 'active' && !hasObjective;
  appState.nodeVisit = {
    visitId,
    runSessionId: appState.runSessionId,
    nodeId: node.id,
    fromNodeId: options.fromNodeId ?? previousRun.currentNodeId,
    phase: 'focus',
    mode,
    startedAt: Date.now(),
    recommendedProgram,
    autoDismiss,
    stamp: null,
  };
  debugLog('nodeVisit:start', {
    visitId,
    nodeId: node.id,
    fromNodeId: options.fromNodeId ?? previousRun.currentNodeId,
    nodeKind: node.kind,
    previousState,
    mode,
    recommendedProgram,
    autoDismiss,
  });
  if (autoDismiss) {
    scheduleNodeVisitAutoClear(visitId);
    return true;
  }
  return true;
}

function isNodeReachableFromCurrent(nodeId) {
  if (!appState.system || !appState.run) return false;
  if (nodeId === appState.run.currentNodeId) return false;
  if ((appState.run.nodeStates[nodeId] ?? NODE_RUNTIME_STATE.UNKNOWN) === NODE_RUNTIME_STATE.UNKNOWN) return false;
  return appState.system.edges.some((edge) =>
    (edge.from === appState.run.currentNodeId && edge.to === nodeId)
    || (edge.to === appState.run.currentNodeId && edge.from === nodeId),
  );
}

function scheduleNodeVisitAutoClear(visitId) {
  stopNodeVisitTimer();
  appState.nodeVisitTimer = globalThis.setTimeout(() => {
    appState.nodeVisitTimer = null;
    if (!isActiveNodeVisit(visitId) || appState.nodeVisit.phase !== 'focus') return;
    finishNodeVisit('CLEARED', visitId);
  }, getMotionDuration(NODE_VISIT_EMPTY_MS));
}

function finishNodeVisit(stamp, visitId = appState.nodeVisit?.visitId) {
  if (!isActiveNodeVisit(visitId)) return;
  stopNodeVisitTimer();
  debugLog('nodeVisit:finish', { visitId, stamp });
  appState.nodeVisit = {
    ...appState.nodeVisit,
    phase: 'resolved',
    stamp,
  };
  appState.nodeVisitTimer = globalThis.setTimeout(() => {
    appState.nodeVisitTimer = null;
    if (!isActiveNodeVisit(visitId)) {
      debugLog('nodeVisit:clearIgnored', { visitId, activeVisitId: appState.nodeVisit?.visitId ?? null });
      return;
    }
    clearNodeVisit();
    render();
  }, getMotionDuration(NODE_VISIT_RESOLVE_MS));
  render();
}

function failNodeVisit(clearAfter = false, visitId = appState.nodeVisit?.visitId) {
  if (!isActiveNodeVisit(visitId)) return;
  stopNodeVisitTimer();
  debugLog('nodeVisit:fail', { visitId, clearAfter });
  appState.nodeVisit = {
    ...appState.nodeVisit,
    phase: 'failed',
    stamp: 'RETURN HOSTIL',
  };
  appState.nodeVisitTimer = globalThis.setTimeout(() => {
    appState.nodeVisitTimer = null;
    if (!isActiveNodeVisit(visitId) || appState.nodeVisit.phase !== 'failed') return;
    if (clearAfter) {
      clearNodeVisit();
      render();
      return;
    }
    appState.nodeVisit = { ...appState.nodeVisit, phase: 'focus', stamp: null };
    render();
  }, getMotionDuration(NODE_VISIT_RESOLVE_MS));
}

function clearNodeVisit() {
  stopNodeVisitTimer();
  debugLog('nodeVisit:clear', {
    visitId: appState.nodeVisit?.visitId ?? null,
  });
  appState.nodeVisit = null;
}

function stopNodeVisitTimer() {
  if (!appState.nodeVisitTimer) return;
  globalThis.clearTimeout(appState.nodeVisitTimer);
  appState.nodeVisitTimer = null;
}

function isActiveNodeVisit(visitId) {
  return Boolean(
    visitId
    && appState.nodeVisit?.visitId === visitId
    && appState.nodeVisit.runSessionId === appState.runSessionId,
  );
}

function getSystemNode(nodeId) {
  return appState.system?.nodes.find((node) => node.id === nodeId);
}

function getRecommendedProgram(node, run) {
  const event = getActiveNodeEvent(node, run);
  if (node.ice && !run.neutralizedIce.includes(node.id)) return 'spike';
  if (event?.program && event.program !== 'jackOut') return event.program;
  if (['data', 'database', 'core'].includes(node.kind)) return 'extract';
  if (node.kind === 'exit' || event?.program === 'jackOut') return 'jackOut';
  return 'scan';
}

function hasNodeVisitObjective(node, run) {
  if (node.ice && !run.neutralizedIce.includes(node.id)) return true;
  if (getActiveNodeEvent(node, run)) return true;
  if (['data', 'database', 'core'].includes(node.kind) && run.nodeStates[node.id] !== NODE_RUNTIME_STATE.COMPROMISED) return true;
  return node.kind === 'exit';
}

function getActiveNodeEvent(node, run) {
  if (!node?.event || (run.resolvedEvents ?? []).includes(node.id)) return null;
  return nodeEvents[node.event] ?? null;
}

function getNodeVisitResolutionLabel(node, previousRun, nextRun) {
  const wasCompromised = previousRun.nodeStates[node.id] === NODE_RUNTIME_STATE.COMPROMISED;
  const isCompromised = nextRun.nodeStates[node.id] === NODE_RUNTIME_STATE.COMPROMISED;
  if (!wasCompromised && isCompromised) return 'EXTRACTED';

  const hadIce = node.ice && !previousRun.neutralizedIce.includes(node.id);
  if (hadIce && nextRun.neutralizedIce.includes(node.id)) return 'SEALED';

  const hadEvent = node.event && !(previousRun.resolvedEvents ?? []).includes(node.id);
  if (hadEvent && (nextRun.resolvedEvents ?? []).includes(node.id)) return getEventResolutionStamp(node.event);

  if (previousRun.status !== nextRun.status && nextRun.status === 'escaped') return 'EXFIL';
  return null;
}

function getEventResolutionStamp(eventKind) {
  return {
    archive: 'EXTRACTED',
    core: 'EXTRACTED',
    gate: 'BYPASS',
    camera: 'BLINDED',
    trap: 'SEALED',
    decoy: 'CLEARED',
    exit: 'EXFIL',
  }[eventKind] ?? 'CLEARED';
}

function didRunPressureIncrease(previousRun, nextRun) {
  return nextRun.alert > previousRun.alert
    || nextRun.trace > previousRun.trace
    || nextRun.integrity < previousRun.integrity
    || nextRun.disabledPrograms.length > previousRun.disabledPrograms.length;
}

function getMotionDuration(duration) {
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  return reducedMotion ? 0 : duration;
}

function debugLog(event, details = {}) {
  const entry = {
    at: new Date().toISOString(),
    event,
    route: getAppRoute(),
    runSessionId: appState.runSessionId,
    run: summarizeRun(appState.run),
    nodeVisit: summarizeNodeVisit(appState.nodeVisit),
    ...details,
  };

  console.info(`[shadowHack] ${event}`, entry);
  persistDebugLog(entry);
}

function persistDebugLog(entry) {
  try {
    const previous = JSON.parse(globalThis.sessionStorage?.getItem(DEBUG_LOG_STORAGE_KEY) ?? '[]');
    const next = [...(Array.isArray(previous) ? previous : []), entry].slice(-DEBUG_LOG_LIMIT);
    globalThis.sessionStorage?.setItem(DEBUG_LOG_STORAGE_KEY, JSON.stringify(next));
    globalThis.__shadowHackDebugLog = next;
  } catch (error) {
    console.warn('[shadowHack] debug log persistence failed', error);
  }
}

function summarizeRun(run) {
  if (!run) return null;
  return {
    status: run.status,
    currentNodeId: run.currentNodeId,
    turn: run.turn,
    alert: run.alert,
    trace: run.trace,
    integrity: run.integrity,
    hasPayload: run.hasPayload,
    lootTokens: run.lootTokens,
    selectedProgram: run.selectedProgram,
    disabledPrograms: [...(run.disabledPrograms ?? [])],
    neutralizedIce: [...(run.neutralizedIce ?? [])],
    resolvedEvents: [...(run.resolvedEvents ?? [])],
  };
}

function summarizeNodeVisit(nodeVisit) {
  if (!nodeVisit) return null;
  return {
    visitId: nodeVisit.visitId,
    runSessionId: nodeVisit.runSessionId,
    nodeId: nodeVisit.nodeId,
    fromNodeId: nodeVisit.fromNodeId,
    phase: nodeVisit.phase,
    mode: nodeVisit.mode,
    recommendedProgram: nodeVisit.recommendedProgram,
    autoDismiss: nodeVisit.autoDismiss,
    stamp: nodeVisit.stamp,
  };
}

function bindNodeMapEvents() {
  const surface = root?.querySelector('[data-map-surface]');
  if (!surface) return;

  surface.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomMapAtPoint(event.deltaY > 0 ? 1.16 : 0.86, event.clientX, event.clientY);
  }, { passive: false });

  surface.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest?.('[data-node-id]')) return;

    if (appState.mapPointers.size === 0) appState.mapGestureMoved = false;
    appState.mapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    surface.setPointerCapture?.(event.pointerId);

    if (appState.mapPointers.size === 1) startMapPan(event);
    if (appState.mapPointers.size === 2) startMapPinch();
  });

  surface.addEventListener('pointermove', (event) => {
    if (!appState.mapPointers.has(event.pointerId)) return;
    appState.mapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (appState.mapPointers.size >= 2) {
      updateMapPinch();
      return;
    }

    updateMapPan(event, surface);
  });

  surface.addEventListener('pointerup', finishMapPointer);
  surface.addEventListener('pointercancel', finishMapPointer);
}

function finishMapPointer(event) {
  const wasTrackingPointer = appState.mapPointers.has(event.pointerId);
  const finishedPan = appState.mapPointer?.id === event.pointerId;
  if (!wasTrackingPointer && !finishedPan && !appState.mapPinch) return;

  appState.mapPointers.delete(event.pointerId);
  if (finishedPan) appState.mapPointer = null;
  if (appState.mapPointers.size < 2) appState.mapPinch = null;
  if (appState.mapPointers.size > 0) return;

  appState.ignoreNextNodeClick = appState.mapGestureMoved;
  appState.mapGestureMoved = false;
  if (appState.ignoreNextNodeClick) {
    globalThis.setTimeout(() => {
      appState.ignoreNextNodeClick = false;
    }, 80);
  }
}

function startMapPan(event) {
  appState.mapPointer = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startView: { ...appState.mapView },
    hasMoved: false,
  };
}

function updateMapPan(event, surface) {
  const pointer = appState.mapPointer;
  if (!pointer || pointer.id !== event.pointerId) return;

  const rect = surface.getBoundingClientRect();
  const deltaX = event.clientX - pointer.startX;
  const deltaY = event.clientY - pointer.startY;
  if (Math.abs(deltaX) + Math.abs(deltaY) > MAP_DRAG_THRESHOLD_PX) {
    pointer.hasMoved = true;
    appState.mapGestureMoved = true;
  }

  const nextView = {
    ...pointer.startView,
    x: pointer.startView.x - (deltaX / rect.width) * pointer.startView.width,
    y: pointer.startView.y - (deltaY / rect.height) * pointer.startView.height,
  };
  setMapView(nextView);
}

function startMapPinch() {
  const pointers = getFirstTwoMapPointers();
  if (!pointers) return;
  const [first, second] = pointers;
  appState.mapPointer = null;
  appState.mapGestureMoved = true;
  appState.mapPinch = {
    startDistance: getPointerDistance(first, second),
    startView: { ...appState.mapView },
  };
}

function updateMapPinch() {
  const pinch = appState.mapPinch;
  const pointers = getFirstTwoMapPointers();
  if (!pinch || !pointers) return;
  const [first, second] = pointers;
  const distance = getPointerDistance(first, second);
  if (distance < 4 || pinch.startDistance < 4) return;
  const center = getPointerCenter(first, second);
  zoomMapAtPoint(pinch.startDistance / distance, center.x, center.y, pinch.startView);
}

function getFirstTwoMapPointers() {
  const pointers = [...appState.mapPointers.values()];
  if (pointers.length < 2) return null;
  return [pointers[0], pointers[1]];
}

function getPointerDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getPointerCenter(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

async function scanFromBookmark(bookmark) {
  const radius = getScanRadius();
  appState.locationMessage = `Escaneando desde bookmark ${bookmark.hostAlias} (${radius}m)...`;
  render();
  await scanFromPosition({ lat: bookmark.lat, lon: bookmark.lon }, `Scanner remoto desde ${bookmark.hostAlias}`);
  appState.isScannerOpen = true;
  render();
}

function scheduleTargetPrefetchForRun(place) {
  appState.targetPrefetchKeys.clear();
  appState.targetPrefetchQueue = [];
  appState.targetPrefetchRunning = false;
  appState.targetPrefetchCount = 0;
  if (!targetsEndpoint) return;

  const radius = getScanRadius();
  enqueueTargetPrefetch(place, radius, 'host actual', { force: false });
  for (const bookmark of appState.deckProfile.bookmarks.slice(0, 2)) {
    enqueueTargetPrefetch(bookmark, radius, `bookmark ${bookmark.hostAlias}`, { force: false });
  }
  void drainTargetPrefetchQueue(appState.runSessionId);
}

function ensureBookmarkZoneCached(bookmark) {
  if (!targetsEndpoint || !bookmark) return;
  const radius = getScanRadius();
  const key = targetPrefetchKey(bookmark, radius);
  if (appState.bookmarkPrefetchKeys.has(key)) return;
  const queued = enqueueTargetPrefetch(bookmark, radius, `bookmark guardado ${bookmark.hostAlias}`, { force: true });
  if (!queued) return;
  appState.bookmarkPrefetchKeys.add(key);
  void drainTargetPrefetchQueue(appState.runSessionId);
}

function enqueueTargetPrefetch(target, radius, label, options = {}) {
  if (!Number.isFinite(target?.lat) || !Number.isFinite(target?.lon)) return false;
  const limit = options.force ? SCANNER_PREFETCH_LIMIT + SCANNER_BOOKMARK_PREFETCH_LIMIT : SCANNER_PREFETCH_LIMIT;
  if (appState.targetPrefetchCount + appState.targetPrefetchQueue.length >= limit) return false;
  const key = targetPrefetchKey(target, radius);
  if (!options.force && appState.targetPrefetchKeys.has(key)) return false;
  appState.targetPrefetchKeys.add(key);
  appState.targetPrefetchQueue.push({
    label,
    position: { lat: target.lat, lon: target.lon },
    radius,
  });
  return true;
}

async function drainTargetPrefetchQueue(sessionId) {
  if (appState.targetPrefetchRunning || appState.targetPrefetchQueue.length === 0) return;
  const next = appState.targetPrefetchQueue.shift();
  appState.targetPrefetchRunning = true;
  appState.targetPrefetchCount += 1;
  try {
    const result = await searchBackendTargets(next.position, next.radius);
    debugLog('scanner:prefetchReady', {
      label: next.label,
      source: result.source,
      cacheState: result.cacheState,
      count: result.places.length,
    });
  } catch (error) {
    debugLog('scanner:prefetchFailed', { label: next.label, message: error.message });
  } finally {
    if (sessionId !== appState.runSessionId) return;
    appState.targetPrefetchRunning = false;
    void drainTargetPrefetchQueue(sessionId);
  }
}

function targetPrefetchKey(target, radius) {
  return `${Math.round(target.lat * 2000)}:${Math.round(target.lon * 2000)}:${radius}`;
}

async function scanFromPosition(position, successLabel) {
  const radius = getScanRadius();
  try {
    const realScan = await searchRealPlaces(position, radius);
    appState.places = await fillWithSandboxTargets(realScan.places, position, radius);
    const realCount = realScan.places.length;
    const sandboxCount = appState.places.length - realCount;
    appState.locationMessage = scannerResultMessage(successLabel, realScan, sandboxCount, radius);
  } catch (providerError) {
    console.warn('Overpass unavailable, using demo nearby provider', providerError);
    appState.places = await fillWithSandboxTargets([], position, radius);
    const osmReason = providerError.message.startsWith('sin objetivos')
      ? `OSM respondió sin objetivos útiles (${providerError.message})`
      : `OSM/Overpass no respondió (${providerError.message})`;
    appState.locationMessage = `${successLabel}. ${osmReason}; objetivos demo en ${radius}m.`;
  }
}

async function searchRealPlaces(position, radius) {
  if (targetsEndpoint) {
    try {
      return await searchBackendTargets(position, radius);
    } catch (error) {
      console.warn('Targets backend unavailable, falling back to direct Overpass', error);
      debugLog('scanner:backendFallback', { message: error.message });
    }
  }
  return searchOverpassPlaces(position, radius);
}

async function searchOverpassPlaces(position, radius) {
  const places = await searchNearbyPlaces(overpassProvider, position, radius);
  if (places.length >= MIN_SCANNER_TARGETS || radius >= EXPANDED_SCAN_RADIUS) {
    return {
      places,
      radius,
      source: 'overpass',
      cacheState: 'live',
      providerHealth: { overpass: places.length > 0 ? 'ok' : 'partial', geoapify: 'not_configured' },
    };
  }
  const expandedPlaces = await searchNearbyPlaces(overpassProvider, position, EXPANDED_SCAN_RADIUS);
  return {
    places: mergePlaces(places, expandedPlaces),
    radius: EXPANDED_SCAN_RADIUS,
    source: 'overpass',
    cacheState: 'live',
    providerHealth: { overpass: expandedPlaces.length > 0 ? 'ok' : 'partial', geoapify: 'not_configured' },
  };
}

async function searchBackendTargets(position, radius) {
  const response = await fetch(targetsEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: position.lat,
      lon: position.lon,
      radius,
      limit: SCANNER_BACKEND_LIMIT,
      minTargets: MIN_SCANNER_TARGETS,
    }),
  });
  if (!response.ok) throw new Error(`backend HTTP ${response.status}`);
  const payload = await response.json();
  const places = Array.isArray(payload.places)
    ? payload.places.filter((place) => place?.name && place?.providerId)
    : [];
  debugLog('scanner:backendResult', {
    source: payload.source,
    cacheState: payload.cacheState,
    count: places.length,
    providerHealth: payload.providerHealth,
  });
  return {
    places,
    radius: payload.radius ?? radius,
    source: payload.source ?? 'backend',
    cacheState: payload.cacheState ?? 'miss',
    providerHealth: payload.providerHealth ?? {},
    backend: true,
  };
}

async function fillWithSandboxTargets(realPlaces, position, radius) {
  if (realPlaces.length >= MIN_SCANNER_TARGETS) return realPlaces;
  const sandboxPlaces = await searchNearbyPlaces(demoNearbyProvider, position, radius);
  return mergePlaces(realPlaces, sandboxPlaces).slice(0, MIN_SCANNER_TARGETS);
}

function mergePlaces(...placeGroups) {
  const seen = new Set();
  return placeGroups.flat().filter((place) => {
    const key = place.providerId ?? `${place.provider}:${place.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scannerResultMessage(successLabel, realScan, sandboxCount, baseRadius) {
  const realCount = realScan.places.length;
  const expandedLabel = realScan.radius > baseRadius ? ` tras ampliar a ${realScan.radius}m` : ` en ${baseRadius}m`;
  const source = scannerSourceLabel(realScan);
  if (realCount === 0) {
    return `${successLabel}. Sin objetivos reales útiles${expandedLabel}; ${sandboxCount} sandbox listos.`;
  }
  if (sandboxCount > 0) {
    return `${successLabel}. ${realCount} ${source}${expandedLabel}; +${sandboxCount} sandbox de relleno.`;
  }
  return `${successLabel}. ${realCount} ${source}${expandedLabel}.`;
}

function scannerSourceLabel(realScan) {
  if (realScan.cacheState === 'fresh') return 'objetivos cacheados';
  if (realScan.cacheState === 'stale') return 'objetivos de cache antigua';
  if (realScan.source === 'mixed') return 'objetivos OSM + Geoapify';
  if (realScan.source === 'geoapify') return 'objetivos Geoapify';
  if (realScan.source === 'overpass') return 'objetivos OSM encontrados';
  return 'objetivos reales encontrados';
}

function zoomMapAtPoint(factor, clientX, clientY, sourceView = appState.mapView) {
  const surface = root?.querySelector('[data-map-surface]');
  if (!surface) {
    zoomMapAtCenter(factor);
    return;
  }
  const rect = surface.getBoundingClientRect();
  const anchorX = sourceView.x + ((clientX - rect.left) / rect.width) * sourceView.width;
  const anchorY = sourceView.y + ((clientY - rect.top) / rect.height) * sourceView.height;
  zoomMapFromView(factor, anchorX, anchorY, sourceView);
}

function zoomMapFromView(factor, anchorX, anchorY, view = appState.mapView) {
  const minWidth = Math.min(MIN_MAP_SIZE, appState.mapBounds.width);
  const minHeight = Math.min(MIN_MAP_SIZE, appState.mapBounds.height);
  const width = clamp(view.width * factor, minWidth, appState.mapBounds.width);
  const height = clamp(view.height * factor, minHeight, appState.mapBounds.height);
  const x = anchorX - ((anchorX - view.x) / view.width) * width;
  const y = anchorY - ((anchorY - view.y) / view.height) * height;
  setMapView({ x, y, width, height });
}

function setMapView(view) {
  stopMapViewAnimation();
  applyMapView(view);
}

function applyMapView(view) {
  appState.mapView = clampMapView(view);
  const surface = root?.querySelector('[data-map-surface]');
  if (!surface) return;
  const { x, y, width, height } = appState.mapView;
  surface.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
}

function animateMapViewTo(view, duration = MAP_FOCUS_ANIMATION_MS) {
  stopMapViewAnimation();
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (reducedMotion || duration <= 0) {
    applyMapView(view);
    return;
  }

  const from = { ...appState.mapView };
  const to = clampMapView(view);
  const startedAt = performance.now();

  const tick = (now) => {
    const progress = clamp((now - startedAt) / duration, 0, 1);
    const eased = easeInOutCubic(progress);
    applyMapView({
      x: lerp(from.x, to.x, eased),
      y: lerp(from.y, to.y, eased),
      width: lerp(from.width, to.width, eased),
      height: lerp(from.height, to.height, eased),
    });
    if (progress < 1) {
      appState.mapViewAnimationFrame = requestAnimationFrame(tick);
      return;
    }
    appState.mapViewAnimationFrame = null;
  };

  appState.mapViewAnimationFrame = requestAnimationFrame(tick);
}

function scheduleOpeningMapFit(runSessionId) {
  const schedule = globalThis.requestAnimationFrame ?? ((callback) => globalThis.setTimeout(() => callback(performance.now()), 0));
  schedule(() => {
    if (runSessionId !== appState.runSessionId || !appState.system || !appState.run || isRunFinished(appState.run)) return;
    const targetView = getSafeOpeningMapView(appState.system);
    if (!targetView) return;
    appState.mapBounds = expandBoundsToContainView(appState.mapBounds, targetView);
    animateMapViewTo(targetView, MAP_OPEN_ANIMATION_MS);
  });
}

function getSafeOpeningMapView(system) {
  const surface = root?.querySelector('[data-map-surface]');
  const mapElement = root?.querySelector('.node-map');
  if (!surface || !mapElement) return null;

  const rect = surface.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const graphBounds = getMapGraphContentBounds(system);
  const safeInsets = getMapSafeInsets(mapElement, rect);
  const usableWidth = Math.max(1, rect.width - safeInsets.left - safeInsets.right);
  const usableHeight = Math.max(1, rect.height - safeInsets.top - safeInsets.bottom);
  const scale = Math.max(graphBounds.width / usableWidth, graphBounds.height / usableHeight);
  const width = Math.max(MIN_MAP_SIZE, rect.width * scale);
  const height = Math.max(MIN_MAP_SIZE, rect.height * scale);
  const safeCenterX = safeInsets.left + usableWidth / 2;
  const safeCenterY = safeInsets.top + usableHeight / 2;

  return {
    x: graphBounds.x + graphBounds.width / 2 - (safeCenterX / rect.width) * width,
    y: graphBounds.y + graphBounds.height / 2 - (safeCenterY / rect.height) * height,
    width,
    height,
  };
}

function getMapSafeInsets(mapElement, rect) {
  const topInset = ['.node-map__heading', '.node-map__actions', '.node-map__message']
    .map((selector) => getElementBottomInset(mapElement, selector))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);
  const bottomInset = getElementTopInset(mapElement, '.node-map__meters');

  return {
    left: MAP_FIT_SIDE_SAFE_PX,
    right: MAP_FIT_SIDE_SAFE_PX,
    top: Math.min(rect.height * 0.34, Math.max(0, topInset + MAP_FIT_CHROME_GAP_PX)),
    bottom: Math.min(rect.height * 0.3, Math.max(0, bottomInset + MAP_FIT_CHROME_GAP_PX)),
  };
}

function getElementBottomInset(container, selector) {
  const element = container.querySelector(selector);
  if (!element) return 0;
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return Math.max(0, elementRect.bottom - containerRect.top);
}

function getElementTopInset(container, selector) {
  const element = container.querySelector(selector);
  if (!element) return 0;
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return Math.max(0, containerRect.bottom - elementRect.top);
}

function expandBoundsToContainView(bounds, view) {
  const minX = Math.min(bounds.x, view.x);
  const minY = Math.min(bounds.y, view.y);
  const maxX = Math.max(bounds.x + bounds.width, view.x + view.width);
  const maxY = Math.max(bounds.y + bounds.height, view.y + view.height);
  return {
    x: minX,
    y: minY,
    width: Math.max(MIN_MAP_SIZE, maxX - minX),
    height: Math.max(MIN_MAP_SIZE, maxY - minY),
  };
}

function stopMapViewAnimation() {
  if (!appState.mapViewAnimationFrame) return;
  cancelAnimationFrame(appState.mapViewAnimationFrame);
  appState.mapViewAnimationFrame = null;
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;
}

function lerp(from, to, progress) {
  return from + (to - from) * progress;
}

function clampMapView(view) {
  const bounds = appState.mapBounds ?? DEFAULT_MAP_BOUNDS;
  const minWidth = Math.min(MIN_MAP_SIZE, bounds.width);
  const minHeight = Math.min(MIN_MAP_SIZE, bounds.height);
  const width = clamp(view.width, minWidth, bounds.width);
  const height = clamp(view.height, minHeight, bounds.height);
  return {
    x: clamp(view.x, bounds.x, bounds.x + bounds.width - width),
    y: clamp(view.y, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
}

function getMapBounds(system) {
  if (!system?.nodes?.length) return { ...DEFAULT_MAP_BOUNDS };
  const xs = system.nodes.map((node) => node.x);
  const ys = system.nodes.map((node) => node.y + MAP_GRAPH_OFFSET_Y);
  const minX = Math.min(...xs) - MAP_VIEW_PADDING;
  const maxX = Math.max(...xs) + MAP_VIEW_PADDING;
  const minY = Math.min(...ys) - MAP_VIEW_PADDING;
  const maxY = Math.max(...ys) + MAP_VIEW_PADDING + MAP_LABEL_PADDING;
  return {
    x: minX,
    y: minY,
    width: Math.max(MIN_MAP_SIZE, maxX - minX),
    height: Math.max(MIN_MAP_SIZE, maxY - minY),
  };
}

function getMapGraphContentBounds(system) {
  if (!system?.nodes?.length) return { ...DEFAULT_MAP_BOUNDS };
  const xs = system.nodes.map((node) => node.x);
  const ys = system.nodes.map((node) => node.y + MAP_GRAPH_OFFSET_Y);
  const minX = Math.min(...xs) - MAP_GRAPH_SIDE_PADDING;
  const maxX = Math.max(...xs) + MAP_GRAPH_SIDE_PADDING;
  const minY = Math.min(...ys) - MAP_GRAPH_TOP_PADDING;
  const maxY = Math.max(...ys) + MAP_GRAPH_BOTTOM_PADDING;
  return {
    x: minX,
    y: minY,
    width: Math.max(MIN_MAP_SIZE, maxX - minX),
    height: Math.max(MIN_MAP_SIZE, maxY - minY),
  };
}

function getInitialMapView(bounds) {
  return expandViewFromCenter(bounds, MAP_OPEN_OVERVIEW_SCALE);
}

function expandViewFromCenter(view, factor) {
  const width = Math.max(MIN_MAP_SIZE, view.width * factor);
  const height = Math.max(MIN_MAP_SIZE, view.height * factor);
  return {
    x: view.x + (view.width - width) / 2,
    y: view.y + (view.height - height) / 2,
    width,
    height,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function startExtractAnimation(action, previousRun, nextRun) {
  const isExtract = action.type === 'extract' || (action.type === 'runProgram' && action.program === 'extract');
  if (!isExtract) return;

  const fromLoot = previousRun?.lootTokens ?? 0;
  const toLoot = nextRun?.lootTokens ?? 0;
  const fromDeckCash = previousRun?.deckCash ?? 0;
  const toDeckCash = nextRun?.deckCash ?? 0;
  if (toLoot <= fromLoot && toDeckCash <= fromDeckCash) return;

  startDeckAnimation({
    phase: 'extract',
    fromLoot,
    toLoot,
    fromDeckCash,
    toDeckCash,
    fromAccountCredits: appState.deckProfile.credits,
    toAccountCredits: appState.deckProfile.credits,
    maxLoot: nextRun?.maxLootTokens ?? previousRun?.maxLootTokens,
  });
}

function startDeckAnimation(animation) {
  stopDeckAnimation();

  appState.deckAnimation = {
    ...animation,
    startedAt: performance.now(),
    duration: DECK_COUNTER_ANIMATION_MS,
  };
  scheduleDeckAnimationTick();
}

function stopDeckAnimation() {
  if (appState.deckAnimationFrame) {
    cancelAnimationFrame(appState.deckAnimationFrame);
    appState.deckAnimationFrame = null;
  }
  appState.deckAnimation = null;
}

function scheduleDeckAnimationTick() {
  if (!appState.deckAnimation || appState.deckAnimationFrame) return;
  appState.deckAnimationFrame = requestAnimationFrame(() => {
    appState.deckAnimationFrame = null;
    if (!appState.deckAnimation) return;
    if (performance.now() - appState.deckAnimation.startedAt >= appState.deckAnimation.duration) {
      appState.deckAnimation = null;
      render();
      return;
    }
    render();
    scheduleDeckAnimationTick();
  });
}

function getDeckTraceView() {
  if (!appState.deckAnimation) return null;
  const animation = appState.deckAnimation;
  const progress = clamp((performance.now() - animation.startedAt) / animation.duration, 0, 1);
  const eased = easeOutCubic(progress);

  return {
    phase: animation.phase,
    maxLoot: animation.maxLoot,
    loot: interpolate(animation.fromLoot, animation.toLoot, eased),
    deckCash: interpolate(animation.fromDeckCash, animation.toDeckCash, eased),
    accountCredits: interpolate(animation.fromAccountCredits, animation.toAccountCredits, eased),
  };
}

function interpolate(from, to, progress) {
  return (Number(from) || 0) + ((Number(to) || 0) - (Number(from) || 0)) * progress;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function syncRunResult() {
  if (!appState.system || !appState.run) return;
  if (!['escaped', 'dumped'].includes(appState.run.status)) return;
  if (appState.lastRecordedStatus === appState.run.status) return;

  void audioDirector.play(appState.run.status === 'escaped' ? 'success' : 'failure');

  const score = scoreRun(appState.system, appState.run);
  appState.currentProgress = recordRunResult(appState.system, appState.run, score);
  const previousAccountCredits = appState.deckProfile.credits;
  const reward = awardRunCredits(appState.deckProfile, appState.system, appState.run, score);
  appState.deckProfile = reward.profile;
  const lootTokens = appState.run.lootTokens ?? 0;
  const runCash = appState.run.deckCash ?? 0;
  const cpuConquered = hasConqueredCpu(appState.system, appState.run);
  const bookmarkCapacity = getBookmarkCapacity(appState.deckProfile);
  let bookmarkResult = null;
  let cachedBookmark = null;
  if (appState.run.status === 'escaped' && cpuConquered) {
    bookmarkResult = addHostBookmark(appState.deckProfile, appState.system);
    appState.deckProfile = bookmarkResult.profile;
    cachedBookmark = bookmarkResult.bookmark ?? findBookmarkBySeed(appState.deckProfile, appState.system.seedId);
    if (bookmarkResult.changed) ensureBookmarkZoneCached(cachedBookmark);
  }
  appState.deckMessage = completionDeckMessage(reward.reward, bookmarkResult);
  appState.recentProgress = listRecentProgress();
  void syncProgressEntry(appState.currentProgress);
  appState.lastRecordedStatus = appState.run.status;
  const playerStats = getPlayerProgressStats();
  appState.runResult = {
    status: appState.run.status,
    hostAlias: appState.system.alias,
    companyName: appState.system.company.name,
    tier: appState.system.valuation?.tier ?? 'C',
    score,
    reward: reward.reward,
    lootTokens,
    alert: appState.run.alert,
    maxAlert: appState.run.maxAlert,
    trace: appState.run.trace,
    maxTrace: appState.run.maxTrace,
    integrity: appState.run.integrity,
    maxIntegrity: appState.run.maxIntegrity,
    turn: appState.run.turn,
    nodeCount: appState.system.nodes.length,
    securedNodes: Object.values(appState.run.nodeStates).filter((state) => state !== 'unknown').length,
    operator: appState.deckProfile.player?.shadowName ?? 'usr@sh',
    playerName: appState.deckProfile.player?.shadowName ?? 'NEON GHOST',
    credits: appState.deckProfile.credits,
    totalEarned: appState.deckProfile.totalEarned,
    hostsDominated: playerStats.hostsDominated,
    totalRuns: playerStats.totalRuns,
    completedRuns: playerStats.completedRuns,
    bestScore: playerStats.bestScore,
    cpuConquered,
    bookmarkStatus: bookmarkResult?.changed ? 'saved' : bookmarkResult?.reason ?? (cpuConquered ? 'pending' : 'none'),
  };
  if (appState.run.status === 'escaped') {
    appState.completion = {
      hostAlias: appState.system.alias,
      seedId: appState.system.seedId,
      reward: reward.reward,
      score,
      lootTokens,
      cpuConquered,
      bookmarkCapacity,
      bookmarkCount: appState.deckProfile.bookmarks.length,
      bookmarkStatus: bookmarkResult?.changed ? 'saved' : bookmarkResult?.reason ?? (cpuConquered ? 'pending' : 'none'),
      bookmarkHostAlias: cachedBookmark?.hostAlias ?? appState.system.alias,
    };
  } else {
    appState.completion = null;
  }
  appState.isDeckOpen = false;
  appState.isSettingsOpen = false;
  appState.isHelpOpen = false;
  if (appState.run.status === 'escaped' && reward.reward > 0) {
    startDeckAnimation({
      phase: 'transfer',
      fromLoot: lootTokens,
      toLoot: 0,
      fromDeckCash: Math.max(runCash, reward.reward),
      toDeckCash: 0,
      fromAccountCredits: previousAccountCredits,
      toAccountCredits: appState.deckProfile.credits,
      maxLoot: appState.run.maxLootTokens,
    });
  }
  appState.run = clearFinishedRunCargo(appState.run);
  void syncDeckProfile();
}

function hasConqueredCpu(system, run) {
  const coreNodeId = system?.coreNodeId ?? system?.nodes?.find((node) => node.kind === 'core')?.id;
  return Boolean(coreNodeId && run?.nodeStates?.[coreNodeId] === NODE_RUNTIME_STATE.COMPROMISED);
}

function completionDeckMessage(reward, bookmarkResult) {
  const base = reward > 0 ? `+¤${reward} transferidos a la cuenta. Deck limpio.` : 'Deck limpio.';
  if (!bookmarkResult) return base;
  if (bookmarkResult.changed) return `${base} Bookmark de CPU registrado.`;
  if (bookmarkResult.reason === 'exists') return `${base} Bookmark de CPU ya disponible.`;
  if (bookmarkResult.reason === 'full') return `${base} Memoria de bookmarks llena.`;
  return base;
}

function clearFinishedRunCargo(run) {
  return {
    ...run,
    hasPayload: false,
    lootTokens: 0,
    deckCash: 0,
  };
}

function destroyBookmark(seedId) {
  if (!seedId) return;
  const result = removeHostBookmark(appState.deckProfile, seedId);
  appState.deckProfile = result.profile;
  if (result.changed) {
    appState.locationMessage = `Bookmark destruido: ${result.bookmark.hostAlias}.`;
    void syncDeckProfile();
    void audioDirector.play('spike');
  } else {
    appState.locationMessage = 'Bookmark no encontrado.';
    void audioDirector.play('selectProgram');
  }
  render();
}

function findBookmarkBySeed(profile, seedId) {
  return profile?.bookmarks?.find((bookmark) => bookmark.seedId === seedId) ?? null;
}

async function signInGuestCloud() {
  await cloudSync.signInGuest();
  renderActiveView();
}

async function signInGoogleCloud() {
  await cloudSync.signInGoogle();
  renderActiveView();
}

async function linkGoogleCloud() {
  await cloudSync.linkGoogle();
  renderActiveView();
}

async function signOutCloud() {
  await cloudSync.signOut();
  renderActiveView();
}

async function syncDeckProfile() {
  await cloudSync.syncDeckProfile(appState.deckProfile);
  renderActiveView();
}

async function syncProgressEntry(progressEntry) {
  await cloudSync.syncHostProgress(progressEntry);
  renderActiveView();
}

function saveShadowNameFromInput() {
  const input = root?.querySelector('[data-shadow-name-input]');
  updateRunnerIdentity({ shadowName: input?.value ?? '' });
}

function updateRunnerIdentity(patch) {
  appState.deckProfile = updatePlayerProfile(appState.deckProfile, patch);
  appState.deckMessage = 'Identidad de runner actualizada.';
  void audioDirector.play('selectProgram');
  void syncDeckProfile();
  render();
}

function deckUpgradeMessage(result, category, key) {
  if (result.changed) return `${key.toUpperCase()} mejorado por ¤${result.cost}.`;
  if (result.reason === 'credits') return '¤ insuficientes para esa mejora.';
  if (result.reason === 'max') return 'Mejora ya al maximo.';
  return category === 'stat' ? 'Atributo no disponible.' : 'Programa no disponible.';
}

function syncAudioState() {
  if (!appState.system || !appState.run) return;
  audioDirector.updateRunState(appState.run, appState.system);
}

function describeTarget(place) {
  const archetype = classifyCompany(place);
  const seedHint = `${place.provider}|${place.providerId}|${place.name}`;
  let hash = 0;
  for (let index = 0; index < seedHint.length; index += 1) {
    hash = Math.imul(31, hash) + seedHint.charCodeAt(index);
  }
  const seedHex = Math.abs(hash >>> 0).toString(16).padStart(8, '0');
  const valuation = valueCompany(place, archetype, seedHex);
  return `${place.category ?? 'unknown'} · ${valuation.tier} ${valuation.score}/100`;
}

function getScanRadius() {
  const lens = appState.deckProfile?.deck?.lens ?? 1;
  return 450 + lens * 250;
}
