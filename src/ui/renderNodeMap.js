import { assetPaths } from '../assets/assetRegistry.js';
import { iceCatalog } from '../game/iceCatalog.js';
import { nodeEvents } from '../game/nodeEvents.js';
import { escapeHtml } from './html.js';

const nodeGlyph = {
  entry: 'IN',
  firewall: 'FW',
  data: 'DT',
  camera: 'CAM',
  database: 'DB',
  core: 'CPU',
  exit: 'OUT',
};

export function renderNodeMap(system, run, mapView = { x: 0, y: 0, width: 100, height: 100 }, mapMessage = null, runResult = null, showResult = true, nodeVisit = null) {
  if (showResult && (run.status === 'escaped' || run.status === 'dumped')) {
    return renderRunResultWindow(system, run, runResult);
  }

  const edges = system.edges
    .map((edge) => {
      const from = system.nodes.find((node) => node.id === edge.from);
      const to = system.nodes.find((node) => node.id === edge.to);
      if (!from || !to) return '';
      const hidden = from.state === 'unknown' || to.state === 'unknown';
      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="${hidden ? 'edge edge--hidden' : 'edge'}" />`;
    })
    .join('');

  const nodes = system.nodes
    .map((node) => {
      const ice = node.ice && !node.iceNeutralized ? iceCatalog[node.ice] : undefined;
      const event = node.event && !node.eventResolved ? nodeEvents[node.event] : undefined;
      const radius = node.kind === 'core' ? 5.6 : 4.3;
      const isReachable = isNodeReachable(system, run, node.id);
      const iceMarker = ice && node.state !== 'unknown'
        ? `<image href="${assetPaths.defensePng[node.ice] ?? assetPaths.defenses[node.ice]}" x="${node.x + 3.8}" y="${node.y - 10.8}" width="7" height="7" class="ice-marker" />`
        : '';
      const eventMarker = event && node.state !== 'unknown'
        ? `<text x="${node.x}" y="${node.y + radius + 4.6}" class="event-marker">${escapeHtml(event.glyph)}</text>`
        : '';

      return `<g data-node-id="${node.id}" class="node node--${node.kind} node--${node.state} ${node.isCurrent ? 'node--current' : ''} ${isReachable ? 'node--reachable' : ''}" filter="url(#glow)">
        ${event ? `<title>${escapeHtml(`${event.label}: ${event.hint}`)}</title>` : ''}
        <circle cx="${node.x}" cy="${node.y}" r="${radius}" />
        <text x="${node.x}" y="${node.y + 1.1}">${node.state === 'unknown' ? '?' : nodeGlyph[node.kind]}</text>
        ${iceMarker}
        ${eventMarker}
      </g>`;
    })
    .join('');

  const visitingClass = nodeVisit ? ` node-map--visiting node-map--visit-${escapeHtml(nodeVisit.phase ?? 'focus')}` : '';

  return `<section class="node-map${visitingClass}" aria-label="Mapa de nodos del host">
    <div class="node-map__heading">
      <p class="eyebrow">Turno ${run.turn} · ${escapeHtml(system.valuation?.tier ?? 'C')} ${system.valuation?.score ?? 0}/100</p>
      <strong class="fx-glitch" data-text="${escapeHtml(system.alias)}">${escapeHtml(system.alias)}</strong>
      <small>${escapeHtml(system.company.name)} · Seg ${system.effectiveSecurity ?? system.archetype.security}</small>
    </div>
    <div class="node-map__controls" aria-label="Controles del mapa">
      <button data-map-action="zoomOut" type="button" aria-label="Alejar mapa">-</button>
      <button data-map-action="reset" type="button" aria-label="Recentrar mapa">R</button>
      <button data-map-action="zoomIn" type="button" aria-label="Acercar mapa">+</button>
    </div>
    ${renderMapMessage(mapMessage)}
    <svg viewBox="${formatViewBox(mapView)}" role="img" data-map-surface="true">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.8" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g class="node-map__graph" transform="translate(0 20)">
        ${edges}
        ${nodes}
      </g>
    </svg>
    ${renderNodeDiorama(system, run, nodeVisit)}
  </section>`;
}

function renderNodeDiorama(system, run, nodeVisit) {
  if (!nodeVisit) return '';
  const node = system.nodes.find((candidate) => candidate.id === nodeVisit.nodeId);
  if (!node) return '';

  const ice = node.ice && !node.iceNeutralized ? iceCatalog[node.ice] : null;
  const event = node.event && !node.eventResolved ? nodeEvents[node.event] : null;
  const status = nodeVisit.phase === 'resolved' ? 'RESOLVED'
    : nodeVisit.phase === 'failed' ? 'HOSTILE'
      : node.state === 'compromised' ? 'COMPROMISED'
        : 'ACTIVE';
  const operationName = `${node.kind.toUpperCase()} ${node.id}`;
  const defenseLabel = ice?.label ?? 'Sin ICE';
  const iceIcon = ice ? assetPaths.defensePng[node.ice] ?? assetPaths.defenses[node.ice] : null;
  const nodeIcon = assetPaths.nodes[node.kind];
  const recommendedProgram = nodeVisit.recommendedProgram ? labelProgram(nodeVisit.recommendedProgram) : 'Scan';
  const hint = ice?.weakness ?? event?.hint ?? getDefaultNodeHint(node);
  const stamp = nodeVisit.stamp
    ? `<div class="node-diorama__stamp fx-glitch" data-text="${escapeHtml(nodeVisit.stamp)}">${escapeHtml(nodeVisit.stamp)}</div>`
    : '';

  return `<article class="node-diorama node-diorama--${escapeHtml(nodeVisit.phase ?? 'focus')}" aria-live="polite">
    <div class="node-diorama__grid" aria-hidden="true"></div>
    <div class="node-diorama__icon">
      <img src="${escapeHtml(nodeIcon)}" alt="" loading="lazy" />
    </div>
    <div class="node-diorama__main">
      <header class="node-diorama__header">
        <span>${escapeHtml(status)} · risk/${escapeHtml(String(node.risk ?? '?'))}</span>
        <strong>${escapeHtml(operationName)}</strong>
      </header>
      <p class="node-diorama__hint">
        <span>${escapeHtml(hint)}</span>
        <b>Recomendado: ${escapeHtml(recommendedProgram)}</b>
      </p>
    </div>
    <aside class="node-diorama__ice ${ice ? 'node-diorama__ice--active' : ''}">
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

function renderMapMessage(mapMessage) {
  if (!mapMessage?.text) return '';
  return `<div class="node-map__message" aria-live="polite" data-log-key="${escapeHtml(mapMessage.key ?? 'log')}">
    <span class="fx-glitch" data-text="${escapeHtml(mapMessage.text)}">${escapeHtml(mapMessage.text)}</span>
  </div>`;
}

function formatViewBox(view) {
  return `${view.x} ${view.y} ${view.width} ${view.height}`;
}

function isNodeReachable(system, run, nodeId) {
  if (nodeId === run.currentNodeId) return false;
  if (run.nodeStates[nodeId] === 'unknown') return false;
  return system.edges.some((edge) =>
    (edge.from === run.currentNodeId && edge.to === nodeId) || (edge.to === run.currentNodeId && edge.from === nodeId),
  );
}
