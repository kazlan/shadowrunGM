import { assetPaths } from '../assets/assetRegistry.js';
import { escapeHtml } from './html.js';
import { programs } from '../game/programCatalog.js';

export function renderHud(system, run, isAudioEnabled = false) {
  return `<header class="hud-top">
      <div class="brand-line">
        <img class="brand-mark" src="${assetPaths.logo}" alt="" />
        <div class="host-heading">
          <p class="eyebrow">Turno ${run.turn} · ${escapeHtml(system.valuation?.tier ?? 'C')} ${system.valuation?.score ?? 0}/100</p>
          <h1>${escapeHtml(system.alias)}</h1>
          <small>${escapeHtml(system.company.name)} · Seg ${system.effectiveSecurity ?? system.archetype.security}</small>
        </div>
      </div>
      <div class="hud-actions">
        <button class="audio-toggle ${isAudioEnabled ? 'is-active' : ''}" data-action="toggleAudio" type="button" aria-label="${isAudioEnabled ? 'Silenciar audio' : 'Activar música y efectos'}">♪</button>
        <button class="help-toggle" data-action="toggleHelp" type="button" aria-label="Abrir ayuda de juego">?</button>
        <button class="jack-out" data-action="jackOut" type="button">Jack out</button>
      </div>
    </header>
    <section class="meters" aria-label="Estado de la run">
      ${renderMeter('ALERTA', run.alert, run.maxAlert, 'alert')}
      ${renderMeter('TRAZA', run.trace, run.maxTrace, 'trace')}
      ${renderMeter('SHELL', run.integrity, run.maxIntegrity, 'integrity')}
    </section>`;
}

export function renderProgramDock(run) {
  const programButtons = programs
    .map((program) => {
      const active = run.selectedProgram === program.kind;
      const disabled = run.disabledPrograms.includes(program.kind);
      const stateLabel = disabled ? 'Bloqueado' : program.description;
      return `<button class="${active ? 'is-active' : ''}" data-program="${program.kind}" type="button" aria-label="${escapeHtml(`Ejecutar ${program.label}: ${stateLabel}`)}" title="${escapeHtml(stateLabel)}" ${disabled ? 'disabled' : ''}>
        <img src="${assetPaths.programs[program.kind]}" alt="" loading="lazy" />
        <strong>${escapeHtml(program.label)}</strong>
      </button>`;
    })
    .join('');

  return `<footer class="program-dock" aria-label="Programas ejecutables">${programButtons}</footer>`;
}

function renderMeter(label, value, max, kind) {
  const percent = Math.round((value / max) * 100);
  return `<div class="meter meter--${kind}">
    <div>
      <span>${label}</span>
      <strong>${value}/${max}</strong>
    </div>
    <i style="--meter:${percent}%"></i>
  </div>`;
}
