import { escapeHtml } from './html.js';

export function renderRunLogDialog(isOpen, run) {
  if (!isOpen || !run) return '';

  const lines = run.log.map((line, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(line)}</li>`).join('');
  const statusClass = run.status === 'escaped' ? 'is-success' : run.status === 'dumped' ? 'is-danger' : '';

  return `<aside class="run-log-dialog ${statusClass}" role="dialog" aria-modal="false" aria-labelledby="run-log-title">
    <section class="run-log-dialog__panel">
      <div class="run-log-dialog__header">
        <div>
          <p class="eyebrow">Run terminal</p>
          <h2 id="run-log-title">${escapeHtml(statusLabel(run.status))}</h2>
        </div>
        <button class="run-log-dialog__close" data-action="closeRunLog" type="button" aria-label="Cerrar historial">×</button>
      </div>
      <ol class="run-log-dialog__list">${lines}</ol>
    </section>
  </aside>`;
}

export function renderPostRunScannerPanel(runResult, completion, deckProfile) {
  const success = runResult?.status === 'escaped';
  const stateClass = success ? 'is-success' : 'is-danger';
  const summary = runResult
    ? `${runResult.hostAlias} · ${runResult.score} pts · ${runResult.reward} cred · ${runResult.lootTokens} token(s)`
    : 'Run cerrada. Scanner listo para nuevo objetivo.';

  return `<section class="post-run-panel ${stateClass}" aria-label="Objetivos y scanner">
    <div>
      <p class="eyebrow">Estado</p>
      <strong>Objetivos / scanner</strong>
    </div>
    <div class="post-run-panel__body">
      <p>${escapeHtml(summary)}</p>
      <div class="post-run-panel__actions">
        <button class="post-run-panel__log" data-action="toggleRunLog" type="button">Ver log</button>
        ${renderScannerReady(completion, deckProfile)}
      </div>
    </div>
  </section>`;
}

function renderScannerReady(completion, deckProfile) {
  return `${renderBookmarkAction(completion, deckProfile)}
    <button class="scanner-toggle" data-action="toggleScanner" type="button">Abrir scanner</button>`;
}

function renderBookmarkAction(completion, deckProfile) {
  if (!completion) return '';
  if (completion.bookmarkDecision === 'saved') return '<p class="post-run-panel__note">Host guardado en bookmarks.</p>';
  if (completion.bookmarkDecision === 'skipped') return '';
  if (!completion.canBookmark) {
    return `<p class="post-run-panel__note">Bookmarks llenos (${deckProfile.bookmarks.length}/${completion.bookmarkCapacity}).</p>`;
  }
  return '<button class="post-run-panel__save" data-action="saveBookmark" type="button">Guardar host</button>';
}

function statusLabel(status) {
  const labels = {
    idle: 'En espera',
    entering: 'Entrando',
    exploring: 'Explorando',
    encounter: 'Encuentro',
    objectiveComplete: 'Payload listo',
    escaped: 'Escapado',
    dumped: 'Dumped',
  };
  return labels[status] ?? status;
}
