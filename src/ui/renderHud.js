import { assetPaths } from '../assets/assetRegistry.js';
import { escapeHtml } from './html.js';
import { programs } from '../game/programCatalog.js';

export function renderHud(system, run, finished = false, player = null) {
  return '';
}

export function renderProgramDock(run, finished = false, recommendedProgram = null, deckProfile = null) {
  const programButtons = programs
    .map((program) => {
      const active = run.selectedProgram === program.kind;
      const disabled = finished || run.disabledPrograms.includes(program.kind);
      const recommended = !disabled && recommendedProgram === program.kind;
      const level = clampProgramLevel(deckProfile?.programs?.[program.kind]);
      const stateLabel = finished ? 'Run cerrada' : disabled ? 'Bloqueado' : program.description;
      const status = finished ? 'OFFLINE' : disabled ? 'LOCKED' : active ? 'ARMED' : 'READY';
      const classes = [
        'program-card',
        `program-card--${program.kind}`,
        active ? 'is-active' : '',
        recommended ? 'is-recommended' : '',
      ].filter(Boolean).join(' ');
      return `<button class="${classes}" data-program="${program.kind}" type="button" aria-label="${escapeHtml(`Ejecutar ${program.label}: ${stateLabel}`)}" title="${escapeHtml(stateLabel)}" ${disabled ? 'disabled' : ''}>
        <span class="program-card__frame" aria-hidden="true">
          <svg viewBox="0 0 100 100" focusable="false">
            <path class="program-card__frame-outer" pathLength="100" d="M13 3H72L97 28V78L78 97H13L3 87V13L13 3Z" />
            <path class="program-card__frame-cut" pathLength="100" d="M17 3h17M64 3h8l25 25v9M97 67v11L78 97H61M34 97H13L3 87V70" />
          </svg>
        </span>
        <span class="program-card__icon">
          <img src="${assetPaths.programs[program.kind]}" alt="" loading="lazy" />
        </span>
        <span class="program-card__body">
          <strong>${escapeHtml(program.label)}</strong>
          <small>LVL ${level} // ${escapeHtml(status)}</small>
        </span>
        <span class="program-card__pips" aria-label="${escapeHtml(`Nivel ${level} de 5`)}">${renderProgramPips(level)}</span>
      </button>`;
    })
    .join('');

  return `<footer class="program-dock ${finished ? 'program-dock--inactive' : ''}" aria-label="Programas ejecutables">${programButtons}</footer>`;
}

function renderProgramPips(level) {
  return Array.from({ length: 5 }, (_, index) => `<i class="${index < level ? 'is-filled' : ''}"></i>`).join('');
}

function clampProgramLevel(level) {
  return Math.min(5, Math.max(1, Number.parseInt(level, 10) || 1));
}
