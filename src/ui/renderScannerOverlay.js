import { escapeHtml } from './html.js';

export function renderScannerOverlay({ isOpen, places, selectedPlace, locationMessage, describeTarget, bookmarks = [], bookmarkCapacity = 3 }) {
  if (!isOpen) return '';

  const status = locationMessage
    ? `<p class="scanner-status">${escapeHtml(locationMessage)}</p>`
    : '';
  const targetButtons = places
    .map((place, index) => {
      const description = describeTarget(place);
      const tone = targetTone(place, description);
      return `<button class="scanner-target--${tone}${place.providerId === selectedPlace.providerId ? ' is-active' : ''}" data-place-index="${index}" data-target-tone="${tone}" type="button">
        ${renderSourceIcon(place)}
        <span class="scanner-target__body">
          <strong>${escapeHtml(place.name)}</strong>
          <span>${escapeHtml(description)}</span>
          ${renderAddress(place)}
        </span>
      </button>`;
    })
    .join('');
  const bookmarkButtons = bookmarks.length > 0
    ? bookmarks.map((bookmark, index) => {
      const description = describeTarget(bookmark);
      const tone = targetTone(bookmark, description);
      return `<article class="scanner-bookmark-card scanner-target--${tone}" data-target-tone="${tone}">
        <button class="scanner-bookmark-card__launch" data-bookmark-index="${index}" type="button">
          ${renderSourceIcon(bookmark)}
          <span class="scanner-target__body">
            <strong>${escapeHtml(bookmark.hostAlias)}</strong>
            <span>${escapeHtml(bookmark.name)} · Proxy remoto</span>
            ${renderAddress(bookmark)}
          </span>
        </button>
        <button class="scanner-bookmark-card__destroy" data-bookmark-destroy="${escapeHtml(bookmark.seedId)}" type="button" title="Destroy bookmark ${escapeHtml(bookmark.hostAlias)}" aria-label="Destroy bookmark ${escapeHtml(bookmark.hostAlias)}">×</button>
      </article>`;
    }).join('')
    : '<p class="scanner-empty">Sin bookmarks guardados.</p>';

  return `<aside class="scanner-overlay" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
    <button class="overlay-backdrop" data-action="closeScanner" type="button" aria-label="Cerrar scanner"></button>
    <section class="overlay-panel scanner-panel">
      <div class="overlay-panel__header">
        <div>
          <p class="eyebrow">Objetivos cercanos</p>
          <h2 id="scanner-title">Scanner local</h2>
        </div>
        <div class="scanner-panel__header-actions">
          <button class="scan-local scanner-panel__refresh" data-action="scanLocal" type="button" title="Actualizar objetivos cercanos">Actualizar zona</button>
          <button class="overlay-close" data-action="closeScanner" type="button" aria-label="Cerrar scanner">×</button>
        </div>
      </div>
      <div class="overlay-panel__content scanner-panel__content">
        ${status}
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
  if (target.provider === 'local') return 'Nodo local';
  return 'Sandbox';
}

function targetTone(target, description) {
  if (target.special || target.questId || target.rarity === 'special' || target.tone === 'special') return 'special';
  if (sourceKind(target) === 'sandbox') return 'sandbox';

  const valuation = target.valuation ?? {};
  const parsed = parseTargetValuation(description);
  const tier = String(target.valueTier ?? valuation.tier ?? parsed.tier ?? '').toUpperCase();
  const score = Number(target.valueScore ?? valuation.score ?? parsed.score ?? 0);
  if (['S', 'AAA', 'AA'].includes(tier) || score >= 86) return 'lethal';
  if (tier === 'A' || score >= 68) return 'hot';
  return 'normal';
}

function parseTargetValuation(description) {
  const match = String(description).match(/\b(S|AAA|AA|A|B|C|D)\s+(\d{1,3})\/100\b/i);
  if (!match) return {};
  return { tier: match[1], score: Number(match[2]) };
}
