import { generateSystem } from '../game/mapGenerator.js';
import { reduceRun } from '../game/runEngine.js';
import { createInitialRunState } from '../game/runState.js';
import { createRng } from '../game/rng.js';
import { projectSystemForRun } from '../game/systemView.js';
import { requestCurrentPosition } from '../location/locationService.js';
import { registerServiceWorker } from '../pwa/registerServiceWorker.js';
import { escapeHtml } from '../ui/html.js';
import { renderHud } from '../ui/renderHud.js';
import { renderNodeMap } from '../ui/renderNodeMap.js';
import { renderRunLog } from '../ui/renderRunLog.js';
import { classifyCompany } from '../world/companyArchetypes.js';
import { hashCompany } from '../world/companySeed.js';
import { createDemoNearbyProvider, demoPlaces } from '../world/placeProvider.js';

const root = document.querySelector('#root');
const nearbyProvider = createDemoNearbyProvider();
const appState = {
  places: demoPlaces,
  selectedPlace: demoPlaces[0],
  system: null,
  run: null,
  locationMessage: 'Objetivos demo cargados. Puedes activar scanner local cuando quieras.',
};

async function buildSystem(place) {
  const seed = await hashCompany(place);
  const archetype = classifyCompany(place);
  const rng = createRng(seed.seedHex);
  return generateSystem({ rng, seedId: seed.seedId, company: place, archetype });
}

async function startRun(place) {
  appState.selectedPlace = place;
  appState.system = await buildSystem(place);
  appState.run = createInitialRunState(appState.system);
  render();
}

function dispatch(action) {
  if (!appState.system || !appState.run) return;
  appState.run = reduceRun(appState.system, appState.run, action);
  render();
}

function render() {
  if (!root) return;
  if (!appState.system || !appState.run) {
    root.innerHTML = '<main class="app-shell app-shell--loading">Sincronizando deck...</main>';
    return;
  }

  const runtimeSystem = projectSystemForRun(appState.system, appState.run);
  const targetButtons = appState.places
    .map(
      (place, index) => `<button class="${place.providerId === appState.selectedPlace.providerId ? 'is-active' : ''}" data-place-index="${index}" type="button">
        <strong>${escapeHtml(place.name)}</strong>
        <span>${escapeHtml(place.category ?? 'unknown')}</span>
      </button>`,
    )
    .join('');

  root.innerHTML = `<main class="app-shell">
    <div class="scanline"></div>
    ${renderHud(runtimeSystem, appState.run)}
    ${renderNodeMap(runtimeSystem, appState.run)}
    <section class="action-bar" aria-label="Acciones de intrusión">
      <button data-action="scan" type="button">Scan</button>
      <button data-action="runProgram" type="button">Ejecutar</button>
      <button data-action="extract" type="button">Extract</button>
    </section>
    ${renderRunLog(appState.run)}
    <section class="target-list" aria-label="Objetivos cercanos">
      <div class="target-list__header">
        <p class="eyebrow">Objetivos</p>
        <button class="scan-local" data-action="scanLocal" type="button">Scanner local</button>
      </div>
      <small>${escapeHtml(appState.locationMessage)}</small>
      <div>${targetButtons}</div>
    </section>
  </main>`;

  bindEvents();
}

function bindEvents() {
  root.querySelectorAll('[data-place-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextPlace = appState.places[Number(button.dataset.placeIndex)];
      if (!nextPlace) return;
      void startRun(nextPlace);
    });
  });

  root.querySelectorAll('[data-program]').forEach((button) => {
    button.addEventListener('click', () => {
      dispatch({ type: 'selectProgram', program: button.dataset.program });
    });
  });

  root.querySelectorAll('[data-node-id]').forEach((node) => {
    node.addEventListener('click', () => {
      dispatch({ type: 'move', nodeId: node.dataset.nodeId });
    });
  });

  root.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'scan') dispatch({ type: 'scan' });
      if (action === 'runProgram') dispatch({ type: 'runProgram', program: appState.run.selectedProgram });
      if (action === 'extract') dispatch({ type: 'extract' });
      if (action === 'jackOut') dispatch({ type: 'jackOut' });
      if (action === 'scanLocal') void scanLocalTargets();
    });
  });
}

async function scanLocalTargets() {
  appState.locationMessage = 'Solicitando ubicación para buscar objetivos cercanos...';
  render();

  try {
    const position = await requestCurrentPosition();
    appState.places = await nearbyProvider.searchNearbyPlaces(position, 900);
    appState.locationMessage = 'Scanner local activo. Usando datos demo desplazados cerca de tu posición.';
    await startRun(appState.places[0]);
  } catch (error) {
    appState.places = demoPlaces;
    appState.locationMessage = `No se pudo usar ubicación: ${error.message}. Seguimos con objetivos demo.`;
    await startRun(appState.selectedPlace);
  }
}

void startRun(appState.selectedPlace);
registerServiceWorker();
