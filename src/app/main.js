import { createAudioDirector } from '../audio/proceduralAudio.js';
import { getHostBackground } from '../assets/assetRegistry.js';
import { generateSystem } from '../game/mapGenerator.js';
import { reduceRun } from '../game/runEngine.js';
import { scoreRun } from '../game/runScoring.js';
import { createInitialRunState } from '../game/runState.js';
import { createRng } from '../game/rng.js';
import { projectSystemForRun } from '../game/systemView.js';
import { requestCurrentPosition } from '../location/locationService.js';
import { registerServiceWorker } from '../pwa/registerServiceWorker.js';
import { getDangerTheme } from '../ui/dangerTheme.js';
import { renderHelpOverlay } from '../ui/renderHelpOverlay.js';
import { renderHud, renderProgramDock } from '../ui/renderHud.js';
import { renderNodeMap } from '../ui/renderNodeMap.js';
import { renderProgressPanel } from '../ui/renderProgress.js';
import { renderRunLog } from '../ui/renderRunLog.js';
import { renderScannerOverlay } from '../ui/renderScannerOverlay.js';
import { classifyCompany } from '../world/companyArchetypes.js';
import { hashCompany } from '../world/companySeed.js';
import { valueCompany } from '../world/companyValuation.js';
import { createOverpassProvider } from '../world/overpassProvider.js';
import { createDemoNearbyProvider, demoPlaces, searchNearbyPlaces } from '../world/placeProvider.js';
import { getHostProgress, listRecentProgress, recordRunResult } from '../world/progressStore.js';

const root = document.querySelector('#root');
const audioDirector = createAudioDirector();
const overpassProvider = createOverpassProvider();
const demoNearbyProvider = createDemoNearbyProvider();
const DEFAULT_MAP_VIEW = { x: 0, y: 0, width: 100, height: 100 };
const MIN_MAP_SIZE = 32;
const MAX_MAP_SIZE = 100;
const MAP_DRAG_THRESHOLD_PX = 12;
const appState = {
  places: demoPlaces,
  selectedPlace: demoPlaces[0],
  system: null,
  run: null,
  locationMessage: 'Objetivos demo cargados. Puedes activar scanner local cuando quieras.',
  currentProgress: null,
  recentProgress: [],
  lastRecordedStatus: null,
  isHelpOpen: false,
  isScannerOpen: false,
  mapView: { ...DEFAULT_MAP_VIEW },
  mapPointer: null,
  ignoreNextNodeClick: false,
};

async function buildSystem(place) {
  const seed = await hashCompany(place);
  const archetype = classifyCompany(place);
  const valuation = valueCompany(place, archetype, seed.seedHex);
  const rng = createRng(seed.seedHex);
  return generateSystem({ rng, seedId: seed.seedId, company: place, archetype, valuation });
}

async function startRun(place) {
  appState.selectedPlace = place;
  appState.system = await buildSystem(place);
  appState.run = createInitialRunState(appState.system);
  appState.currentProgress = getHostProgress(appState.system.seedId);
  appState.recentProgress = listRecentProgress();
  appState.lastRecordedStatus = null;
  appState.mapView = { ...DEFAULT_MAP_VIEW };
  appState.mapPointer = null;
  appState.ignoreNextNodeClick = false;
  syncAudioState();
  render();
}

function dispatch(action) {
  if (!appState.system || !appState.run) return;
  appState.run = reduceRun(appState.system, appState.run, action);
  syncAudioState();
  void audioDirector.play(audioEventForAction(action));
  syncRunResult();
  render();
}

function render() {
  if (!root) return;
  if (!appState.system || !appState.run) {
    root.innerHTML = '<main class="app-shell app-shell--loading">Sincronizando deck...</main>';
    return;
  }

  const runtimeSystem = projectSystemForRun(appState.system, appState.run);
  const backgroundUrl = getHostBackground(appState.system.archetype.archetype);
  const dangerTheme = getDangerTheme(appState.run);
  root.innerHTML = `<main class="app-shell" style="--host-bg: url('${backgroundUrl}'); --danger-level: ${dangerTheme.level}; --danger-color: ${dangerTheme.color}; --danger-border: ${dangerTheme.border}; --danger-glow: ${dangerTheme.glow}">
    <div class="scanline"></div>
    ${renderHud(runtimeSystem, appState.run, audioDirector.isEnabled())}
    ${renderNodeMap(runtimeSystem, appState.run, appState.mapView)}
    ${renderProgramDock(appState.run)}
    ${renderRunLog(appState.run)}
    ${renderProgressPanel(appState.currentProgress, appState.recentProgress)}
    <button class="scanner-toggle" data-action="toggleScanner" type="button">Objetivos / scanner</button>
    ${renderHelpOverlay(appState.isHelpOpen)}
    ${renderScannerOverlay({
      isOpen: appState.isScannerOpen,
      places: appState.places,
      selectedPlace: appState.selectedPlace,
      locationMessage: appState.locationMessage,
      describeTarget,
    })}
  </main>`;

  bindEvents();
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

  root.querySelectorAll('[data-program]').forEach((button) => {
    button.addEventListener('click', () => {
      dispatch({ type: 'runProgram', program: button.dataset.program });
    });
  });

  root.querySelectorAll('[data-node-id]').forEach((node) => {
    node.addEventListener('click', () => {
      if (appState.ignoreNextNodeClick) {
        appState.ignoreNextNodeClick = false;
        return;
      }
      dispatch({ type: 'move', nodeId: node.dataset.nodeId });
    });
  });

  root.querySelectorAll('[data-map-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.mapAction;
      if (action === 'zoomIn') zoomMap(0.72);
      if (action === 'zoomOut') zoomMap(1.28);
      if (action === 'reset') setMapView({ ...DEFAULT_MAP_VIEW });
    });
  });

  bindNodeMapEvents();

  root.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'jackOut') dispatch({ type: 'jackOut' });
      if (action === 'scanLocal') void scanLocalTargets();
      if (action === 'toggleAudio') void toggleAudio();
      if (action === 'toggleHelp') {
        appState.isHelpOpen = !appState.isHelpOpen;
        appState.isScannerOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'closeHelp') {
        appState.isHelpOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'toggleScanner') {
        appState.isScannerOpen = !appState.isScannerOpen;
        appState.isHelpOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
      if (action === 'closeScanner') {
        appState.isScannerOpen = false;
        void audioDirector.play('openOverlay');
        render();
      }
    });
  });

  scrollRunLogToLatest();
}

async function toggleAudio() {
  syncAudioState();
  await audioDirector.toggle();
  render();
}

async function scanLocalTargets() {
  appState.isScannerOpen = true;
  void audioDirector.play('scanner');
  appState.locationMessage = 'Solicitando ubicación para buscar objetivos cercanos...';
  render();

  try {
    const position = await requestCurrentPosition();
    try {
      appState.places = await searchNearbyPlaces(overpassProvider, position, 900);
      if (appState.places.length === 0) throw new Error('sin objetivos OSM cercanos');
      appState.locationMessage = `Scanner local activo. ${appState.places.length} objetivos OSM encontrados.`;
    } catch (providerError) {
      console.warn('Overpass unavailable, using demo nearby provider', providerError);
      appState.places = await searchNearbyPlaces(demoNearbyProvider, position, 900);
      appState.locationMessage = 'Overpass no disponible. Usando objetivos demo desplazados cerca de tu posición.';
    }
    appState.isScannerOpen = false;
    await startRun(appState.places[0]);
  } catch (error) {
    appState.places = demoPlaces;
    appState.locationMessage = `No se pudo usar ubicación: ${error.message}. Seguimos con objetivos demo.`;
    appState.isScannerOpen = false;
    await startRun(appState.selectedPlace);
  }
}

void startRun(appState.selectedPlace);
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

function bindNodeMapEvents() {
  const surface = root?.querySelector('[data-map-surface]');
  if (!surface) return;

  surface.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomMap(event.deltaY > 0 ? 1.16 : 0.86, event);
  }, { passive: false });

  surface.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest?.('[data-node-id]')) return;
    appState.mapPointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startView: { ...appState.mapView },
      hasMoved: false,
    };
    surface.setPointerCapture?.(event.pointerId);
  });

  surface.addEventListener('pointermove', (event) => {
    const pointer = appState.mapPointer;
    if (!pointer || pointer.id !== event.pointerId) return;

    const rect = surface.getBoundingClientRect();
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > MAP_DRAG_THRESHOLD_PX) pointer.hasMoved = true;

    const nextView = {
      ...pointer.startView,
      x: pointer.startView.x - (deltaX / rect.width) * pointer.startView.width,
      y: pointer.startView.y - (deltaY / rect.height) * pointer.startView.height,
    };
    setMapView(nextView);
  });

  surface.addEventListener('pointerup', finishMapPointer);
  surface.addEventListener('pointercancel', finishMapPointer);
}

function finishMapPointer(event) {
  const pointer = appState.mapPointer;
  if (!pointer || pointer.id !== event.pointerId) return;
  appState.ignoreNextNodeClick = pointer.hasMoved;
  appState.mapPointer = null;
  if (appState.ignoreNextNodeClick) {
    globalThis.setTimeout(() => {
      appState.ignoreNextNodeClick = false;
    }, 80);
  }
}

function zoomMap(factor, originEvent) {
  const surface = root?.querySelector('[data-map-surface]');
  const view = appState.mapView;
  const width = clamp(view.width * factor, MIN_MAP_SIZE, MAX_MAP_SIZE);
  const height = clamp(view.height * factor, MIN_MAP_SIZE, MAX_MAP_SIZE);
  let anchorX = view.x + view.width / 2;
  let anchorY = view.y + view.height / 2;

  if (originEvent && surface) {
    const rect = surface.getBoundingClientRect();
    anchorX = view.x + ((originEvent.clientX - rect.left) / rect.width) * view.width;
    anchorY = view.y + ((originEvent.clientY - rect.top) / rect.height) * view.height;
  }

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

function syncRunResult() {
  if (!appState.system || !appState.run) return;
  if (!['escaped', 'dumped'].includes(appState.run.status)) return;
  if (appState.lastRecordedStatus === appState.run.status) return;

  void audioDirector.play(appState.run.status === 'escaped' ? 'success' : 'failure');

  const score = scoreRun(appState.system, appState.run);
  appState.currentProgress = recordRunResult(appState.system, appState.run, score);
  appState.recentProgress = listRecentProgress();
  appState.lastRecordedStatus = appState.run.status;
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
