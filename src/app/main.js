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
import { renderDeckOverlay, renderDeckTrace } from '../ui/renderDeckPanel.js';
import { renderHelpOverlay, renderSettingsOverlay } from '../ui/renderHelpOverlay.js';
import { renderHud, renderProgramDock } from '../ui/renderHud.js';
import { renderLandingPage } from '../ui/renderLandingPage.js';
import { renderNodeMap } from '../ui/renderNodeMap.js';
import { renderProgressPanel } from '../ui/renderProgress.js';
import { renderPostRunScannerPanel, renderRunLog } from '../ui/renderRunLog.js';
import { renderScannerOverlay } from '../ui/renderScannerOverlay.js';
import { applyTheme, loadThemePreference, saveThemePreference } from '../ui/themeStore.js';
import { classifyCompany } from '../world/companyArchetypes.js';
import { hashCompany } from '../world/companySeed.js';
import { valueCompany } from '../world/companyValuation.js';
import { createOverpassProvider } from '../world/overpassProvider.js';
import { createDemoNearbyProvider, demoPlaces, searchNearbyPlaces } from '../world/placeProvider.js';
import { addHostBookmark, awardRunCredits, getBookmarkCapacity, loadDeckProfile, updatePlayerProfile, upgradeDeckProfile } from '../world/deckStore.js';
import { getHostProgress, listRecentProgress, recordRunResult } from '../world/progressStore.js';

const root = document.querySelector('#root');
const audioDirector = createAudioDirector();
const overpassProvider = createOverpassProvider();
const demoNearbyProvider = createDemoNearbyProvider();
const DEFAULT_MAP_VIEW = { x: 0, y: 0, width: 100, height: 100 };
const MIN_MAP_SIZE = 32;
const MAX_MAP_SIZE = 100;
const MAP_DRAG_THRESHOLD_PX = 12;
const MAP_LOG_MESSAGE_MS = 5200;
const DISCONNECT_GLITCH_MS = 2000;
const DECK_COUNTER_ANIMATION_MS = 1000;
const NODE_VISIT_FOCUS_MS = 1800;
const NODE_VISIT_RESOLVE_MS = 800;
const DEBUG_LOG_LIMIT = 90;
const DEBUG_LOG_STORAGE_KEY = 'shadowHack.debugLog';
const EXPANDED_SCAN_RADIUS = 1500;
const MIN_SCANNER_TARGETS = 4;
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
  lastMapLogLength: 0,
  completion: null,
  runResult: null,
  postRunRebooted: false,
  lastRecordedStatus: null,
  isSettingsOpen: false,
  isHelpOpen: false,
  helpTab: 'run',
  isDeckOpen: false,
  isScannerOpen: false,
  mapView: { ...DEFAULT_MAP_VIEW },
  mapPointer: null,
  mapPointers: new Map(),
  mapPinch: null,
  mapGestureMoved: false,
  ignoreNextNodeClick: false,
  disconnectGlitchUntil: 0,
  disconnectGlitchTimer: null,
  nodeVisit: null,
  nodeVisitTimer: null,
  nodeVisitSequence: 0,
  runSessionId: 0,
  deckAnimation: null,
  deckAnimationFrame: null,
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
  return generateSystem({ rng, seedId: seed.seedId, company: place, archetype, valuation });
}

async function startRun(place) {
  stopDeckAnimation();
  appState.runSessionId += 1;
  debugLog('startRun:begin', { place: place?.name, providerId: place?.providerId });
  appState.selectedPlace = place;
  appState.completion = null;
  appState.runResult = null;
  appState.postRunRebooted = false;
  appState.system = await buildSystem(place);
  appState.deckProfile = loadDeckProfile();
  appState.deckMessage = '';
  appState.isDeckOpen = false;
  appState.run = createInitialRunState(appState.system, appState.deckProfile);
  appState.lastMapLogLength = 0;
  updateMapLogMessage(true);
  appState.currentProgress = getHostProgress(appState.system.seedId);
  appState.recentProgress = listRecentProgress();
  appState.lastRecordedStatus = null;
  appState.mapView = { ...DEFAULT_MAP_VIEW };
  appState.mapPointer = null;
  appState.mapPointers.clear();
  appState.mapPinch = null;
  appState.mapGestureMoved = false;
  appState.ignoreNextNodeClick = false;
  clearNodeVisit(false);
  stopDisconnectGlitch();
  syncAudioState();
  debugLog('startRun:ready', {
    seedId: appState.system.seedId,
    entryNodeId: appState.system.entryNodeId,
    nodeCount: appState.system.nodes.length,
  });
  render();
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
  applyTheme(appState.theme);
  if (!appState.system || !appState.run) {
    root.innerHTML = '<main class="app-shell app-shell--loading">Sincronizando deck...</main>';
    return;
  }

  const runtimeSystem = projectSystemForRun(appState.system, appState.run);
  const finished = isRunFinished(appState.run);
  const shockActive = appState.run.status === 'dumped' && isDisconnectGlitchActive();
  const resultVisible = finished && !shockActive && !appState.postRunRebooted;
  const postRunPanelVisible = finished && !shockActive;
  const backgroundUrl = getHostBackground(appState.system.archetype.archetype);
  const themeRun = appState.postRunRebooted ? { ...appState.run, status: 'exploring', alert: 0, trace: 0, integrity: appState.run.maxIntegrity } : appState.run;
  const dangerTheme = getDangerTheme(themeRun);
  const signalFxClass = getSignalFxClass(dangerTheme.level, themeRun.status, shockActive);
  root.innerHTML = `<main class="app-shell ${signalFxClass}" style="--host-bg: url('${backgroundUrl}'); --danger-level: ${dangerTheme.level}; --danger-color: ${dangerTheme.color}; --danger-border: ${dangerTheme.border}; --danger-glow: ${dangerTheme.glow}">
    ${shockActive ? renderDisconnectFilter() : ''}
    <div class="scanline"></div>
    <div class="crt-vignette"></div>
    ${renderHud(runtimeSystem, appState.run, finished, appState.deckProfile.player)}
    ${renderNodeMap(runtimeSystem, appState.run, appState.mapView, getVisibleMapLogMessage(), appState.runResult, resultVisible, appState.nodeVisit)}
    ${renderProgramDock(appState.run, finished, appState.nodeVisit?.recommendedProgram)}
    ${postRunPanelVisible ? renderPostRunScannerPanel(appState.runResult, appState.completion, appState.deckProfile, appState.postRunRebooted) : renderRunLog(appState.run)}
    ${renderDeckTrace(appState.deckProfile, appState.run, appState.deckMessage, getDeckTraceView())}
    ${renderProgressPanel(appState.currentProgress, appState.recentProgress)}
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
  applyTheme(appState.theme);
  root.innerHTML = renderLandingPage();
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
    <filter id="disconnectDisplacement">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.08" numOctaves="2" seed="7" result="noise">
        <animate attributeName="baseFrequency" values="0.02 0.08;0.13 0.02;0.06 0.16;0.18 0.04;0.02 0.08" dur=".42s" repeatCount="indefinite" />
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="24" xChannelSelector="R" yChannelSelector="G">
        <animate attributeName="scale" values="0;34;12;42;6;28;0" dur=".34s" repeatCount="indefinite" />
      </feDisplacementMap>
    </filter>
  </svg>`;
}

function triggerDisconnectGlitch() {
  appState.disconnectGlitchUntil = Date.now() + DISCONNECT_GLITCH_MS;
  if (appState.disconnectGlitchTimer) {
    globalThis.clearTimeout(appState.disconnectGlitchTimer);
  }
  appState.disconnectGlitchTimer = globalThis.setTimeout(() => {
    appState.disconnectGlitchTimer = null;
    appState.disconnectGlitchUntil = 0;
    render();
  }, DISCONNECT_GLITCH_MS);
}

function stopDisconnectGlitch() {
  appState.disconnectGlitchUntil = 0;
  if (!appState.disconnectGlitchTimer) return;
  globalThis.clearTimeout(appState.disconnectGlitchTimer);
  appState.disconnectGlitchTimer = null;
}

function isDisconnectGlitchActive() {
  return Date.now() < appState.disconnectGlitchUntil;
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

  root.querySelectorAll('[data-program]').forEach((button) => {
    button.addEventListener('click', () => {
      dispatch({ type: 'runProgram', program: button.dataset.program });
    });
  });

  root.querySelectorAll('[data-node-id]').forEach((node) => {
    node.addEventListener('click', () => {
      if (isRunFinished(appState.run)) return;
      if (appState.nodeVisit) return;
      if (appState.ignoreNextNodeClick) {
        appState.ignoreNextNodeClick = false;
        return;
      }
      dispatch({ type: 'move', nodeId: node.dataset.nodeId });
    });
  });

  root.querySelectorAll('[data-map-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (appState.nodeVisit) return;
      const action = button.dataset.mapAction;
      if (action === 'zoomIn') zoomMap(0.72);
      if (action === 'zoomOut') zoomMap(1.28);
      if (action === 'reset') setMapView({ ...DEFAULT_MAP_VIEW });
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
      if (action === 'saveBookmark') saveCompletionBookmark();
      if (action === 'skipBookmark') skipCompletionBookmark();
      if (action === 'rebootDeck') rebootDeck();
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
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'openHelp') {
        appState.isHelpOpen = true;
        appState.isSettingsOpen = false;
        appState.isScannerOpen = false;
        appState.isDeckOpen = false;
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
        const openingScanner = !appState.isScannerOpen;
        appState.isScannerOpen = openingScanner;
        if (openingScanner) skipCompletionBookmark(false);
        appState.isSettingsOpen = false;
        appState.isHelpOpen = false;
        appState.isDeckOpen = false;
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
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'closeDeck') {
        appState.isDeckOpen = false;
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
  const log = root?.querySelector('.run-log ol');
  if (!log) return;
  log.scrollTop = log.scrollHeight;
}

function updateMapLogMessage(force = false) {
  const length = appState.run?.log?.length ?? 0;
  if (!force && length <= appState.lastMapLogLength) return;
  appState.lastMapLogLength = length;
  const text = appState.run?.log?.[length - 1];
  if (!text) {
    appState.mapLogMessage = null;
    return;
  }

  appState.mapLogMessage = {
    key: `${length}-${appState.run.turn ?? 0}`,
    text,
    expiresAt: Date.now() + MAP_LOG_MESSAGE_MS,
  };
}

function getVisibleMapLogMessage() {
  if (!appState.mapLogMessage) return null;
  if (Date.now() > appState.mapLogMessage.expiresAt) return null;
  return appState.mapLogMessage;
}

function syncNodeVisit(action, previousRun, nextRun) {
  if (action.type === 'move') {
    maybeStartNodeVisit(action, previousRun, nextRun);
    return;
  }

  if (!appState.nodeVisit) return;
  if (!['runProgram', 'scan', 'extract', 'jackOut'].includes(action.type)) return;

  const node = getSystemNode(appState.nodeVisit.nodeId);
  if (!node) {
    clearNodeVisit(true);
    return;
  }

  const resolution = getNodeVisitResolutionLabel(node, previousRun, nextRun);
  if (resolution) {
    finishNodeVisit(resolution, true);
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
  if (!action.nodeId || action.nodeId !== nextRun.currentNodeId) return;
  if (isRunFinished(nextRun)) return;
  const previousState = previousRun.nodeStates[action.nodeId] ?? NODE_RUNTIME_STATE.UNKNOWN;
  if ([NODE_RUNTIME_STATE.VISITED, NODE_RUNTIME_STATE.COMPROMISED].includes(previousState)) return;

  const node = getSystemNode(action.nodeId);
  if (!node) return;

  stopNodeVisitTimer();
  const visitId = `${appState.runSessionId}:${appState.nodeVisitSequence + 1}`;
  appState.nodeVisitSequence += 1;
  const recommendedProgram = getRecommendedProgram(node, nextRun);
  const autoDismiss = !hasNodeVisitObjective(node, nextRun);
  appState.nodeVisit = {
    visitId,
    runSessionId: appState.runSessionId,
    nodeId: node.id,
    phase: 'intro',
    previousMapView: { ...appState.mapView },
    startedAt: Date.now(),
    recommendedProgram,
    autoDismiss,
    stamp: null,
  };
  setMapView(getFocusedNodeMapView(node));
  debugLog('nodeVisit:start', {
    visitId,
    nodeId: node.id,
    nodeKind: node.kind,
    previousState,
    recommendedProgram,
    autoDismiss,
    focusedMapView: appState.mapView,
  });
  scheduleNodeVisitFocus(autoDismiss, visitId);
}

function scheduleNodeVisitFocus(autoDismiss, visitId) {
  stopNodeVisitTimer();
  appState.nodeVisitTimer = globalThis.setTimeout(() => {
    appState.nodeVisitTimer = null;
    if (!isActiveNodeVisit(visitId) || appState.nodeVisit.phase !== 'intro') {
      debugLog('nodeVisit:focusIgnored', { visitId, activeVisitId: appState.nodeVisit?.visitId ?? null });
      return;
    }
    appState.nodeVisit = { ...appState.nodeVisit, phase: 'focus' };
    debugLog('nodeVisit:focus', { visitId, autoDismiss });
    if (autoDismiss) {
      finishNodeVisit('CLEARED', true, visitId);
      return;
    }
    render();
  }, getMotionDuration(NODE_VISIT_FOCUS_MS));
}

function finishNodeVisit(stamp, restoreView, visitId = appState.nodeVisit?.visitId) {
  if (!isActiveNodeVisit(visitId)) return;
  stopNodeVisitTimer();
  debugLog('nodeVisit:finish', { visitId, stamp, restoreView });
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
    clearNodeVisit(restoreView);
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
      clearNodeVisit(true);
      render();
      return;
    }
    appState.nodeVisit = { ...appState.nodeVisit, phase: 'focus', stamp: null };
    render();
  }, getMotionDuration(NODE_VISIT_RESOLVE_MS));
}

function clearNodeVisit(restoreView = true) {
  stopNodeVisitTimer();
  const previousMapView = appState.nodeVisit?.previousMapView;
  debugLog('nodeVisit:clear', {
    visitId: appState.nodeVisit?.visitId ?? null,
    restoreView,
    previousMapView,
  });
  appState.nodeVisit = null;
  if (restoreView && previousMapView) setMapView(previousMapView);
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

function getFocusedNodeMapView(node) {
  const size = node.kind === 'core' ? 30 : 34;
  return clampMapView({
    x: node.x - size / 2,
    y: node.y + 20 - size / 2,
    width: size,
    height: size,
  });
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
    phase: nodeVisit.phase,
    recommendedProgram: nodeVisit.recommendedProgram,
    autoDismiss: nodeVisit.autoDismiss,
    stamp: nodeVisit.stamp,
  };
}

function bindNodeMapEvents() {
  const surface = root?.querySelector('[data-map-surface]');
  if (!surface) return;

  surface.addEventListener('wheel', (event) => {
    if (appState.nodeVisit) return;
    event.preventDefault();
    zoomMapAtPoint(event.deltaY > 0 ? 1.16 : 0.86, event.clientX, event.clientY);
  }, { passive: false });

  surface.addEventListener('pointerdown', (event) => {
    if (appState.nodeVisit) return;
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

async function scanFromPosition(position, successLabel) {
  const radius = getScanRadius();
  try {
    const realScan = await searchRealPlaces(position, radius);
    appState.places = await fillWithSandboxTargets(realScan.places, position, radius);
    const expandedLabel = realScan.radius > radius ? ` tras ampliar a ${realScan.radius}m` : ` en ${radius}m`;
    const realCount = realScan.places.length;
    const sandboxCount = appState.places.length - realCount;
    appState.locationMessage = scannerResultMessage(successLabel, realCount, sandboxCount, expandedLabel);
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
  const places = await searchNearbyPlaces(overpassProvider, position, radius);
  if (places.length >= MIN_SCANNER_TARGETS || radius >= EXPANDED_SCAN_RADIUS) return { places, radius };
  const expandedPlaces = await searchNearbyPlaces(overpassProvider, position, EXPANDED_SCAN_RADIUS);
  return { places: mergePlaces(places, expandedPlaces), radius: EXPANDED_SCAN_RADIUS };
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

function scannerResultMessage(successLabel, realCount, sandboxCount, expandedLabel) {
  if (realCount === 0) {
    return `${successLabel}. Sin objetivos OSM útiles${expandedLabel}; ${sandboxCount} sandbox listos.`;
  }
  if (sandboxCount > 0) {
    return `${successLabel}. ${realCount} objetivos OSM encontrados${expandedLabel}; +${sandboxCount} sandbox de relleno.`;
  }
  return `${successLabel}. ${realCount} objetivos OSM encontrados${expandedLabel}.`;
}

function zoomMap(factor, originEvent) {
  if (originEvent) {
    zoomMapAtPoint(factor, originEvent.clientX, originEvent.clientY);
    return;
  }

  zoomMapAtCenter(factor);
}

function zoomMapAtCenter(factor) {
  const view = appState.mapView;
  zoomMapFromView(factor, view.x + view.width / 2, view.y + view.height / 2, view);
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
  const width = clamp(view.width * factor, MIN_MAP_SIZE, MAX_MAP_SIZE);
  const height = clamp(view.height * factor, MIN_MAP_SIZE, MAX_MAP_SIZE);
  const x = anchorX - ((anchorX - view.x) / view.width) * width;
  const y = anchorY - ((anchorY - view.y) / view.height) * height;
  setMapView({ x, y, width, height });
}

function setMapView(view) {
  appState.mapView = clampMapView(view);
  const surface = root?.querySelector('[data-map-surface]');
  if (!surface) return;
  const { x, y, width, height } = appState.mapView;
  surface.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
}

function clampMapView(view) {
  const width = clamp(view.width, MIN_MAP_SIZE, MAX_MAP_SIZE);
  const height = clamp(view.height, MIN_MAP_SIZE, MAX_MAP_SIZE);
  return {
    x: clamp(view.x, 0, 100 - width),
    y: clamp(view.y, 0, 100 - height),
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
  appState.deckMessage = reward.reward > 0 ? `+${reward.reward} cred transferidos a la cuenta. Deck limpio.` : 'Deck limpio.';
  appState.recentProgress = listRecentProgress();
  void syncProgressEntry(appState.currentProgress);
  appState.lastRecordedStatus = appState.run.status;
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
    operator: 'usr@sh',
    credits: appState.deckProfile.credits,
    totalEarned: appState.deckProfile.totalEarned,
  };
  if (appState.run.status === 'escaped' && appState.run.hasPayload) {
    const bookmarkCapacity = getBookmarkCapacity(appState.deckProfile);
    appState.completion = {
      hostAlias: appState.system.alias,
      seedId: appState.system.seedId,
      system: appState.system,
      reward: reward.reward,
      score,
      lootTokens,
      bookmarkCapacity,
      canBookmark: appState.deckProfile.bookmarks.length < bookmarkCapacity,
      bookmarkDecision: null,
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

function clearFinishedRunCargo(run) {
  return {
    ...run,
    hasPayload: false,
    lootTokens: 0,
    deckCash: 0,
  };
}

function saveCompletionBookmark() {
  if (!appState.completion?.system) return;
  const result = addHostBookmark(appState.deckProfile, appState.completion.system);
  appState.deckProfile = result.profile;
  appState.completion = {
    ...appState.completion,
    bookmarkDecision: result.changed || result.reason === 'exists' ? 'saved' : 'skipped',
    canBookmark: false,
  };
  if (result.changed) void syncDeckProfile();
  void audioDirector.play(result.changed ? 'success' : 'failure');
  render();
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

function skipCompletionBookmark(shouldRender = true) {
  if (!appState.completion) return;
  appState.completion = { ...appState.completion, bookmarkDecision: 'skipped' };
  if (shouldRender) render();
}

function rebootDeck() {
  appState.postRunRebooted = true;
  appState.isScannerOpen = false;
  stopDisconnectGlitch();
  void audioDirector.play('scanner');
  render();
}

function deckUpgradeMessage(result, category, key) {
  if (result.changed) return `${key.toUpperCase()} mejorado por ${result.cost} cred.`;
  if (result.reason === 'credits') return 'Cred insuficiente para esa mejora.';
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
