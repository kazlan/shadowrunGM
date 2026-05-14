import { escapeHtml } from './html.js';
import { programs } from '../game/programCatalog.js';

export function renderHud(system, run) {
  const programButtons = programs
    .map((program) => {
      const active = run.selectedProgram === program.kind;
      const disabled = run.disabledPrograms.includes(program.kind);
      return `<button class="${active ? 'is-active' : ''}" data-program="${program.kind}" type="button" ${disabled ? 'disabled' : ''}>
        <strong>${escapeHtml(program.label)}</strong>
        <span>${escapeHtml(disabled ? 'Bloqueado' : program.description)}</span>
      </button>`;
    })
    .join('');

  return `<header class="hud-top">
      <div>
        <p class="eyebrow">Host enlazado · Turno ${run.turn}</p>
        <h1>${escapeHtml(system.alias)}</h1>
      </div>
      <button class="jack-out" data-action="jackOut" type="button">Jack out</button>
    </header>
    <aside class="target-card">
      <span>${escapeHtml(system.archetype.label)}</span>
      <strong>${escapeHtml(system.company.name)}</strong>
      <small>Seed ${escapeHtml(system.seedId)}</small>
    </aside>
    <section class="meters" aria-label="Estado de la run">
      ${renderMeter('ALERTA', run.alert, run.maxAlert, 'alert')}
      ${renderMeter('TRAZA', run.trace, run.maxTrace, 'trace')}
      ${renderMeter('SHELL', run.integrity, run.maxIntegrity, 'integrity')}
    </section>
    <footer class="program-dock" aria-label="Programas cargados">${programButtons}</footer>`;
}

function renderMeter(label, value, max, kind) {
  const percent = Math.round((value / max) * 100);
  return `<div class="meter meter--${kind}">
    <span>${label}</span>
    <strong>${value}/${max}</strong>
    <i style="--meter:${percent}%"></i>
  </div>`;
}
