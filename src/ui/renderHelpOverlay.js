import { assetPaths } from '../assets/assetRegistry.js';
import { iceCatalog } from '../game/iceCatalog.js';
import { programs } from '../game/programCatalog.js';
import { nodeEvents } from '../game/nodeEvents.js';
import { avatarCatalog, deckStatCatalog } from '../world/deckStore.js';
import { escapeHtml } from './html.js';
import { normalizeThemeKey, themeCatalog } from './themeStore.js';

const helpTabs = [
  { key: 'run', label: 'Run' },
  { key: 'damage', label: 'Daño' },
  { key: 'stats', label: 'Stats' },
  { key: 'upgrades', label: 'Mejoras' },
  { key: 'programs', label: 'Programas' },
  { key: 'ice', label: 'ICE' },
  { key: 'deck', label: 'Deck' },
  { key: 'events', label: 'Eventos' },
];

const statHelp = [
  {
    label: 'ALERTA',
    description: 'Ruido dentro del host. Si llega a 10, convergencia: contramedidas cierran la run y quedas dumped.',
  },
  {
    label: 'TRAZA',
    description: 'Rastreo hacia tu posición. Base 8, sube con Veil. Si llega al máximo, la traza te localiza y te expulsa.',
  },
  {
    label: 'SHELL',
    description: 'Integridad del avatar/deck. Base 10, sube con Shell. Si llega a 0, integridad agotada y quedas dumped.',
  },
];

const damageHelp = [
  ['Mover a nodo escaneado', '+1 ALERTA', 'Solo al entrar por primera vez en un nodo en estado SCANNED. Revisitar no suma ruido.'],
  ['Scan sin rutas nuevas', '+1 ALERTA', 'Si no revela nada y no limpia un señuelo, tu firma sube.'],
  ['Presión alta', '+1 TRAZA/turno', 'Cuando ALERTA está en 7 o más, cada turno que avanza añade traza.'],
  ['Jack out lejos de salida', '-3 SHELL, +1 TRAZA', 'Dump shock. Con Shield activo el daño baja a -1 SHELL.'],
  ['Spike contra ICE falla', '+3 ALERTA, -2 SHELL', 'El retorno hostil golpea shell. El éxito también hace ruido, pero menos.'],
  ['Ghost sin cámara', '-1 SHELL', 'Quema shell para bajar ALERTA y TRAZA. No se puede usar si ambas están a 0.'],
  ['Trampa sin Shield', '-1 SHELL, +1 TRAZA', 'Shield la absorbe y la marca resuelta sin daño.'],
];

const statMechanics = [
  ['Pulse', 'Spike', 'Fuerza = Pulse + Spike - 2. Aumenta la probabilidad de romper ICE y puertas; con fuerza 3+ forzar puertas no suma alerta.'],
  ['Veil', 'Ghost / TRAZA', 'Max TRAZA = 8 + floor((Veil - 1) / 2). Ghost reduce ALERTA/TRAZA hasta 3 según Veil + Ghost.'],
  ['Lens', 'Scan / Extract', 'Scan revela nodos extra con floor((Lens + Scan - 2) / 2). Extract gana finesse con floor((Lens + Extract - 2) / 3).'],
  ['Shell', 'SHELL / Shield', 'Max SHELL = 10 + Shell - 1. Shield dura 2 + floor((Shell + Shield - 2) / 3) turnos.'],
];

const programMechanics = {
  scan: 'Revela nodos conectados. Con Lens + Scan altos revela nodos a un salto extra. Si el nodo tiene señuelo, lo aísla. Si no revela nada, +1 ALERTA.',
  spike: 'Ataca ICE y fuerza puertas. Contra ICE: éxito si ALERTA + riesgo del nodo <= 12 + fuerza, o si Shield está activo. Fallar causa retorno hostil.',
  ghost: 'Ciega cámaras sin coste de shell. Si no hay cámara, reduce ALERTA y TRAZA quemando 1 SHELL. No actúa si no hay firma que ocultar.',
  shield: 'Activa protección durante varios turnos. Absorbe trampas, reduce daño de Piercer/Tracer/Crasher y reduce dump shock fuera de salida.',
  extract: 'Captura payload en Archivo, Núcleo, database y data. Core da 3 tokens, database 2, data 1. Cada token añade 25 cred al buffer de run.',
};

const eventMechanics = {
  archive: 'Extract captura payload útil. Archivo cuenta como objetivo de extracción y marca el nodo resuelto.',
  gate: 'Spike abre rutas conectadas. Si la fuerza de Spike es baja, forzar puerta puede añadir +1 ALERTA.',
  camera: 'Al entrar sube +1 ALERTA. Ghost la ciega y resuelve el evento sin quemar SHELL.',
  decoy: 'Scan lo limpia sin daño. Extract tarde lo detecta, pero mete ruido: +TRAZA y ALERTA según finesse.',
  trap: 'Sin Shield causa -1 SHELL y +1 TRAZA. Con Shield queda absorbida y resuelta.',
  core: 'Extract completa el objetivo principal. Núcleo da 3 tokens y suele añadir más ALERTA que data/database.',
  exit: 'Jack out desde salida asegura la run. Entrada y salida son puntos seguros para desconectar.',
};

const attributeUpgradeHelp = [
  ['Pulse', 'Más fuerza para Spike', 'Hace más probable romper ICE y puertas. Con fuerza 3+ las puertas no suman alerta; contra ICE también reduce el ruido del Spike exitoso.'],
  ['Veil', 'Más margen contra TRAZA', 'Sube el máximo de TRAZA en los cortes de L3 y L5. Además aumenta la limpieza de Ghost cuando se combina con Ghost alto.'],
  ['Lens', 'Más lectura y mejor extracción', 'Con Scan revela nodos extra; con Extract mejora finesse, baja el ruido al extraer y castiga menos si detectas tarde un señuelo.'],
  ['Shell', 'Más vida y mejor Shield', 'Cada nivel suma +1 SHELL máxima. También alarga Shield cuando Shell + Shield cruza los cortes de duración.'],
];

const programUpgradeHelp = [
  ['Scan', 'Explorar antes de saltar', 'Subirlo junto a Lens aumenta los nodos revelados por acción. Es la mejora para mapas menos ciegos y menos scans muertos.'],
  ['Spike', 'Abrir y tumbar defensas', 'Subirlo junto a Pulse aumenta fuerza: más ICE neutralizado, puertas más limpias y menos alerta al acertar contra defensa activa.'],
  ['Ghost', 'Bajar firma', 'Subirlo junto a Veil aumenta cuánto limpias de ALERTA/TRAZA por uso, hasta 3. En cámaras sigue resolviendo sin quemar SHELL.'],
  ['Shield', 'Comprar tiempo', 'Subirlo junto a Shell aumenta la duración. Cada pulso extra puede absorber trampas, suavizar ICE y reducir dump shock.'],
  ['Extract', 'Cobrar con menos ruido', 'Subirlo junto a Lens baja la alerta al extraer, mejora el manejo de señuelos y ayuda a sacar payload sin disparar la convergencia.'],
];

const hardwareUpgradeHelp = [
  ['Memoria', 'Más payload por run', 'Capacidad = 3 + Memoria x2. L1 guarda 5 tokens; L5 guarda 13. Si el buffer se llena, Extract aborta aunque el nodo tenga loot.'],
  ['Bookmarks', 'Más hosts guardados', 'Capacidad = 2 + Bookmarks. Sirve para conservar objetivos interesantes y volver luego con un deck más fuerte.'],
  ['Deck L', 'Lectura de progreso', 'El nivel del deck sube con atributos y programas. Ahora mismo no da un bonus oculto: los efectos reales vienen de cada mejora concreta.'],
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
  const player = deckProfile?.player ?? { shadowName: 'NEON GHOST', avatar: 'runner01' };
  const avatars = avatarCatalog
    .map((avatar) => `<button class="${avatar.key === player.avatar ? 'is-active' : ''}" data-avatar-option="${escapeHtml(avatar.key)}" type="button" aria-pressed="${avatar.key === player.avatar ? 'true' : 'false'}" title="${escapeHtml(avatar.label)}">
      <img src="${escapeHtml(avatarImagePath(avatar.key))}" alt="" loading="lazy" />
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
  const player = deckProfile?.player ?? { shadowName: 'NEON GHOST', avatar: 'runner01' };
  const avatar = avatarCatalog.find((candidate) => candidate.key === player.avatar) ?? avatarCatalog[0];
  const accountLabel = connected ? cloudAccountLabel(state.user) : 'Modo local';
  const status = cloudStatusLabel(state);

  return `<div class="settings-cloud settings-cloud--${connected ? 'connected' : 'signed-out'}" aria-label="Conexion Nexus">
    <div class="settings-cloud__header">
      <span class="settings-cloud__avatar"><img src="${escapeHtml(avatarImagePath(avatar.key))}" alt="" loading="lazy" /></span>
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

function avatarImagePath(key) {
  return assetPaths.avatars[key] ?? assetPaths.avatars.runner01;
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
  if (tab === 'damage') return renderDamageHelp();
  if (tab === 'stats') return renderStatsHelp();
  if (tab === 'upgrades') return renderUpgradeHelp();
  if (tab === 'programs') return renderProgramHelp();
  if (tab === 'ice') return renderIceHelp();
  if (tab === 'deck') return renderDeckHelp();
  if (tab === 'events') return renderEventHelp();
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
      ${renderCard('3 · Cobra', 'Extract carga tokens en el buffer. Con payload, vuelve a entrada/salida y pulsa Jack out.')}
    </div>
    <h3>Relojes base</h3>
    <div class="help-grid">${stats}</div>
    <h3>Estados de nodo</h3>
    <div class="help-grid help-grid--three">
      ${renderCard('UNKNOWN', 'No se puede visitar. Ejecuta Scan desde un nodo conectado.')}
      ${renderCard('SCANNED', 'Visible y alcanzable. Entrar por primera vez suma +1 ALERTA.')}
      ${renderCard('VISITED / COMPROMISED', 'Visitado ya conocido. Compromised significa drenado: no duplica loot.')}
    </div>
  </div>`;
}

function renderDamageHelp() {
  return `<div class="help-section">
    <div class="help-callout">
      <strong>Regla de oro</strong>
      <span>ALERTA y TRAZA suben hacia convergencia; SHELL baja hacia dump. Cada programa que avanza turno también consume un pulso de Shield y puede activar presión alta.</span>
    </div>
    <h3>Daño y presión</h3>
    <div class="help-grid">${damageHelp.map(([label, value, description]) => renderCard(`${label} // ${value}`, description)).join('')}</div>
    <h3>Fallos de run</h3>
    <div class="help-grid help-grid--three">
      ${renderCard('ALERTA 10', 'Convergencia defensiva: el host cierra la run.')}
      ${renderCard('TRAZA máxima', 'La traza cierra tu vector y te expulsa.')}
      ${renderCard('SHELL 0', 'Integridad agotada: dumped inmediato.')}
    </div>
  </div>`;
}

function renderStatsHelp() {
  return `<div class="help-section">
    <div class="help-callout">
      <strong>Stats + programas</strong>
      <span>Las stats del deck marcan el techo; el nivel del programa afina la acción. Muchas fórmulas suman ambos niveles y restan la base inicial.</span>
    </div>
    <div class="help-grid">${statMechanics.map(([label, hook, description]) => renderCard(`${label} // ${hook}`, description)).join('')}</div>
    <h3>Hardware</h3>
    <div class="help-grid help-grid--three">
      ${renderCard('Storage', 'Capacidad de loot = 3 + Storage x2. Si se llena, Extract aborta hasta salir o mejorar memoria.')}
      ${renderCard('Bookmarks', 'Hosts guardados = 2 + nivel de Bookmarks. Si se llena, no aparece Guardar host.')}
      ${renderCard('Costes', 'Subir stat cuesta 130 x nivel siguiente; hardware 120 x nivel siguiente; programa 90 x nivel siguiente.')}
    </div>
  </div>`;
}

function renderUpgradeHelp() {
  return `<div class="help-section">
    <div class="help-callout">
      <strong>Cred invertido = presión controlada</strong>
      <span>Las mejoras no hacen la run automática: cambian márgenes concretos. Sube el atributo y el programa que comparten fórmula cuando quieras notar un salto táctico claro.</span>
    </div>
    <h3>Atributos</h3>
    <div class="help-grid">${attributeUpgradeHelp.map(([label, hook, description]) => renderCard(`${label} // ${hook}`, description)).join('')}</div>
    <h3>Programas</h3>
    <div class="help-grid">${programUpgradeHelp.map(([label, hook, description]) => renderCard(`${label} // ${hook}`, description)).join('')}</div>
    <h3>Piezas y hardware</h3>
    <div class="help-grid help-grid--three">${hardwareUpgradeHelp.map(([label, hook, description]) => renderCard(`${label} // ${hook}`, description)).join('')}</div>
    <h3>Qué subir si...</h3>
    <div class="help-grid help-grid--three">
      ${renderCard('Te tumba el ICE', 'Pulse + Spike para neutralizar; Shell + Shield si el problema es sobrevivir al golpe.')}
      ${renderCard('Te caza la TRAZA', 'Veil + Ghost para más margen y limpiezas más fuertes antes de presión alta.')}
      ${renderCard('Dejas loot atrás', 'Memoria primero; luego Lens + Extract para cobrar con menos ruido.')}
      ${renderCard('El mapa sale ciego', 'Lens + Scan para revelar más rutas por acción y gastar menos turnos buscando.')}
      ${renderCard('Quieres farmear hosts', 'Bookmarks guarda objetivos buenos; el deck mejorado vuelve con más capacidad y menos riesgo.')}
      ${renderCard('No sabes qué comprar', 'Mejora parejas: atributo + programa. Un solo nivel aislado ayuda, pero los cortes buenos llegan por suma.')}
    </div>
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
      <span>Las runs dan cred. Gástalo en hardware, atributos y programas: un deck mejor permite asumir hosts más valiosos, pero no cancela la alerta.</span>
    </div>
    <h3>Piezas</h3>
    <div class="help-grid">${parts}</div>
    <h3>Atributos</h3>
    <div class="help-grid">${stats}</div>
    <h3>Economía de run</h3>
    <div class="help-grid help-grid--three">
      ${renderCard('Loot', 'Cada token sellado vale 25 cred en el buffer de run. Solo se cobra al cerrar la run.')}
      ${renderCard('Reward', 'Recompensa = tier del host + payload + loot + escape + bonus de score. Dumped mantiene un suelo de 12 cred.')}
      ${renderCard('Sync', 'Al conectar Nexus, deck, identidad, bookmarks y progreso se sincronizan con la cuenta.')}
    </div>
  </div>`;
}

function renderEventHelp() {
  const events = Object.values(nodeEvents)
    .map((event) => renderCard(`${event.glyph} · ${event.label} // ${event.program}`, eventMechanics[event.kind] ?? event.hint))
    .join('');

  return `<div class="help-section">
    <div class="help-callout">
      <strong>Marcadores</strong>
      <span>Las siglas bajo un nodo revelado indican eventos. Resolverlos reduce sorpresas y abre rutas.</span>
    </div>
    <div class="help-grid">${events}</div>
  </div>`;
}

function renderIceHelp() {
  const iceCards = Object.values(iceCatalog)
    .map((ice) => renderCard(`${ice.icon} · ${ice.label}`, `${ice.behavior} Debilidad: ${ice.weakness}. ${iceEffectText(ice.kind)}`))
    .join('');

  return `<div class="help-section">
    <div class="help-callout">
      <strong>ICE activo</strong>
      <span>Entrar en un nodo con ICE dispara su efecto inmediatamente. Spike lo neutraliza; Shield convierte muchos golpes en presión manejable.</span>
    </div>
    <div class="help-grid">${iceCards}</div>
    <h3>Programas bloqueados</h3>
    <div class="help-grid help-grid--three">
      ${renderCard('Crasher', 'Si no tienes Shield, bloquea el programa seleccionado y hace -1 SHELL.')}
      ${renderCard('Recuperación', 'Los programas bloqueados se limpian cada 3 turnos.')}
      ${renderCard('Neutralizar', 'Spike exitoso marca el ICE como neutralizado y deja el nodo en exploración.')}
    </div>
  </div>`;
}

function renderProgramHelp() {
  const programHelp = programs
    .map(
      (program) => renderCard(program.label, programMechanics[program.kind] ?? program.description),
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

function iceEffectText(kind) {
  return {
    watcher: 'Efecto: +2 ALERTA.',
    piercer: 'Efecto: +1 ALERTA y -2 SHELL; con Shield, -1 SHELL.',
    tracer: 'Efecto: +1 ALERTA y +2 TRAZA; con Shield, +1 TRAZA.',
    locker: 'Efecto: +1 ALERTA y +1 TRAZA.',
    crasher: 'Efecto: +1 ALERTA, -1 SHELL y bloqueo de programa si no hay Shield.',
  }[kind] ?? '';
}

function renderCard(label, description) {
  return `<article class="help-card">
    <strong>${escapeHtml(label)}</strong>
    <span>${escapeHtml(description)}</span>
  </article>`;
}
