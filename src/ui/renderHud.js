import { assetPaths } from '../assets/assetRegistry.js';
import { escapeHtml } from './html.js';
import { programs } from '../game/programCatalog.js';

const avatarGlyphs = {
  ghost: 'GH',
  spark: 'SP',
  cipher: 'CI',
  vector: 'VX',
  null: 'N0',
};

export function renderHud(system, run, finished = false, player = null) {
  const identity = normalizeHudIdentity(player);
  return `<header class="hud-top">
      <div class="runner-id runner-id--${escapeHtml(identity.avatar)}" aria-label="Runner activo">
        <span class="runner-id__avatar">
          <img src="${assetPaths.avatars[identity.avatar] ?? assetPaths.avatars.ghost}" alt="" loading="lazy" />
          <b>${escapeHtml(avatarGlyphs[identity.avatar] ?? 'GH')}</b>
        </span>
        <span class="runner-id__text">
          <b>${escapeHtml(identity.shadowName)}</b>
          <small>${escapeHtml(system.alias)}</small>
        </span>
      </div>
      <div class="hud-actions">
        <button class="jack-out" data-action="jackOut" type="button" ${finished ? 'disabled' : ''}>Jack out</button>
        <button class="settings-toggle" data-action="toggleSettings" type="button" aria-label="Abrir ajustes">
          ${renderCogIcon()}
        </button>
      </div>
    </header>`;
}

function normalizeHudIdentity(player) {
  return {
    shadowName: String(player?.shadowName || 'NEON GHOST').slice(0, 24),
    avatar: Object.hasOwn(avatarGlyphs, player?.avatar) ? player.avatar : 'ghost',
  };
}

function renderCogIcon() {
  return `<svg class="settings-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <path d="m19.2 13.7 1.5 1.1-1.7 3-1.8-.7a7.7 7.7 0 0 1-1.5.9l-.3 1.9h-3.5l-.3-1.9a7.4 7.4 0 0 1-1.6-.9l-1.8.7-1.7-3 1.5-1.1a7.8 7.8 0 0 1 0-1.8l-1.5-1.1 1.7-3 1.8.7c.5-.35 1-.65 1.6-.9l.3-1.9h3.5l.3 1.9c.55.24 1.05.54 1.5.9l1.8-.7 1.7 3-1.5 1.1c.08.6.08 1.2 0 1.8Z" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"/>
  </svg>`;
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
            <path class="program-card__frame-outer" d="M14 2H74l22 22v52L74 98H14L2 86V14L14 2Z" />
            <path class="program-card__frame-inner" d="M19 10h51l17 17v46L70 90H19L10 81V19l9-9Z" />
            <path class="program-card__frame-cut" d="M17 2h18M65 2h10l21 21v10M98 67v9L76 98H60M35 98H14L2 86V72" />
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
        ${recommended ? '<span class="program-card__rec">REC</span>' : ''}
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
