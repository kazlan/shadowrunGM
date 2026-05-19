import { assetPaths } from '../assets/assetRegistry.js';
import { iceCatalog } from '../game/iceCatalog.js';
import { nodeEvents } from '../game/nodeEvents.js';
import { escapeHtml } from './html.js';
import { renderRunLogDialog } from './renderRunLog.js';

const nodeNamePools = {
  entry: ['DEV TERMINAL', 'ENTRY PORT', 'ACCESS JACK'],
  firewall: ['AUTH GATEWAY', 'ACCESS CTRL', 'BLACK GATE', 'PROXY LOCK'],
  data: ['DATA TAP', 'CACHE NODE', 'LOG SHARD', 'SIGNAL VAULT'],
  camera: ['SENSOR LENS', 'AUDIT NODE', 'NET MONITOR', 'WATCH TOWER'],
  database: ['DATA VAULT', 'USER DB', 'LOG SERVER', 'BACKUP NODE'],
  core: ['CORE NODE'],
  exit: ['PATCH SERVER', 'EXIT LINK', 'CLEAN ROUTE'],
};

const nodeGlyph = {
  entry: '>',
  firewall: 'FW',
  data: 'DT',
  camera: '◉',
  database: 'DB',
  core: '◆',
  exit: '↑',
};

export function renderNodeMap(system, run, mapView = { x: 0, y: 0, width: 100, height: 100 }, mapMessage = null, runResult = null, showResult = true, nodeVisit = null, mapReveal = null, player = null, runLogOpen = false, previousMeters = null, extractionView = null) {
  if (showResult && (run.status === 'escaped' || run.status === 'dumped')) {
    return renderRunResultWindow(system, run, runResult, player, runLogOpen);
  }

  const nodeLookup = new Map(system.nodes.map((node) => [node.id, node]));
  const recentNodeIds = new Set(mapReveal?.nodeIds ?? []);
  const recentEdgeKeys = new Set(mapReveal?.edgeKeys ?? []);
  const focusEdgeKey = nodeVisit?.fromNodeId && nodeVisit?.nodeId
    ? getEdgeKey({ from: nodeVisit.fromNodeId, to: nodeVisit.nodeId })
    : null;
  const edges = system.edges
    .map((edge) => renderRoute(edge, nodeLookup, run, recentNodeIds, recentEdgeKeys, focusEdgeKey, nodeVisit))
    .join('');

  const nodes = system.nodes
    .map((node) => renderCyberNode(node, system, run, recentNodeIds, nodeVisit))
    .join('');

  const visitingClass = nodeVisit ? ` node-map--visiting node-map--visit-${escapeHtml(nodeVisit.phase ?? 'focus')}` : '';

  return `<section class="node-map${visitingClass}" aria-label="Mapa de nodos del host">
    <div class="node-map__heading">
      <p class="eyebrow">Turno ${run.turn} · ${escapeHtml(system.valuation?.tier ?? 'C')} ${system.valuation?.score ?? 0}/100</p>
      <strong class="fx-glitch" data-text="${escapeHtml(system.alias)}">${escapeHtml(system.alias)}</strong>
      <small>${escapeHtml(system.company.name)} · Seg ${system.effectiveSecurity ?? system.archetype.security}</small>
    </div>
    ${renderMapMeters(run, previousMeters, extractionView)}
    ${renderMapActions(system, run, false, player)}
    ${renderMapMessage(mapMessage)}
    ${renderRunLogDialog(runLogOpen, run)}
    <svg viewBox="${formatViewBox(mapView)}" role="img" data-map-surface="true">
      <defs>
        <filter id="mapNodeGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.05" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="mapCoreGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.8" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g class="node-map__graph" transform="translate(0 20)">
        ${renderMapBackplane()}
        <g class="node-map__routes" aria-hidden="true">${edges}</g>
        <g class="node-map__nodes">${nodes}</g>
      </g>
    </svg>
    ${renderNodeFocusHud(system, run, nodeVisit)}
  </section>`;
}

function renderMapMeters(run, previousMeters = null, extractionView = null) {
  return `<aside class="node-map__meters" aria-label="Estado de la run">
    ${renderMapMeter('ALERTA', run.alert, run.maxAlert, 'alert', previousMeters)}
    ${renderMapMeter('TRAZA', run.trace, run.maxTrace, 'trace', previousMeters)}
    ${renderMapMeter('SHELL', run.integrity, run.maxIntegrity, 'integrity', previousMeters)}
    ${renderExtractionMeter(run, previousMeters, extractionView)}
  </aside>`;
}

function renderMapMeter(label, value, max, kind, previousMeters = null) {
  const percent = Math.round((value / max) * 100);
  const ratio = clampRatio(value / max);
  const previousRatio = previousMeters?.[kind] ?? ratio;
  const icon = {
    alert: '!',
    trace: '⌖',
    integrity: '◆',
  }[kind] ?? '•';
  return `<div class="node-map-meter node-map-meter--${kind}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)} ${value} de ${max}" data-meter-kind="${kind}" data-meter-ratio="${formatNumber(ratio)}">
    <span class="node-map-meter__icon" aria-hidden="true">${escapeHtml(icon)}</span>
    <i style="--meter:${percent}%; --meter-ratio:${formatNumber(ratio)}; --meter-from-ratio:${formatNumber(previousRatio)}"></i>
    <strong>${value}/${max}</strong>
  </div>`;
}

function renderExtractionMeter(run, previousMeters = null, extractionView = null) {
  const maxLoot = Math.max(0, Math.round(extractionView?.maxLoot ?? run.maxLootTokens ?? 0));
  if (!maxLoot) return '';

  const loot = Math.min(maxLoot, Math.max(0, Number(extractionView?.loot ?? run.lootTokens ?? 0)));
  const roundedLoot = Math.round(loot);
  const previousLoot = Number.isFinite(previousMeters?.extractionValue)
    ? Math.min(maxLoot, Math.max(0, previousMeters.extractionValue))
    : loot;
  const ratio = clampRatio(loot / maxLoot);
  const previousRatio = clampRatio(previousLoot / maxLoot);
  const slots = Array.from({ length: maxLoot }, (_, index) => {
    const fill = clampRatio(loot - index);
    const previousFill = clampRatio(previousLoot - index);
    const filledClass = fill >= 1 ? ' is-filled' : fill > 0 ? ' is-partial' : '';
    return `<span class="node-map-extraction__slot${filledClass}" style="--slot-fill:${formatNumber(fill)}; --slot-from:${formatNumber(previousFill)}"></span>`;
  }).join('');

  return `<div class="node-map-extraction" aria-label="Extracción ${roundedLoot} de ${maxLoot}" data-meter-kind="extraction" data-meter-ratio="${formatNumber(ratio)}" data-meter-value="${formatNumber(loot)}" data-meter-max="${maxLoot}">
    <span class="node-map-extraction__icon" aria-hidden="true">¤</span>
    <em aria-hidden="true" style="--extract-slots:${maxLoot}; --meter-ratio:${formatNumber(ratio)}; --meter-from-ratio:${formatNumber(previousRatio)}">${slots}</em>
  </div>`;
}

function renderRoute(edge, nodeLookup, run, recentNodeIds, recentEdgeKeys, focusEdgeKey, nodeVisit) {
  const from = nodeLookup.get(edge.from);
  const to = nodeLookup.get(edge.to);
  if (!from || !to) return '';

  const key = getEdgeKey(edge);
  const path = getConnectionPath(from, to, key);
  const hidden = from.state === 'unknown' || to.state === 'unknown';
  const recent = recentEdgeKeys.has(key) || recentNodeIds.has(from.id) || recentNodeIds.has(to.id);
  const focused = key === focusEdgeKey;
  const focusPhase = focused ? `route--focus-${nodeVisit?.phase ?? 'focus'}` : '';
  const classes = [
    'map-route',
    hidden ? 'route--hidden' : '',
    !hidden && isRouteReachable(run, from.id, to.id) ? 'route--reachable' : '',
    !hidden && (isHostileNode(from) || isHostileNode(to)) ? 'route--hostile' : '',
    !hidden && !isHostileNode(from) && !isHostileNode(to) && (isLockedNode(from) || isLockedNode(to)) ? 'route--locked' : '',
    !hidden && from.state === 'compromised' && to.state === 'compromised' ? 'route--secured' : '',
    recent ? 'route--recent' : '',
    focused ? 'route--focus' : '',
    focusPhase,
  ].filter(Boolean).join(' ');

  return `<g class="${classes}">
    <path class="route__glow" d="${path.d}" />
    <path class="route__rail" d="${path.d}" />
    <path class="route__core" d="${path.d}" />
    <path class="route__scan" d="${path.d}" />
    <circle class="route__bead route__bead--from" cx="${formatNumber(path.start.x)}" cy="${formatNumber(path.start.y)}" r="0.72" />
    <circle class="route__bead route__bead--mid" cx="${formatNumber(path.mid.x)}" cy="${formatNumber(path.mid.y)}" r="0.88" />
    <circle class="route__bead route__bead--to" cx="${formatNumber(path.end.x)}" cy="${formatNumber(path.end.y)}" r="0.72" />
  </g>`;
}

function renderCyberNode(node, system, run, recentNodeIds, nodeVisit) {
  const ice = node.ice && !node.iceNeutralized ? iceCatalog[node.ice] : undefined;
  const event = node.event && !node.eventResolved ? nodeEvents[node.event] : undefined;
  const isKnown = node.state !== 'unknown';
  const isReachable = isNodeReachable(system, run, node.id);
  const label = isKnown ? getNodeDisplayName(node) : 'UNKNOWN';
  const level = isKnown ? `LVL ${node.risk ?? '?'}` : 'LOCKED';
  const isCore = node.kind === 'core';
  const outerRadius = isCore ? 6.95 : 5.15;
  const iconSize = isCore ? 11.4 : 9.05;
  const title = [
    label,
    `Estado: ${node.state}`,
    isKnown ? `Riesgo: ${node.risk ?? '?'}` : '',
    ice ? `ICE: ${ice.label}` : '',
    event ? `${event.label}: ${event.hint}` : '',
  ].filter(Boolean).join(' | ');
  const icon = isKnown && assetPaths.nodes[node.kind]
    ? `<image href="${escapeHtml(assetPaths.nodes[node.kind])}" x="${formatNumber(-iconSize / 2)}" y="${formatNumber(-iconSize / 2)}" width="${formatNumber(iconSize)}" height="${formatNumber(iconSize)}" preserveAspectRatio="xMidYMid meet" class="node__icon" />`
    : `<text x="0" y="1.3" class="node__glyph">${escapeHtml(isKnown ? nodeGlyph[node.kind] ?? '?' : '?')}</text>`;
  const iceBadge = isKnown && ice
    ? `<g class="node__badge node__badge--ice" transform="translate(${isCore ? 7.15 : 5.25} ${isCore ? -7.15 : -5.25})">
        <polygon points="${hexPoints(2.45)}" />
        <image href="${escapeHtml(assetPaths.defensePng[node.ice] ?? assetPaths.defenses[node.ice])}" x="-1.55" y="-1.55" width="3.1" height="3.1" preserveAspectRatio="xMidYMid meet" />
      </g>`
    : '';
  const eventBadge = isKnown && event
    ? `<g class="node__badge node__badge--event" transform="translate(${isCore ? -7.15 : -5.25} ${isCore ? 7.15 : 5.25})">
        <polygon points="${hexPoints(2.28)}" />
        <text x="0" y=".72">${escapeHtml(event.glyph)}</text>
      </g>`
    : '';
  const classes = [
    'node',
    `node--${node.kind}`,
    `node--${node.state}`,
    node.isCurrent ? 'node--current' : '',
    isReachable ? 'node--reachable' : '',
    isLockedNode(node) ? 'node--locked' : '',
    isHostileNode(node) ? 'node--hostile' : '',
    node.state === 'compromised' ? 'node--secured' : '',
    recentNodeIds.has(node.id) ? 'node--recent' : '',
    nodeVisit?.nodeId === node.id ? 'node--visit-focus' : '',
    nodeVisit?.nodeId === node.id ? `node--visit-${nodeVisit.phase ?? 'focus'}` : '',
  ].filter(Boolean).join(' ');
  const coreRings = isCore
    ? `<circle class="node__core-ring node__core-ring--outer" r="12.1" />`
    : '';

  return `<g data-node-id="${escapeHtml(node.id)}" class="${classes}" transform="translate(${formatNumber(node.x)} ${formatNumber(node.y)})">
    <title>${escapeHtml(title)}</title>
    <circle class="node__hit" r="${isCore ? 13.2 : 10.4}" />
    ${coreRings}
    <polygon class="node__frame node__frame--aura" points="${hexPoints(outerRadius + .88)}" />
    <polygon class="node__frame node__frame--outer" points="${hexPoints(outerRadius)}" filter="${isCore ? 'url(#mapCoreGlow)' : 'url(#mapNodeGlow)'}" />
    ${icon}
    <text x="0" y="${isCore ? 13.35 : 10.45}" class="node__label">${escapeHtml(label)}</text>
    <text x="0" y="${isCore ? 16.05 : 12.8}" class="node__level">${escapeHtml(level)}</text>
    <circle class="node__burst" r="${outerRadius + 2.6}" />
    ${iceBadge}
    ${eventBadge}
  </g>`;
}

function renderMapBackplane() {
  return `<g class="map-backplane" aria-hidden="true">
    <rect x="-4" y="-6" width="108" height="116" />
    <path d="M4 18 H24 L31 25 H49 L57 17 H80 L95 31" />
    <path d="M7 74 H21 L28 66 H46 L54 74 H73 L92 59" />
    <path d="M13 3 V21 M34 8 V34 M66 2 V28 M88 35 V82 M48 72 V101" />
    <path d="M1 48 H16 L24 56 H38 M62 46 H74 L82 39 H101" />
    <circle cx="24" cy="25" r="1.1" />
    <circle cx="57" cy="17" r="1.1" />
    <circle cx="73" cy="74" r="1.1" />
    <circle cx="82" cy="39" r="1.1" />
  </g>`;
}

function getConnectionPath(from, to) {
  const mid = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };

  return {
    start: { x: from.x, y: from.y },
    mid,
    end: { x: to.x, y: to.y },
    d: `M ${formatNumber(from.x)} ${formatNumber(from.y)} L ${formatNumber(to.x)} ${formatNumber(to.y)}`,
  };
}

function hexPoints(radius) {
  const points = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 180) * (30 + index * 60);
    points.push(`${formatNumber(Math.cos(angle) * radius)},${formatNumber(Math.sin(angle) * radius)}`);
  }
  return points.join(' ');
}

function getNodeDisplayName(node) {
  const names = nodeNamePools[node.kind] ?? [node.kind.toUpperCase()];
  const numericId = Number.parseInt(String(node.id).replace(/\D/g, ''), 10) || 0;
  return names[numericId % names.length];
}

function isRouteReachable(run, fromId, toId) {
  return run.currentNodeId === fromId || run.currentNodeId === toId;
}

function isLockedNode(node) {
  if (node.state === 'unknown') return false;
  const event = node.event && !node.eventResolved ? nodeEvents[node.event] : null;
  return Boolean((node.ice && !node.iceNeutralized) || ['gate', 'trap'].includes(event?.kind));
}

function isHostileNode(node) {
  if (node.state === 'unknown') return false;
  const event = node.event && !node.eventResolved ? nodeEvents[node.event] : null;
  return Boolean(
    (node.kind === 'core' && node.state !== 'compromised')
    || (node.isCurrent && node.ice && !node.iceNeutralized)
    || (node.isCurrent && event?.kind === 'trap'),
  );
}

function getEdgeKey(edge) {
  return [edge.from, edge.to].sort().join(':');
}

function renderNodeFocusHud(system, run, nodeVisit) {
  if (!nodeVisit) return '';
  const node = system.nodes.find((candidate) => candidate.id === nodeVisit.nodeId);
  if (!node) return '';

  const ice = node.ice && !node.iceNeutralized ? iceCatalog[node.ice] : null;
  const event = node.event && !node.eventResolved ? nodeEvents[node.event] : null;
  const mode = nodeVisit.mode ?? 'active';
  const operationName = getNodeDisplayName(node);
  const defenseLabel = ice?.label ?? 'Sin ICE';
  const iceIcon = ice ? assetPaths.defensePng[node.ice] ?? assetPaths.defenses[node.ice] : null;
  const eyebrow = getNodeFocusEyebrow(node, nodeVisit, mode, ice, event);
  const hint = mode === 'visited' ? getVisitedNodeHint(node) : ice?.weakness ?? event?.hint ?? getDefaultNodeHint(node);
  const hintLine = `<p class="node-focus-hud__hint">
        <span>${escapeHtml(hint)}</span>
      </p>`;
  const icePanel = ice ? `<aside class="node-focus-hud__ice node-focus-hud__ice--active">
      ${iceIcon ? `<img src="${escapeHtml(iceIcon)}" alt="" loading="lazy" />` : ''}
      <span>ICE</span>
      <b>${escapeHtml(defenseLabel)}</b>
    </aside>` : '';
  const stamp = nodeVisit.stamp
    ? `<div class="node-focus-hud__stamp fx-glitch" data-text="${escapeHtml(nodeVisit.stamp)}">${escapeHtml(nodeVisit.stamp)}</div>`
    : '';

  return `<article class="node-focus-hud node-focus-hud--${escapeHtml(nodeVisit.phase ?? 'focus')} node-focus-hud--${escapeHtml(mode)} ${ice ? 'node-focus-hud--has-ice' : ''}" aria-live="polite">
    <div class="node-focus-hud__grid" aria-hidden="true"></div>
    <div class="node-focus-hud__main">
      <header class="node-focus-hud__header">
        <span>${escapeHtml(eyebrow)}</span>
        <strong>${escapeHtml(operationName)}</strong>
      </header>
      ${hintLine}
    </div>
    ${icePanel}
    ${stamp}
  </article>`;
}

function getDefaultNodeHint(node) {
  if (['data', 'database', 'core'].includes(node.kind)) return 'Payload posible en el buffer del nodo.';
  if (node.kind === 'exit') return 'Salida viable para asegurar la run.';
  return 'Nodo estable, lectura de host sin defensa activa.';
}

function getNodeFocusEyebrow(node, nodeVisit, mode, ice, event) {
  if (ice) return `ICE ${ice.label} // LVL ${node.risk ?? '?'}`;
  if (nodeVisit.phase === 'resolved') return 'Nodo limpio // firma sellada';
  if (nodeVisit.phase === 'failed') return 'Retorno hostil // firma expuesta';
  if (mode === 'visited') return `VISITED // ${node.kind.toUpperCase()} // RISK/${node.risk ?? '?'}`;
  if (event) return `${event.label} // LVL ${node.risk ?? '?'}`;
  return `${node.kind.toUpperCase()} // RISK/${node.risk ?? '?'}`;
}

function getVisitedNodeHint(node) {
  if (node.state === 'compromised') return 'Nodo drenado. Chatarra caliente y silencio caro.';
  return 'Nodo ya quemado. El neón recuerda tus huellas.';
}

function renderRunResultWindow(system, run, runResult = null, player = null, runLogOpen = false) {
  const resultStatus = runResult?.status ?? run.status;
  const lootTokens = runResult?.lootTokens ?? run.lootTokens ?? 0;
  const success = resultStatus === 'escaped' && (run.hasPayload || lootTokens > 0);
  const securedNodes = runResult?.securedNodes ?? Object.values(run.nodeStates).filter((state) => state !== 'unknown').length;
  const nodeCount = runResult?.nodeCount ?? system.nodes.length;
  const score = runResult?.score ?? 0;
  const reward = runResult?.reward ?? 0;
  const playerName = runResult?.playerName ?? runResult?.operator ?? 'NEON GHOST';
  const credits = runResult?.credits ?? 0;
  const totalEarned = runResult?.totalEarned ?? reward;
  const hostsDominated = runResult?.hostsDominated ?? (success ? 1 : 0);
  const completedRuns = runResult?.completedRuns ?? (success ? 1 : 0);
  const totalRuns = runResult?.totalRuns ?? 1;
  const bestScore = Math.max(score, runResult?.bestScore ?? 0);
  const status = success ? 'EXTRACCIÓN CONFIRMADA' : 'CONEXIÓN CORTADA';
  const command = success
    ? `> cerrar_run --host ${system.alias} --payload asegurado --mapa off`
    : `> cerrar_run --host ${system.alias} --dump-shock --mapa off`;
  const payloadName = `PAYLOAD_${system.seedId ?? 'HOST'}_${Math.max(64, lootTokens * 64 || 128)}BIT`;
  const resultClass = success ? 'node-map--success' : 'node-map--failure';

  return `<section class="node-map node-map--result ${resultClass}" aria-label="Resumen final de la run">
    ${renderRunLogDialog(runLogOpen, run)}
    <div class="result-terminal">
      <p class="result-command">${escapeHtml(command)}</p>
      <strong class="result-brand fx-glitch" data-text="SHADOW HACK">SHADOW HACK</strong>
      <span class="result-subtitle">${escapeHtml(status)} · VENTANA DE MAPA CERRADA</span>
      <div class="result-message">
        <p>${success ? 'Operador validado. El host queda dominado y los datos han sido cifrados en frío.' : 'Alerta negra. El host ha expulsado tu señal y la extracción queda contaminada.'}</p>
        <p>Runner: <b>${escapeHtml(playerName)}</b> · Host: <b>${escapeHtml(system.alias)}</b></p>
        <p>Botín: <b>${lootTokens} token(s)</b> · Transferencia: <b>${reward} cred</b> · Score: <b>${score}</b></p>
      </div>
      <dl class="result-player-stats" aria-label="Estadísticas del jugador">
        ${renderResultStat('Hosts dominados', hostsDominated)}
        ${renderResultStat('Runs limpias', completedRuns)}
        ${renderResultStat('Runs totales', totalRuns)}
        ${renderResultStat('Dinero amasado', `${totalEarned} cred`)}
        ${renderResultStat('Cuenta actual', `${credits} cred`)}
        ${renderResultStat('Mejor score', bestScore)}
      </dl>
      <p class="result-stats">[mapa:off] ALERTA ${run.alert}/${run.maxAlert} | TRAZA ${run.trace}/${run.maxTrace} | SHELL ${run.integrity}/${run.maxIntegrity} | NODOS ${securedNodes}/${nodeCount}</p>
      <ul class="result-log">
        <li>Paquete: ${escapeHtml(payloadName)}${success ? ' sellado' : ' descartado por corrupción'}</li>
        <li>${success ? `${escapeHtml(system.company.name)} queda registrado como objetivo dominado.` : 'Protocolo de purga ejecutado. No se reabre el mapa anterior.'}</li>
      </ul>
    </div>
  </section>`;
}

function renderResultStat(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
}

function renderMapLogButton(run) {
  const count = run?.log?.length ?? 0;
  return `<button class="node-map__log-button" data-action="toggleRunLog" type="button" aria-label="Abrir historial de intrusión">
    <span>LOG</span>
    <b>${count}</b>
  </button>`;
}

function renderMapMessage(mapMessage) {
  if (!mapMessage?.text) return '';
  const text = String(mapMessage.text);
  const characterMs = 34;
  const characters = Array.from(text).slice(0, 160);
  const typeDuration = Math.max(characterMs, characters.length * characterMs);
  const typedCharacters = characters
    .map((character, index) => `<span class="node-map__message-char" style="animation-delay:${index * characterMs}ms">${character === ' ' ? '&nbsp;' : escapeHtml(character)}</span>`)
    .join('');

  return `<div class="node-map__message" aria-live="polite" data-log-key="${escapeHtml(mapMessage.key ?? 'log')}">
    <span class="node-map__message-text" data-text="${escapeHtml(text)}" style="--type-duration:${typeDuration}ms">
      ${typedCharacters}<i class="node-map__message-cursor" aria-hidden="true"></i>
    </span>
  </div>`;
}

function formatViewBox(view) {
  return [view.x, view.y, view.width, view.height].map(formatNumber).join(' ');
}

function renderMapActions(system, run, finished = false, player = null) {
  const identity = normalizeMapIdentity(player);
  const avatar = assetPaths.avatars[identity.avatar] ?? assetPaths.avatars.runner01;
  const currentNode = system.nodes.find((node) => node.id === run.currentNodeId);
  const canJackOutCleanly = run.currentNodeId === system.entryNodeId || currentNode?.kind === 'exit';
  const jackOutClass = canJackOutCleanly ? ' node-map__jack-out--safe' : '';
  const jackOutLabel = canJackOutCleanly ? 'Jack out: ruta limpia' : 'Jack out';

  return `<div class="node-map__actions" aria-label="Acciones de la run">
    ${renderMapLogButton(run)}
    <button class="jack-out node-map__jack-out${jackOutClass}" data-action="jackOut" type="button" aria-label="${escapeHtml(jackOutLabel)}" ${finished ? 'disabled' : ''}>Jack out</button>
    <button class="node-map__avatar-settings runner-id--${escapeHtml(identity.avatar)}" data-action="toggleSettings" type="button" aria-label="${escapeHtml(`Abrir ajustes de ${identity.shadowName}`)}" title="${escapeHtml(identity.shadowName)}">
      <img src="${escapeHtml(avatar)}" alt="" loading="lazy" />
    </button>
  </div>`;
}

function normalizeMapIdentity(player) {
  const avatar = assetPaths.avatars[player?.avatar] ? player.avatar : 'runner01';
  return {
    shadowName: String(player?.shadowName || 'NEON GHOST').slice(0, 24),
    avatar,
  };
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function clampRatio(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function isNodeReachable(system, run, nodeId) {
  if (nodeId === run.currentNodeId) return false;
  if (run.nodeStates[nodeId] === 'unknown') return false;
  return system.edges.some((edge) =>
    (edge.from === run.currentNodeId && edge.to === nodeId) || (edge.to === run.currentNodeId && edge.from === nodeId),
  );
}
