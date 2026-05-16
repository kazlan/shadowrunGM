import { assetPaths } from '../assets/assetRegistry.js';
import { escapeHtml } from './html.js';

export function renderCompletionScreen(completion, deckProfile) {
  const saved = completion.bookmarkDecision === 'saved';
  const skipped = completion.bookmarkDecision === 'skipped';
  const decided = saved || skipped;
  const canSave = completion.canBookmark && !decided;

  return `<main class="app-shell completion-shell">
    <div class="scanline"></div>
    <section class="completion-card" aria-label="Run completada">
      <img src="${assetPaths.splash}" alt="" />
      <p class="eyebrow">Run completada</p>
      <h1>Payload asegurado</h1>
      <p>${escapeHtml(completion.hostAlias)} entregó ${completion.lootTokens} token(s), ${completion.reward} cred y ${completion.score} pts.</p>
      ${renderBookmarkChoice(completion, deckProfile, canSave, decided)}
      ${decided ? '<button class="scanner-toggle" data-action="toggleScanner" type="button">Objetivos / scanner</button>' : ''}
    </section>
  </main>`;
}

function renderBookmarkChoice(completion, deckProfile, canSave, decided) {
  if (decided) {
    const message = completion.bookmarkDecision === 'saved'
      ? 'Host guardado en bookmarks. Puedes escanear desde su ubicación.'
      : 'Host no guardado. Deck listo para otra run.';
    return `<p class="completion-note">${escapeHtml(message)}</p>`;
  }

  if (!completion.canBookmark) {
    return `<div class="completion-actions">
      <p class="completion-note">Bookmarks llenos (${deckProfile.bookmarks.length}/${completion.bookmarkCapacity}). Amplía el deck para guardar más hosts.</p>
      <button data-action="skipBookmark" type="button">Continuar</button>
    </div>`;
  }

  return `<div class="completion-actions">
    <p class="completion-note">Guardar este host en bookmarks? (${deckProfile.bookmarks.length}/${completion.bookmarkCapacity})</p>
    <button data-action="saveBookmark" type="button">Guardar host</button>
    <button data-action="skipBookmark" type="button">No guardar</button>
  </div>`;
}
