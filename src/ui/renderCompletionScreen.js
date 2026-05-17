import { assetPaths } from '../assets/assetRegistry.js';
import { escapeHtml } from './html.js';

export function renderCompletionScreen(completion, deckProfile) {
  const saved = completion.bookmarkDecision === 'saved';
  const skipped = completion.bookmarkDecision === 'skipped';
  const decided = saved || skipped;

  return `<main class="app-shell completion-shell">
    <div class="scanline"></div>
    <section class="completion-card" aria-label="Run completada">
      <img src="${assetPaths.splash}" alt="" />
      <p class="eyebrow">Run completada</p>
      <h1>Payload asegurado</h1>
      <p>${escapeHtml(completion.hostAlias)} entregó ${completion.lootTokens} token(s), ${completion.reward} cred y ${completion.score} pts.</p>
      ${renderBookmarkChoice(completion, deckProfile, decided)}
      <button class="scanner-toggle" data-action="toggleScanner" type="button">Objetivos / scanner</button>
    </section>
  </main>`;
}

function renderBookmarkChoice(completion, deckProfile, decided) {
  if (decided) {
    if (completion.bookmarkDecision === 'saved') {
      return '<p class="completion-note">Host guardado en bookmarks. Puedes escanear desde su ubicación.</p>';
    }
    return '';
  }

  if (!completion.canBookmark) {
    return `<p class="completion-note">Bookmarks llenos (${deckProfile.bookmarks.length}/${completion.bookmarkCapacity}). Amplía el deck para guardar más hosts.</p>`;
  }

  return `<div class="completion-actions">
    <p class="completion-note">Guardar este host en bookmarks? (${deckProfile.bookmarks.length}/${completion.bookmarkCapacity})</p>
    <button data-action="saveBookmark" type="button">Guardar host</button>
  </div>`;
}
