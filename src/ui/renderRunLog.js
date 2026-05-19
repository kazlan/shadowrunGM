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
    ? `${runResult.hostAlias} · ${runResult.score} pts · ¤${runResult.reward} · ${runResult.lootTokens} token(s)`
    : 'Run cerrada. Scanner listo para nuevo objetivo.';
  const bookmarkStatus = renderBookmarkStatus(completion, deckProfile);

  return `<section class="post-run-panel ${stateClass}" aria-label="Objetivos y scanner">
    <div class="post-run-panel__body">
      <p>${escapeHtml(summary)}</p>
      ${bookmarkStatus}
      <div class="post-run-panel__actions" aria-label="Siguiente acción">
        <button class="post-run-panel__log" data-action="toggleRunLog" type="button">Ver log</button>
        <button class="post-run-panel__area" data-action="toggleDeck" type="button">Area 0</button>
      </div>
    </div>
  </section>`;
}

function renderBookmarkStatus(completion, deckProfile) {
  if (!completion) return '';
  const capacity = completion.bookmarkCapacity ?? deckProfile?.bookmarks?.length ?? 0;
  const count = completion.bookmarkCount ?? deckProfile?.bookmarks?.length ?? 0;
  const labels = {
    saved: `CPU conquistada · bookmark ${completion.bookmarkHostAlias ?? completion.hostAlias} registrado.`,
    exists: 'CPU conquistada · bookmark ya disponible.',
    full: `CPU conquistada · memoria de bookmarks llena (${count}/${capacity}).`,
    none: 'CPU no conquistada · sin bookmark.',
    pending: 'CPU conquistada · bookmark pendiente de sincronización.',
  };
  const text = labels[completion.bookmarkStatus] ?? labels.none;
  return `<p class="post-run-panel__note">${escapeHtml(text)}</p>`;
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
