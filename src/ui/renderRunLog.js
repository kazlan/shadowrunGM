import { escapeHtml } from './html.js';
export function renderRunLog(run) {
  const lines = run.log.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const statusClass = run.status === 'escaped' ? 'is-success' : run.status === 'dumped' ? 'is-danger' : '';
  return `<section class="run-log ${statusClass}" aria-label="Log de intrusión" aria-live="polite">
    <div>
      <p class="eyebrow">Estado</p>
      <strong class="fx-glitch" data-text="${escapeHtml(statusLabel(run.status))}">${escapeHtml(statusLabel(run.status))}</strong>
    </div>
    <ol>${lines}</ol>
  </section>`;
}

export function renderPostRunScannerPanel(runResult, completion, deckProfile, rebooted = false) {
  const success = runResult?.status === 'escaped';
  const stateClass = success ? 'is-success' : 'is-danger';
  const summary = runResult
    ? `${runResult.hostAlias} · ${runResult.score} pts · ${runResult.reward} cred · ${runResult.lootTokens} token(s)`
    : 'Run cerrada. Scanner listo para nuevo objetivo.';
  const title = rebooted ? 'Objetivos / scanner' : 'Deck cerrado';

  return `<section class="post-run-panel ${stateClass}" aria-label="Objetivos y scanner">
    <div>
      <p class="eyebrow">Estado</p>
      <strong>${escapeHtml(title)}</strong>
    </div>
    <div class="post-run-panel__body">
      <p>${escapeHtml(summary)}</p>
      ${rebooted ? renderScannerReady(completion, deckProfile) : '<button class="reboot-deck" data-action="rebootDeck" type="button">Reboot deck</button>'}
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
