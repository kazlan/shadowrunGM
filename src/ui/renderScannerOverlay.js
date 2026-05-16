import { escapeHtml } from './html.js';

export function renderScannerOverlay({ isOpen, places, selectedPlace, locationMessage, describeTarget }) {
  if (!isOpen) return '';

  const targetButtons = places
    .map(
      (place, index) => `<button class="${place.providerId === selectedPlace.providerId ? 'is-active' : ''}" data-place-index="${index}" type="button">
        <strong>${escapeHtml(place.name)}</strong>
        <span>${escapeHtml(describeTarget(place))}</span>
      </button>`,
    )
    .join('');

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
        <div class="scanner-targets" aria-label="Lista de objetivos">${targetButtons}</div>
      </div>
    </section>
  </aside>`;
}
