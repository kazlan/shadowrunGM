import { programs } from '../game/programCatalog.js';
import { nodeEvents } from '../game/nodeEvents.js';
import { deckStatCatalog } from '../world/deckStore.js';
import { escapeHtml } from './html.js';

const helpTabs = [
  { key: 'run', label: 'Run' },
  { key: 'deck', label: 'Deck' },
  { key: 'events', label: 'Eventos' },
  { key: 'programs', label: 'Programas' },
];

const statHelp = [
  {
    label: 'ALERTA',
    description: 'Ruido dentro del host. Sube al moverte a nodos recién descubiertos, fallar o usar acciones ruidosas; si llega a 10, las contramedidas cierran la run.',
  },
  {
    label: 'TRAZA',
    description: 'Rastreo hacia tu posición. La suben defensas como Tracer, desconexiones forzadas y presión alta; si llega a 8, el host te expulsa.',
  },
  {
    label: 'SHELL',
    description: 'Integridad de tu avatar/deck. Baja por hielo ofensivo, fallos y dump shock; si llega a 0, quedas dumped.',
  },
];

export function renderHelpOverlay(isOpen, activeTab = 'run') {
  if (!isOpen) return '';

  const tab = helpTabs.some((candidate) => candidate.key === activeTab) ? activeTab : 'run';
  const tabs = helpTabs
    .map((item) => `<button class="${item.key === tab ? 'is-active' : ''}" data-help-tab="${item.key}" type="button" role="tab" aria-selected="${item.key === tab ? 'true' : 'false'}">${escapeHtml(item.label)}</button>`)
    .join('');

  return `<aside class="help-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <button class="help-overlay__backdrop" data-action="closeHelp" type="button" aria-label="Cerrar ayuda"></button>
    <section class="help-panel">
      <div class="help-panel__header">
        <div>
          <p class="eyebrow">Manual rápido</p>
          <h2 id="help-title">Cómo correr el host</h2>
        </div>
        <button class="help-close" data-action="closeHelp" type="button" aria-label="Cerrar ayuda">×</button>
      </div>
      <nav class="help-tabs" role="tablist" aria-label="Secciones de ayuda">${tabs}</nav>
      <div class="help-panel__content">
        ${renderHelpTab(tab)}
      </div>
    </section>
  </aside>`;
}

function renderHelpTab(tab) {
  if (tab === 'deck') return renderDeckHelp();
  if (tab === 'events') return renderEventHelp();
  if (tab === 'programs') return renderProgramHelp();
  return renderRunHelp();
}

function renderRunHelp() {
  const stats = statHelp.map((stat) => renderCard(stat.label, stat.description)).join('');

  return `<div class="help-section">
    <div class="help-callout">
      <strong>Objetivo</strong>
      <span>Entra, lee el mapa, consigue payload y sal por entrada o salida antes de la convergencia.</span>
    </div>
    <div class="help-grid help-grid--three">
      ${renderCard('1 · Explora', 'Scan revela rutas. Toca nodos descubiertos conectados para moverte.')}
      ${renderCard('2 · Resuelve', 'Cada evento pide un programa. El ICE activo suele pedir Spike o protección previa.')}
      ${renderCard('3 · Escapa', 'Con payload, vuelve a entrada/salida y pulsa Jack out. Sin salida segura hay dump shock.')}
    </div>
    <h3>Relojes</h3>
    <div class="help-grid">${stats}</div>
  </div>`;
}

function renderDeckHelp() {
  const stats = Object.values(deckStatCatalog)
    .map((stat) => renderCard(stat.label, stat.description))
    .join('');
  const parts = [
    renderCard('Chasis', 'Base fisica del deck y soporte de mejoras.'),
    renderCard('Persona', 'Avatar/interfaz que habita el host durante la run.'),
    renderCard('Bus', 'Ranuras de software cargado para el arsenal activo.'),
    renderCard('Buffer', 'Memoria de loot. Empieza fatal y mejora con cred.'),
  ].join('');

  return `<div class="help-section">
    <div class="help-callout">
      <strong>Progresión</strong>
      <span>Las runs dan cred. Gástalo en chasis y programas: un deck mejor permite asumir hosts más valiosos, pero no cancela la alerta.</span>
    </div>
    <h3>Piezas</h3>
    <div class="help-grid">${parts}</div>
    <h3>Atributos</h3>
    <div class="help-grid">${stats}</div>
    <h3>Regla práctica</h3>
    <div class="help-grid help-grid--three">
      ${renderCard('Pulse', 'Si peleas mucho contra ICE y puertas.')}
      ${renderCard('Veil', 'Si quieres runs sigilosas y más margen de traza.')}
      ${renderCard('Lens/Shell', 'Lens para mapa y payload; Shell para sobrevivir presión.')}
    </div>
  </div>`;
}

function renderEventHelp() {
  const events = Object.values(nodeEvents)
    .map((event) => renderCard(`${event.glyph} · ${event.label}`, event.hint))
    .join('');

  return `<div class="help-section">
    <div class="help-callout">
      <strong>Marcadores</strong>
      <span>Las siglas bajo un nodo revelado indican eventos. Resolverlos reduce sorpresas y abre rutas.</span>
    </div>
    <div class="help-grid">${events}</div>
  </div>`;
}

function renderProgramHelp() {
  const programHelp = programs
    .map(
      (program) => renderCard(program.label, program.description),
    )
    .join('');

  return `<div class="help-section">
    <div class="help-callout">
      <strong>Sin arsenal infinito</strong>
      <span>Cada programa es un verbo táctico. Súbelo de nivel antes de añadir más botones.</span>
    </div>
    <div class="help-grid">${programHelp}</div>
  </div>`;
}

function renderCard(label, description) {
  return `<article class="help-card">
    <strong>${escapeHtml(label)}</strong>
    <span>${escapeHtml(description)}</span>
  </article>`;
}
