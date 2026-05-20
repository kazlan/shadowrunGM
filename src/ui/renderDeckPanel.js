import { deckStatCatalog, getBookmarkCapacity, getDeckLevel, getStorageCapacity, getUpgradeCost } from '../world/deckStore.js';
import { assetPaths } from '../assets/assetRegistry.js';
import { programs } from '../game/programCatalog.js';
import { escapeHtml } from './html.js';

const deckParts = [
  { label: 'Chasis', value: 'Portatil', description: 'Base fisica del deck y soporte de upgrades.' },
  { label: 'Persona', value: 'Avatar', description: 'Interfaz de presencia dentro del host.' },
  { label: 'Bus', value: '5 slots', description: 'Software cargado para la run actual.' },
  { label: 'Buffer', value: 'Chufla', description: 'Memoria de loot inicial. Mejorala pronto o dejaras datos atras.' },
];

export function renderDeckTrace(deckProfile, run = null, upgradeMessage = '', view = null) {
  const deckLevel = getDeckLevel(deckProfile);
  const finished = run?.status === 'escaped' || run?.status === 'dumped';
  const rawDeckCash = view?.deckCash ?? (finished ? 0 : run?.deckCash ?? 0);
  const deckCash = Math.max(0, Math.round(rawDeckCash));
  const accountCredits = Math.max(0, Math.round(view?.accountCredits ?? deckProfile.credits));
  const maxLoot = Math.max(0, Math.round(view?.maxLoot ?? run?.maxLootTokens ?? getStorageCapacity(deckProfile)));
  const loot = Math.min(maxLoot, Math.max(0, Math.round(view?.loot ?? run?.lootTokens ?? 0)));
  const phaseClass = view?.phase ? ` deck-trace--${String(view.phase).replace(/[^a-z0-9-]/gi, '')}` : '';
  const stats = [
    ['P', deckProfile.deck.pulse],
    ['V', deckProfile.deck.veil],
    ['L', deckProfile.deck.lens],
    ['S', deckProfile.deck.shell],
  ]
    .map(([label, value]) => `<span>${label}${value}</span>`)
    .join('');

  return `<section class="deck-trace${phaseClass}" aria-label="Resumen del deck">
    <button data-action="toggleDeck" type="button">
      <strong>Deck L${deckLevel}</strong>
      <span class="deck-counters"><b>RUN ${deckCash}</b><b>CTA ${accountCredits}</b></span>
      ${renderExtractionCapacity(loot, maxLoot)}
      <i>${stats}</i>
    </button>
    ${upgradeMessage ? `<p>${escapeHtml(upgradeMessage)}</p>` : ''}
  </section>`;
}

function renderExtractionCapacity(loot, maxLoot) {
  if (!maxLoot) return '';

  const segments = Array.from({ length: maxLoot }, (_, index) => `<span class="${index < loot ? 'is-filled' : ''}"></span>`).join('');
  return `<span class="deck-extraction" aria-label="Capacidad de extraccion ${loot} de ${maxLoot}">
    <b>EXTR ${loot}/${maxLoot}</b>
    <em aria-hidden="true">${segments}</em>
  </span>`;
}

export function renderDeckOverlay(isOpen, deckProfile, upgradeMessage = '') {
  if (!isOpen) return '';

  const deckLevel = getDeckLevel(deckProfile);
  const stats = Object.values(deckStatCatalog)
    .map((stat) => renderStatCard(stat, deckProfile.deck[stat.kind], deckProfile.credits))
    .join('');
  const programUpgrades = programs
    .map((program) => renderSoftwareCard(program, deckProfile.programs[program.kind], deckProfile.credits))
    .join('');
  const hardware = renderUpgradeRow('hardware', 'storage', 'Memoria', deckProfile.hardware.storage, `Capacidad de loot: ${getStorageCapacity(deckProfile)} tokens.`, deckProfile.credits);
  const bookmarkHardware = renderUpgradeRow('hardware', 'bookmarks', 'Bookmarks', deckProfile.hardware.bookmarks, `Hosts guardados: ${deckProfile.bookmarks.length}/${getBookmarkCapacity(deckProfile)}.`, deckProfile.credits);
  const parts = deckParts
    .map((part) => `<article class="deck-part">
      <strong>${escapeHtml(part.label)}</strong>
      <span title="${escapeHtml(part.description)}">${escapeHtml(part.value)}</span>
    </article>`)
    .join('');

  return `<aside class="deck-overlay" role="dialog" aria-modal="true" aria-labelledby="deck-title">
    <button class="overlay-backdrop" data-action="closeDeck" type="button" aria-label="Cerrar deck"></button>
    <section class="overlay-panel deck-workbench">
      <div class="overlay-panel__header">
        <div>
          <p class="eyebrow">Área 0</p>
          <h2 id="deck-title">Deck L${deckLevel}</h2>
        </div>
        <div class="deck-workbench__balance" aria-label="Saldo en cuenta">
          <span>Saldo</span>
          <strong><b>¤</b>${deckProfile.credits}</strong>
        </div>
      </div>
      <div class="overlay-panel__content deck-workbench__content">
        <div class="deck-workbench__scanner">
          ${renderRadarIcon()}
          <div>
            <strong>Scanner de objetivos</strong>
            <span>Nuevos hosts, bookmarks y zonas cercanas.</span>
          </div>
          <button class="deck-workbench__scanner-button" data-action="toggleScanner" type="button" title="Abrir scanner de objetivos">Scanner de objetivos</button>
        </div>
        ${upgradeMessage ? `<p class="deck-workbench__message">${escapeHtml(upgradeMessage)}</p>` : ''}
        <div class="deck-workbench__section deck-workbench__section--parts">
          <h3>Piezas</h3>
          <div class="deck-parts">${parts}</div>
        </div>
        <div class="deck-workbench__section deck-workbench__section--hardware">
          <h3>Hardware</h3>
          <div class="deck-upgrade-list">${hardware}${bookmarkHardware}</div>
        </div>
        <div class="deck-workbench__section deck-workbench__section--stats">
          <h3>Stats del chasis</h3>
          <div class="deck-upgrade-list">${stats}</div>
        </div>
        <div class="deck-workbench__section deck-workbench__section--software">
          <h3>Software cargado</h3>
          <div class="deck-software-grid">${programUpgrades}</div>
        </div>
      </div>
    </section>
  </aside>`;
}

function renderUpgradeRow(category, key, label, level, description, credits) {
  const maxed = level >= 5;
  const cost = maxed ? 0 : getUpgradeCost(category, level);
  const affordable = credits >= cost;
  const state = maxed ? 'MAX' : `¤${cost}`;

  return `<article class="deck-upgrade">
    <div>
      <strong>${escapeHtml(label)} ${level}</strong>
      <span>${escapeHtml(description)}</span>
    </div>
    <button data-deck-upgrade="${category}:${key}" type="button" ${maxed || !affordable ? 'disabled' : ''}>${escapeHtml(state)}</button>
  </article>`;
}

function renderStatCard(stat, level, credits) {
  const maxed = level >= 5;
  const cost = maxed ? 0 : getUpgradeCost('stat', level);
  const affordable = credits >= cost;
  const state = maxed ? 'MAX' : `¤${cost}`;

  return `<article class="deck-stat-card" title="${escapeHtml(stat.description)}">
    <img src="${assetPaths.stats[stat.kind]}" alt="" loading="lazy" />
    <strong>${escapeHtml(stat.label)}</strong>
    <span>L${level}</span>
    <button data-deck-upgrade="stat:${stat.kind}" type="button" ${maxed || !affordable ? 'disabled' : ''}>${escapeHtml(state)}</button>
  </article>`;
}

function renderSoftwareCard(program, level, credits) {
  const maxed = level >= 5;
  const cost = maxed ? 0 : getUpgradeCost('program', level);
  const affordable = credits >= cost;
  const state = maxed ? 'MAX' : `¤${cost}`;

  return `<article class="deck-software-card" title="${escapeHtml(program.description)}">
    <img src="${assetPaths.programs[program.kind]}" alt="" loading="lazy" />
    <strong>${escapeHtml(program.label)}</strong>
    <span>L${level}</span>
    <button data-deck-upgrade="program:${program.kind}" type="button" ${maxed || !affordable ? 'disabled' : ''}>${escapeHtml(state)}</button>
  </article>`;
}

function renderRadarIcon() {
  return `<span class="deck-workbench__radar" aria-hidden="true">
    <svg viewBox="0 0 64 64" focusable="false">
      <circle cx="32" cy="32" r="24"></circle>
      <circle cx="32" cy="32" r="14"></circle>
      <path d="M32 8v8M32 48v8M8 32h8M48 32h8"></path>
      <path d="M32 32l18-10"></path>
      <path d="M32 32l-8 16"></path>
      <circle cx="32" cy="32" r="3"></circle>
      <circle cx="50" cy="22" r="2.5"></circle>
      <circle cx="24" cy="48" r="2.2"></circle>
    </svg>
  </span>`;
}
