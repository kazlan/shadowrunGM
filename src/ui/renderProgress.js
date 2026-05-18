import { escapeHtml } from './html.js';

export function renderProgressPanel(currentProgress, recentProgress) {
  const current = currentProgress
    ? `<p>Host conocido · Valor ${escapeHtml(currentProgress.valueTier ?? 'C')} ${currentProgress.companyValue ?? 0}/100 · ${currentProgress.completedRuns} extracción(es) · Mejor ${currentProgress.bestScore}</p>`
    : '<p>Host nuevo · sin historial local</p>';

  const recent = recentProgress.length > 0
    ? recentProgress.map((entry) => `<li><strong>${escapeHtml(entry.hostAlias)}</strong><span>${escapeHtml(entry.valueTier ?? 'C')} ${entry.companyValue ?? 0}/100 · ${entry.completedRuns} ok · ${entry.bestScore} pts</span></li>`).join('')
    : '<li><strong>Sin historial</strong><span>Completa una run para guardar progreso.</span></li>';

  return `<section class="progress-panel" aria-label="Progreso local">
    <div>
      <p class="eyebrow">Memoria local</p>
      ${current}
    </div>
    <ol>${recent}</ol>
  </section>`;
}
