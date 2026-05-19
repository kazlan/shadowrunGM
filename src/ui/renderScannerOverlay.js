import { escapeHtml } from './html.js';

export function renderScannerOverlay({ isOpen, places, selectedPlace, locationMessage, describeTarget, bookmarks = [], bookmarkCapacity = 3 }) {
  if (!isOpen) return '';

  const targetButtons = places
    .map(
      (place, index) => `<button class="${place.providerId === selectedPlace.providerId ? 'is-active' : ''}" data-place-index="${index}" type="button">
        ${renderSourceIcon(place)}
        <span class="scanner-target__body">
          <strong>${escapeHtml(place.name)}</strong>
          <span>${escapeHtml(describeTarget(place))}</span>
          ${renderAddress(place)}
        </span>
        <small class="scanner-source scanner-source--${sourceKind(place)}">${sourceLabel(place)}</small>
      </button>`,
    )
    .join('');
  const bookmarkButtons = bookmarks.length > 0
    ? bookmarks.map((bookmark, index) => `<button data-bookmark-index="${index}" type="button">
        ${renderSourceIcon(bookmark)}
        <span class="scanner-target__body">
          <strong>${escapeHtml(bookmark.hostAlias)}</strong>
          <span>${escapeHtml(bookmark.name)} · Proxy remoto</span>
          ${renderAddress(bookmark)}
        </span>
        <small class="scanner-source scanner-source--${sourceKind(bookmark)}">${sourceLabel(bookmark)}</small>
      </button>`).join('')
    : '<p class="scanner-empty">Sin bookmarks guardados.</p>';

  return `<aside class="scanner-overlay" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
    <button class="overlay-backdrop" data-action="closeScanner" type="button" aria-label="Cerrar scanner"></button>
    <section class="overlay-panel scanner-panel">
      <div class="overlay-panel__header">
        <div>
          <p class="eyebrow">Objetivos cercanos</p>
          <h2 id="scanner-title">Scanner local</h2>
        </div>
        <button class="overlay-close" data-action="closeScanner" type="button" aria-label="Cerrar scanner">×</button>
      </div>
      <div class="overlay-panel__content scanner-panel__content">
        <p class="scanner-status">${escapeHtml(locationMessage)}</p>
        <button class="scan-local scanner-panel__scan" data-action="scanLocal" type="button">Buscar cerca de mí</button>
        <h3>Bookmarks ${bookmarks.length}/${bookmarkCapacity}</h3>
        <div class="scanner-targets scanner-targets--bookmarks" aria-label="Bookmarks">${bookmarkButtons}</div>
        <h3>Objetivos detectados</h3>
        <div class="scanner-targets" aria-label="Lista de objetivos">${targetButtons}</div>
      </div>
    </section>
  </aside>`;
}

function renderSourceIcon(target) {
  const kind = sourceKind(target);
  const label = sourceLabel(target);
  return `<img class="scanner-source-icon scanner-source-icon--${kind}" src="/assets/ui/source-${kind}.svg" alt="${label}">`;
}

function renderAddress(target) {
  if (!target.address) return '';
  return `<em>${escapeHtml(target.address)}</em>`;
}

function sourceKind(target) {
  return target.provider === 'osm' || target.provider === 'geoapify' ? 'world' : 'sandbox';
}

function sourceLabel(target) {
  if (target.provider === 'osm') return 'Mundo real';
  if (target.provider === 'geoapify') return 'Geoapify';
  return 'Sandbox';
}
