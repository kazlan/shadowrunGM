import { assetPaths } from '../assets/assetRegistry.js';
import { iceCatalog } from '../game/iceCatalog.js';

const nodeGlyph = {
  entry: 'IN',
  firewall: 'FW',
  data: 'DT',
  camera: 'CAM',
  database: 'DB',
  core: 'CPU',
  exit: 'OUT',
};

export function renderNodeMap(system, run) {
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
      const radius = node.kind === 'core' ? 5.6 : 4.3;
      const isReachable = isNodeReachable(system, run, node.id);
      const iceMarker = ice && node.state !== 'unknown'
        ? `<image href="${assetPaths.defenses[node.ice]}" x="${node.x + 3.8}" y="${node.y - 10.8}" width="7" height="7" class="ice-marker" />`
        : '';

      return `<g data-node-id="${node.id}" class="node node--${node.kind} node--${node.state} ${node.isCurrent ? 'node--current' : ''} ${isReachable ? 'node--reachable' : ''}" filter="url(#glow)">
        <circle cx="${node.x}" cy="${node.y}" r="${radius}" />
        <text x="${node.x}" y="${node.y + 1.1}">${node.state === 'unknown' ? '?' : nodeGlyph[node.kind]}</text>
        ${iceMarker}
      </g>`;
    })
    .join('');

  return `<section class="node-map" aria-label="Mapa de nodos del host">
    <svg viewBox="0 0 100 100" role="img">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.8" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      ${edges}
      ${nodes}
    </svg>
  </section>`;
}

function isNodeReachable(system, run, nodeId) {
  if (nodeId === run.currentNodeId) return false;
  if (run.nodeStates[nodeId] === 'unknown') return false;
  return system.edges.some((edge) =>
    (edge.from === run.currentNodeId && edge.to === nodeId) || (edge.to === run.currentNodeId && edge.from === nodeId),
  );
}
