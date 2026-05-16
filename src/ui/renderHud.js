import { assetPaths } from '../assets/assetRegistry.js';
import { escapeHtml } from './html.js';
import { programs } from '../game/programCatalog.js';

export function renderHud(system, run) {
  const programButtons = programs
    .map((program) => {
      const active = run.selectedProgram === program.kind;
      const disabled = run.disabledPrograms.includes(program.kind);
      const stateLabel = disabled ? 'Bloqueado' : program.description;
      return `<button class="${active ? 'is-active' : ''}" data-program="${program.kind}" type="button" aria-label="${escapeHtml(`${program.label}: ${stateLabel}`)}" title="${escapeHtml(stateLabel)}" ${disabled ? 'disabled' : ''}>
        <img src="${assetPaths.programs[program.kind]}" alt="" loading="lazy" />
        <strong>${escapeHtml(program.label)}</strong>
      </button>`;
    })
    .join('');

  return `<header class="hud-top">
      <div class="brand-line">
        <img class="brand-mark" src="${assetPaths.logo}" alt="" />
        <div>
        <p class="eyebrow">Host enlazado · Turno ${run.turn}</p>
        <h1>${escapeHtml(system.alias)}</h1>
        </div>
      </div>
      <div class="hud-actions">
        <button class="help-toggle" data-action="toggleHelp" type="button" aria-label="Abrir ayuda de juego">?</button>
        <button class="jack-out" data-action="jackOut" type="button">Jack out</button>
      </div>
    </header>
    <aside class="target-card">
      <span>${escapeHtml(system.archetype.label)} · Valor ${system.valuation?.tier ?? 'C'} (${system.valuation?.score ?? 0}/100)</span>
      <strong>${escapeHtml(system.company.name)}</strong>
      <small>Red ${escapeHtml(system.valuation?.difficulty ?? 'baja')} · Seguridad ${system.effectiveSecurity ?? system.archetype.security} · Seed ${escapeHtml(system.seedId)}</small>
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
