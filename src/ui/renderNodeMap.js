import { assetPaths } from '../assets/assetRegistry.js';
import { iceCatalog } from '../game/iceCatalog.js';
import { nodeEvents } from '../game/nodeEvents.js';
import { escapeHtml } from './html.js';

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

export function renderNodeMap(system, run, mapView = { x: 0, y: 0, width: 100, height: 100 }, mapMessage = null, runResult = null, showResult = true, nodeVisit = null, mapReveal = null) {
  if (showResult && (run.status === 'escaped' || run.status === 'dumped')) {
    return renderRunResultWindow(system, run, runResult);
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
    ${renderMapMeters(run)}
    ${renderMapLogButton(run)}
    ${renderMapMessage(mapMessage)}
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

function renderMapMeters(run) {
  return `<aside class="node-map__meters" aria-label="Estado de la run">
    ${renderMapMeter('ALERTA', run.alert, run.maxAlert, 'alert')}
    ${renderMapMeter('TRAZA', run.trace, run.maxTrace, 'trace')}
    ${renderMapMeter('SHELL', run.integrity, run.maxIntegrity, 'integrity')}
  </aside>`;
}

function renderMapMeter(label, value, max, kind) {
  const percent = Math.round((value / max) * 100);
  return `<div class="node-map-meter node-map-meter--${kind}">
    <span>${label}</span>
    <i style="--meter:${percent}%"></i>
    <strong>${value}/${max}</strong>
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
  const outerRadius = isCore ? 8.2 : 6.05;
  const innerRadius = isCore ? 5.25 : 3.95;
  const title = [
    label,
    `Estado: ${node.state}`,
    isKnown ? `Riesgo: ${node.risk ?? '?'}` : '',
    ice ? `ICE: ${ice.label}` : '',
    event ? `${event.label}: ${event.hint}` : '',
  ].filter(Boolean).join(' | ');
  const icon = isKnown && assetPaths.nodes[node.kind]
    ? `<image href="${escapeHtml(assetPaths.nodes[node.kind])}" x="${isCore ? -3.9 : -3.05}" y="${isCore ? -3.9 : -3.05}" width="${isCore ? 7.8 : 6.1}" height="${isCore ? 7.8 : 6.1}" preserveAspectRatio="xMidYMid meet" class="node__icon" />`
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
    ? `<circle class="node__core-ring node__core-ring--outer" r="11.4" />
       <circle class="node__core-ring node__core-ring--mid" r="9.6" />
       <circle class="node__core-ring node__core-ring--inner" r="7.3" />`
    : '';

  return `<g data-node-id="${escapeHtml(node.id)}" class="${classes}" transform="translate(${formatNumber(node.x)} ${formatNumber(node.y)})">
    <title>${escapeHtml(title)}</title>
    <circle class="node__hit" r="${isCore ? 13.2 : 10.4}" />
    ${coreRings}
    <polygon class="node__frame node__frame--aura" points="${hexPoints(outerRadius + 1.35)}" />
    <polygon class="node__frame node__frame--outer" points="${hexPoints(outerRadius)}" filter="${isCore ? 'url(#mapCoreGlow)' : 'url(#mapNodeGlow)'}" />
    <polygon class="node__frame node__frame--inner" points="${hexPoints(innerRadius)}" />
    <circle class="node__socket" r="${isCore ? 3.35 : 2.55}" />
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
  const status = nodeVisit.phase === 'resolved' ? 'RESOLVED'
    : nodeVisit.phase === 'failed' ? 'HOSTILE'
      : node.state === 'compromised' ? 'COMPROMISED'
        : 'ACTIVE';
  const operationName = getNodeDisplayName(node);
  const defenseLabel = ice?.label ?? 'Sin ICE';
  const iceIcon = ice ? assetPaths.defensePng[node.ice] ?? assetPaths.defenses[node.ice] : null;
  const nodeIcon = assetPaths.nodes[node.kind];
  const recommendedProgram = nodeVisit.recommendedProgram ? labelProgram(nodeVisit.recommendedProgram) : 'Scan';
  const hint = ice?.weakness ?? event?.hint ?? getDefaultNodeHint(node);
  const stamp = nodeVisit.stamp
    ? `<div class="node-focus-hud__stamp fx-glitch" data-text="${escapeHtml(nodeVisit.stamp)}">${escapeHtml(nodeVisit.stamp)}</div>`
    : '';

  return `<article class="node-focus-hud node-focus-hud--${escapeHtml(nodeVisit.phase ?? 'focus')}" aria-live="polite">
    <div class="node-focus-hud__grid" aria-hidden="true"></div>
    <div class="node-focus-hud__icon">
      <img src="${escapeHtml(nodeIcon)}" alt="" loading="lazy" />
    </div>
    <div class="node-focus-hud__main">
      <header class="node-focus-hud__header">
        <span>${escapeHtml(status)} // ${escapeHtml(node.kind.toUpperCase())} // risk/${escapeHtml(String(node.risk ?? '?'))}</span>
        <strong>${escapeHtml(operationName)}</strong>
      </header>
      <p class="node-focus-hud__hint">
        <span>${escapeHtml(hint)}</span>
        <b>REC: ${escapeHtml(recommendedProgram)}</b>
      </p>
    </div>
    <aside class="node-focus-hud__ice ${ice ? 'node-focus-hud__ice--active' : ''}">
      ${iceIcon ? `<img src="${escapeHtml(iceIcon)}" alt="" loading="lazy" />` : ''}
      <span>ICE</span>
      <b>${escapeHtml(defenseLabel)}</b>
    </aside>
    ${stamp}
  </article>`;
}

function getDefaultNodeHint(node) {
  if (['data', 'database', 'core'].includes(node.kind)) return 'Payload posible en el buffer del nodo.';
  if (node.kind === 'exit') return 'Salida viable para asegurar la run.';
  return 'Nodo estable, lectura de host sin defensa activa.';
}

function labelProgram(program) {
  return program.charAt(0).toUpperCase() + program.slice(1);
}

function renderRunResultWindow(system, run, runResult = null) {
  const resultStatus = runResult?.status ?? run.status;
  const lootTokens = runResult?.lootTokens ?? run.lootTokens ?? 0;
  const success = resultStatus === 'escaped' && (run.hasPayload || lootTokens > 0);
  const status = success ? 'success' : 'critical';
  const operator = runResult?.operator ?? 'usr@sh';
  const securedNodes = runResult?.securedNodes ?? Object.values(run.nodeStates).filter((state) => state !== 'unknown').length;
  const nodeCount = runResult?.nodeCount ?? system.nodes.length;
  const score = runResult?.score ?? 0;
  const reward = runResult?.reward ?? 0;
  const command = success
    ? `[${operator}]> run_complete.sh --status success --user validated`
    : `[${operator}]> run_complete.sh --status critical --data_purge_in_progress`;
  const access = success ? 'GRANTED' : 'DENIED';
  const accessCode = success ? `RCN-${system.valuation?.tier ?? 'C'}-${score}-KEY` : 'RCN-SYS-LOCKED';
  const systemState = success ? 'COMPROMISED - SECURED' : 'COMPROMISED - LOCKED';
  const payloadName = `RCN_CORE_${system.seedId ?? 'HOST'}_KEY_${Math.max(64, lootTokens * 64 || 128)}BIT.enc`;
  const resultClass = success ? 'node-map--success' : 'node-map--failure';

  return `<section class="node-map node-map--result ${resultClass}" aria-label="Resultado de la run">
    <div class="result-terminal">
      <p class="result-command">${escapeHtml(command)}</p>
      <strong class="result-brand fx-glitch" data-text="SHADOW HACK">SHADOW HACK</strong>
      <span class="result-subtitle">CYBERDECK INTERFACE SYSTEM</span>
      <div class="result-message">
        <p>${success ? 'Congratulations, Operator. The data node has been secured and encrypted.' : 'WARNING, OPERATOR. The node is NOT secured.'}</p>
        <p>Core Database Access: <b>${access}</b> (${escapeHtml(accessCode)})</p>
        <p>System State: <b>${systemState}</b></p>
      </div>
      <p class="result-stats">[i] ALERT: ${run.alert}/${run.maxAlert} | TRACE: ${run.trace}/${run.maxTrace} | SHELL: ${run.integrity}/${run.maxIntegrity} | ${securedNodes}/${nodeCount} [${success ? 'SECURED' : 'NULL'}]</p>
      <ul class="result-log">
        <li>Extraction Log: ${escapeHtml(payloadName)}${success ? '' : ' (Error: Zero Bytes)'}</li>
        <li>Security State: ${success ? `Secured, ${reward} cred transferred to account, score ${score}.` : `CRITICAL FALLBACK INITIATED, score ${score}.`}</li>
        <li>${success ? `${escapeHtml(system.company.name)} waiting for new task.` : 'DATA PURGE IN PROGRESS...'}</li>
      </ul>
    </div>
  </section>`;
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
  return `<div class="node-map__message" aria-live="polite" data-log-key="${escapeHtml(mapMessage.key ?? 'log')}">
    <span class="fx-glitch" data-text="${escapeHtml(mapMessage.text)}">${escapeHtml(mapMessage.text)}</span>
  </div>`;
}

function formatViewBox(view) {
  return `${view.x} ${view.y} ${view.width} ${view.height}`;
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function isNodeReachable(system, run, nodeId) {
  if (nodeId === run.currentNodeId) return false;
  if (run.nodeStates[nodeId] === 'unknown') return false;
  return system.edges.some((edge) =>
    (edge.from === run.currentNodeId && edge.to === nodeId) || (edge.to === run.currentNodeId && edge.from === nodeId),
  );
}
