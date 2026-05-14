import { escapeHtml } from './html.js';
export function renderRunLog(run) {
  const lines = run.log.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const statusClass = run.status === 'escaped' ? 'is-success' : run.status === 'dumped' ? 'is-danger' : '';
  return `<section class="run-log ${statusClass}" aria-label="Log de intrusión">
    <div>
      <p class="eyebrow">Estado</p>
      <strong>${escapeHtml(statusLabel(run.status))}</strong>
    </div>
    <ol>${lines}</ol>
  </section>`;
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
