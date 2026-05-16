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

export function renderDeckTrace(deckProfile, run = null, upgradeMessage = '') {
  const deckLevel = getDeckLevel(deckProfile);
  const maxLoot = run?.maxLootTokens ?? getStorageCapacity(deckProfile);
  const loot = Math.min(maxLoot, run?.lootTokens ?? 0);
  const stats = [
    ['P', deckProfile.deck.pulse],
    ['V', deckProfile.deck.veil],
    ['L', deckProfile.deck.lens],
    ['S', deckProfile.deck.shell],
  ]
    .map(([label, value]) => `<span>${label}${value}</span>`)
    .join('');

  return `<section class="deck-trace" aria-label="Resumen del deck">
    <button data-action="toggleDeck" type="button">
      <strong>Deck L${deckLevel}</strong>
      <span>${deckProfile.credits} cred</span>
      <i>${stats}</i>
    </button>
    <div class="deck-memory" style="--memory-slots:${maxLoot}" aria-label="Memoria del deck ${loot} de ${maxLoot}">
      <span>MEM</span>
      <b>${renderMemoryTokens(loot, maxLoot)}</b>
      <em>${loot}/${maxLoot}</em>
    </div>
    ${upgradeMessage ? `<p>${escapeHtml(upgradeMessage)}</p>` : ''}
  </section>`;
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
          <p class="eyebrow">Banco de trabajo</p>
          <h2 id="deck-title">Deck L${deckLevel}</h2>
        </div>
        <button class="overlay-close" data-action="closeDeck" type="button" aria-label="Cerrar deck">×</button>
      </div>
      <div class="overlay-panel__content deck-workbench__content">
        <div class="deck-workbench__status">
          <strong>${deckProfile.credits} cred disponibles</strong>
          <span>${deckProfile.totalEarned} cred recuperados · +${deckProfile.lastReward ?? 0} ultima run</span>
          ${upgradeMessage ? `<p>${escapeHtml(upgradeMessage)}</p>` : ''}
        </div>
        <div>
          <h3>Piezas</h3>
          <div class="deck-parts">${parts}</div>
        </div>
        <div>
          <h3>Hardware</h3>
          <div class="deck-upgrade-list">${hardware}${bookmarkHardware}</div>
        </div>
        <div>
          <h3>Stats del chasis</h3>
          <div class="deck-upgrade-list">${stats}</div>
        </div>
        <div>
          <h3>Software cargado</h3>
          <div class="deck-software-grid">${programUpgrades}</div>
        </div>
      </div>
    </section>
  </aside>`;
}

function renderMemoryTokens(loot, maxLoot) {
  return Array.from({ length: maxLoot }, (_, index) => `<i class="${index < loot ? 'is-filled' : ''}"></i>`).join('');
}

function renderUpgradeRow(category, key, label, level, description, credits) {
  const maxed = level >= 5;
  const cost = maxed ? 0 : getUpgradeCost(category, level);
  const affordable = credits >= cost;
  const state = maxed ? 'MAX' : `${cost} cred`;

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
  const state = maxed ? 'MAX' : `${cost} cred`;

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
  const state = maxed ? 'MAX' : `${cost}`;

  return `<article class="deck-software-card" title="${escapeHtml(program.description)}">
    <img src="${assetPaths.programs[program.kind]}" alt="" loading="lazy" />
    <strong>${escapeHtml(program.label)}</strong>
    <span>L${level}</span>
    <button data-deck-upgrade="program:${program.kind}" type="button" ${maxed || !affordable ? 'disabled' : ''}>${escapeHtml(state)}</button>
  </article>`;
}
