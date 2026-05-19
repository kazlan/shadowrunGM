import { programs } from '../game/programCatalog.js';
import { nodeEvents } from '../game/nodeEvents.js';
import { avatarCatalog, deckStatCatalog } from '../world/deckStore.js';
import { escapeHtml } from './html.js';
import { normalizeThemeKey, themeCatalog } from './themeStore.js';

const helpTabs = [
  { key: 'run', label: 'Run' },
  { key: 'deck', label: 'Deck' },
  { key: 'events', label: 'Eventos' },
  { key: 'programs', label: 'Programas' },
];

const statHelp = [
  {
    label: 'ALERTA',
    description: 'Ruido dentro del host. Sube al moverte a nodos recién descubiertos, fallar o usar acciones ruidosas; si llega a 10, las contramedidas cierran la run.',
  },
  {
    label: 'TRAZA',
    description: 'Rastreo hacia tu posición. La suben defensas como Tracer, desconexiones forzadas y presión alta; si llega a 8, el host te expulsa.',
  },
  {
    label: 'SHELL',
    description: 'Integridad de tu avatar/deck. Baja por hielo ofensivo, fallos y dump shock; si llega a 0, quedas dumped.',
  },
];

export function renderSettingsOverlay(isOpen, audioState = {}, activeTheme = 'black', cloudState = null, deckProfile = null) {
  if (!isOpen) return '';

  const musicEnabled = Boolean(audioState.music);
  const sfxEnabled = Boolean(audioState.sfx);
  const musicVolume = volumePercent(audioState.musicVolume, 0.16);
  const sfxVolume = volumePercent(audioState.sfxVolume, 0.34);
  const theme = normalizeThemeKey(activeTheme);

  return `<aside class="help-overlay settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <button class="help-overlay__backdrop" data-action="closeSettings" type="button" aria-label="Cerrar ajustes"></button>
    <section class="help-panel settings-panel">
      <div class="help-panel__header">
        <div>
          <p class="eyebrow">Ajustes</p>
          <h2 id="settings-title">Deck settings</h2>
        </div>
        <button class="help-close" data-action="closeSettings" type="button" aria-label="Cerrar ajustes">×</button>
      </div>
      <div class="settings-audio" aria-label="Controles de audio">
        ${renderAudioControl('music', 'Música', musicEnabled, musicVolume)}
        ${renderAudioControl('sfx', 'Efectos', sfxEnabled, sfxVolume)}
      </div>
      ${renderCloudControl(cloudState, deckProfile)}
      ${renderIdentityControl(deckProfile)}
      <div class="settings-themes" aria-label="Temas visuales">
        <h3>Tema</h3>
        <details class="theme-dropdown">
          <summary aria-label="Seleccionar tema visual">${renderThemeSummary(theme)}</summary>
          <div class="theme-menu" role="listbox" aria-label="Lista de temas">
            ${renderThemeOptions(theme)}
          </div>
        </details>
      </div>
      <div class="settings-actions">
        <button data-action="openHelp" type="button">Help</button>
      </div>
    </section>
  </aside>`;
}

function renderIdentityControl(deckProfile) {
  const player = deckProfile?.player ?? { shadowName: 'NEON GHOST', avatar: 'ghost' };
  const avatars = avatarCatalog
    .map((avatar) => `<button class="${avatar.key === player.avatar ? 'is-active' : ''}" data-avatar-option="${escapeHtml(avatar.key)}" type="button" aria-pressed="${avatar.key === player.avatar ? 'true' : 'false'}" title="${escapeHtml(avatar.label)}">
      <b>${escapeHtml(avatar.glyph)}</b>
      <span>${escapeHtml(avatar.label)}</span>
    </button>`)
    .join('');

  return `<div class="settings-identity" aria-label="Identidad del runner">
    <div class="settings-identity__name">
      <label>
        <span>Shadow Name</span>
        <input data-shadow-name-input type="text" maxlength="24" value="${escapeHtml(player.shadowName)}" autocomplete="off" spellcheck="false" aria-label="Shadow Name">
      </label>
      <button data-shadow-name-save type="button">Guardar</button>
    </div>
    <div class="settings-identity__avatars" role="listbox" aria-label="Avatar">${avatars}</div>
  </div>`;
}

function renderCloudControl(cloudState, deckProfile) {
  const state = cloudState ?? { configured: false, status: 'disabled', message: 'Firebase no configurado.' };
  const connected = Boolean(state.user);
  const disabled = !state.configured || state.status === 'authenticating';
  const player = deckProfile?.player ?? { shadowName: 'NEON GHOST', avatar: 'ghost' };
  const avatar = avatarCatalog.find((candidate) => candidate.key === player.avatar) ?? avatarCatalog[0];
  const accountLabel = connected ? cloudAccountLabel(state.user) : 'Modo local';
  const status = cloudStatusLabel(state);

  return `<div class="settings-cloud settings-cloud--${connected ? 'connected' : 'signed-out'}" aria-label="Conexion Nexus">
    <div class="settings-cloud__header">
      <span class="settings-cloud__avatar">${escapeHtml(avatar.glyph)}</span>
      <div>
        <h3>Conectar deck a Nexus</h3>
        <strong>${escapeHtml(player.shadowName)}</strong>
        <small>${escapeHtml(accountLabel)}</small>
      </div>
    </div>
    <p>${escapeHtml(status)}</p>
    ${connected ? renderConnectedCloudActions(state, disabled) : renderSignedOutCloudActions(disabled)}
  </div>`;
}

function renderSignedOutCloudActions(disabled) {
  return `<div class="settings-cloud__actions settings-cloud__actions--three">
    <button data-action="signInGuest" type="button" ${disabled ? 'disabled' : ''}>Invitado</button>
    <button data-action="signInGoogle" type="button" ${disabled ? 'disabled' : ''}>Google</button>
    <button data-action="continueLocal" type="button">Local</button>
  </div>`;
}

function renderConnectedCloudActions(state, disabled) {
  const linkButton = state.user?.isAnonymous
    ? `<button data-action="linkGoogle" type="button" ${disabled ? 'disabled' : ''}>Vincular Google</button>`
    : '';
  return `<div class="settings-cloud__account">
    <span>${escapeHtml(accountDetail(state.user))}</span>
    <div class="settings-cloud__actions">
      ${linkButton}
      <button data-action="signOutCloud" type="button" ${disabled ? 'disabled' : ''}>Salir</button>
    </div>
  </div>`;
}

function cloudAccountLabel(user) {
  if (!user) return 'Local';
  if (user.displayName) return user.displayName;
  if (user.email) return user.email;
  return user.isAnonymous ? 'Invitado Nexus' : 'Cuenta Nexus';
}

function accountDetail(user) {
  if (!user) return 'Sin cuenta conectada';
  if (user.email) return user.email;
  return user.isAnonymous ? 'Cuenta invitada vinculable' : user.uid;
}

function cloudStatusLabel(state) {
  if (!state.configured) return 'Firebase no configurado.';
  if (state.status === 'authenticating') return state.message || 'Conectando...';
  if (state.status === 'syncing') return state.message || 'Sincronizando...';
  if (state.status === 'error') return state.message || 'Cloud sin sincronizar.';
  if (state.user) return state.message || 'Conectado.';
  return state.message || 'Cloud desconectado.';
}

function renderThemeSummary(activeTheme) {
  const theme = themeCatalog.find((candidate) => candidate.key === activeTheme) ?? themeCatalog[0];
  return `<span class="theme-option theme-option--summary">
    ${renderThemeSwatches(theme)}
    <strong>${escapeHtml(theme.label)}</strong>
  </span>`;
}

function renderThemeOptions(activeTheme) {
  return themeCatalog
    .map((theme) => `<button class="theme-option ${theme.key === activeTheme ? 'is-active' : ''}" data-theme-option="${escapeHtml(theme.key)}" type="button" aria-pressed="${theme.key === activeTheme ? 'true' : 'false'}" title="${escapeHtml(theme.description)}">
      ${renderThemeSwatches(theme)}
      <strong>${escapeHtml(theme.label)}</strong>
    </button>`)
    .join('');
}

function renderThemeSwatches(theme) {
  return `<span class="theme-option__swatches" aria-hidden="true">
    ${theme.swatches.map((color) => `<i style="--swatch:${escapeHtml(color)}"></i>`).join('')}
  </span>`;
}

export function renderHelpOverlay(isOpen, activeTab = 'run') {
  if (!isOpen) return '';

  const tab = helpTabs.some((candidate) => candidate.key === activeTab) ? activeTab : 'run';
  const tabs = helpTabs
    .map((item) => `<button class="${item.key === tab ? 'is-active' : ''}" data-help-tab="${item.key}" type="button" role="tab" aria-selected="${item.key === tab ? 'true' : 'false'}">${escapeHtml(item.label)}</button>`)
    .join('');

  return `<aside class="help-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <button class="help-overlay__backdrop" data-action="closeHelp" type="button" aria-label="Cerrar ayuda"></button>
    <section class="help-panel">
      <div class="help-panel__header">
        <div>
          <p class="eyebrow">Manual rápido</p>
          <h2 id="help-title">Cómo correr el host</h2>
        </div>
        <button class="help-close" data-action="closeHelp" type="button" aria-label="Cerrar ayuda">×</button>
      </div>
      <nav class="help-tabs" role="tablist" aria-label="Secciones de ayuda">${tabs}</nav>
      <div class="help-panel__content">
        ${renderHelpTab(tab)}
      </div>
    </section>
  </aside>`;
}

function renderAudioControl(kind, label, enabled, volume) {
  const action = kind === 'music' ? 'toggleMusic' : 'toggleSfx';
  const aria = enabled ? `Silenciar ${label.toLowerCase()}` : `Activar ${label.toLowerCase()}`;
  return `<div class="settings-audio-row">
    <button class="audio-toggle ${enabled ? 'is-active' : ''}" data-action="${action}" type="button" aria-label="${aria}">${kind === 'music' ? 'MUS' : 'FX'}</button>
    <label>
      <span>${escapeHtml(label)}</span>
      <input data-audio-volume="${kind}" type="range" min="0" max="100" step="1" value="${volume}" aria-label="Volumen ${escapeHtml(label)}">
    </label>
    <strong>${volume}</strong>
  </div>`;
}

function volumePercent(value, fallback) {
  const number = Number.isFinite(value) ? value : fallback;
  return Math.round(Math.min(1, Math.max(0, number)) * 100);
}

function renderHelpTab(tab) {
  if (tab === 'deck') return renderDeckHelp();
  if (tab === 'events') return renderEventHelp();
  if (tab === 'programs') return renderProgramHelp();
  return renderRunHelp();
}

function renderRunHelp() {
  const stats = statHelp.map((stat) => renderCard(stat.label, stat.description)).join('');

  return `<div class="help-section">
    <div class="help-callout">
      <strong>Objetivo</strong>
      <span>Entra, lee el mapa, consigue payload y sal por entrada o salida antes de la convergencia.</span>
    </div>
    <div class="help-grid help-grid--three">
      ${renderCard('1 · Explora', 'Scan revela rutas. Toca nodos descubiertos conectados para moverte.')}
      ${renderCard('2 · Resuelve', 'Cada evento pide un programa. El ICE activo suele pedir Spike o protección previa.')}
      ${renderCard('3 · Escapa', 'Con payload, vuelve a entrada/salida y pulsa Jack out. Sin salida segura hay dump shock.')}
    </div>
    <h3>Relojes</h3>
    <div class="help-grid">${stats}</div>
  </div>`;
}

function renderDeckHelp() {
  const stats = Object.values(deckStatCatalog)
    .map((stat) => renderCard(stat.label, stat.description))
    .join('');
  const parts = [
    renderCard('Chasis', 'Base fisica del deck y soporte de mejoras.'),
    renderCard('Persona', 'Avatar/interfaz que habita el host durante la run.'),
    renderCard('Bus', 'Ranuras de software cargado para el arsenal activo.'),
    renderCard('Buffer', 'Memoria de loot. Empieza fatal y mejora con cred.'),
  ].join('');

  return `<div class="help-section">
    <div class="help-callout">
      <strong>Progresión</strong>
      <span>Las runs dan cred. Gástalo en chasis y programas: un deck mejor permite asumir hosts más valiosos, pero no cancela la alerta.</span>
    </div>
    <h3>Piezas</h3>
    <div class="help-grid">${parts}</div>
    <h3>Atributos</h3>
    <div class="help-grid">${stats}</div>
    <h3>Regla práctica</h3>
    <div class="help-grid help-grid--three">
      ${renderCard('Pulse', 'Si peleas mucho contra ICE y puertas.')}
      ${renderCard('Veil', 'Si quieres runs sigilosas y más margen de traza.')}
      ${renderCard('Lens/Shell', 'Lens para mapa y payload; Shell para sobrevivir presión.')}
    </div>
  </div>`;
}

function renderEventHelp() {
  const events = Object.values(nodeEvents)
    .map((event) => renderCard(`${event.glyph} · ${event.label}`, event.hint))
    .join('');

  return `<div class="help-section">
    <div class="help-callout">
      <strong>Marcadores</strong>
      <span>Las siglas bajo un nodo revelado indican eventos. Resolverlos reduce sorpresas y abre rutas.</span>
    </div>
    <div class="help-grid">${events}</div>
  </div>`;
}

function renderProgramHelp() {
  const programHelp = programs
    .map(
      (program) => renderCard(program.label, program.description),
    )
    .join('');

  return `<div class="help-section">
    <div class="help-callout">
      <strong>Sin arsenal infinito</strong>
      <span>Cada programa es un verbo táctico. Súbelo de nivel antes de añadir más botones.</span>
    </div>
    <div class="help-grid">${programHelp}</div>
  </div>`;
}

function renderCard(label, description) {
  return `<article class="help-card">
    <strong>${escapeHtml(label)}</strong>
    <span>${escapeHtml(description)}</span>
  </article>`;
}
