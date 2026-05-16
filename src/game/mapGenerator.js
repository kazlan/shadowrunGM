import { nodeEvents } from './nodeEvents.js';
import { generateHostAlias } from '../world/hostIdentity.js';

const iceByRisk = ['watcher', 'piercer', 'tracer', 'locker', 'crasher'];
const PAYDATA_MIN_DISTANCE = 3;
const CORE_MIN_DISTANCE = 4;
const templateRanges = {
  small: [7, 9],
  standard: [10, 13],
  secure: [14, 17],
};
const minimumIceByTemplate = {
  small: 1,
  standard: 2,
  secure: 4,
};

export function generateSystem(params) {
  const { rng, seedId, company, archetype, valuation = defaultValuation() } = params;
  const effectiveSecurity = clamp(archetype.security + valuation.securityModifier, 1, 7);
  const template = pickTopologyTemplate(archetype, valuation, effectiveSecurity);
  const targetCount = pickTemplateNodeCount(template, valuation, rng);
  const topology = buildTopology(template, targetCount, archetype, rng);
  const entryNodeId = 'n-0';
  const coreNodeId = topology.nodes.find((node) => node.kind === 'core')?.id ?? `n-${topology.nodes.length - 1}`;
  const distances = calculateDistances(topology.edges, entryNodeId);
  const nodes = assignNodeSystems(topology.nodes, distances, archetype, effectiveSecurity, template, rng);
  const edges = uniqueEdges(topology.edges);

  validateHostTopology(nodes, edges, entryNodeId, coreNodeId);

  return {
    seedId,
    alias: generateHostAlias(company, archetype, rng),
    company,
    archetype,
    valuation,
    effectiveSecurity,
    nodes,
    edges,
    entryNodeId,
    coreNodeId,
  };
}

function pickTopologyTemplate(archetype, valuation, effectiveSecurity) {
  if (['AAA', 'AA'].includes(valuation.tier) || effectiveSecurity >= 6) return 'secure';
  if (valuation.tier === 'A' || effectiveSecurity >= 4 || archetype.dataBias >= 4) return 'standard';
  return 'small';
}

function pickTemplateNodeCount(template, valuation, rng) {
  const [min, max] = templateRanges[template];
  const sizePush = valuation.sizeModifier > 1 ? 1 : valuation.sizeModifier < 0 ? -1 : 0;
  return clamp(rng.nextInt(min, max) + sizePush, min, max);
}

function buildTopology(template, targetCount, archetype, rng) {
  const builders = {
    small: buildSmallTopology,
    standard: buildStandardTopology,
    secure: buildSecureTopology,
  };
  return builders[template](targetCount, archetype, rng);
}

function buildSmallTopology(targetCount, archetype, rng) {
  const nodes = [
    node('entry', 'entry', 12, 50),
    node('foyer', rng.pick(['camera', 'data']), 30, 38),
    node('control', 'firewall', 48, 44),
    node('data', 'database', 66, 38),
    node('bypass', rng.pick(['camera', 'firewall']), 48, 66),
    node('core', 'core', 84, 44),
    node('exit', 'exit', 78, 68),
  ];
  const edges = [
    edge(0, 1),
    edge(1, 2),
    edge(2, 3),
    edge(3, 5),
    edge(3, 6),
    edge(1, 4),
    edge(4, 3),
  ];

  if (targetCount >= 8) {
    nodes.push(node('sideData', archetype.dataBias >= 3 ? 'database' : 'data', 63, 18));
    edges.push(edge(2, 7), edge(7, 5));
  }
  if (targetCount >= 9) {
    nodes.push(node('decoy', 'data', 31, 72));
    edges.push(edge(1, 8), edge(8, 4));
  }

  return finalizeNodeIds(nodes, edges);
}

function buildStandardTopology(targetCount, archetype, rng) {
  const nodes = [
    node('entry', 'entry', 10, 50),
    node('foyer', 'camera', 24, 32),
    node('decoy', 'data', 24, 68),
    node('controlA', 'firewall', 40, 32),
    node('watch', rng.pick(['camera', 'firewall']), 40, 68),
    node('dataA', 'database', 58, 28),
    node('controlB', 'firewall', 58, 70),
    node('dataB', archetype.dataBias >= 4 ? 'database' : 'data', 74, 66),
    node('core', 'core', 88, 46),
    node('exit', 'exit', 88, 76),
  ];
  const edges = [
    edge(0, 1),
    edge(1, 3),
    edge(3, 5),
    edge(5, 8),
    edge(5, 9),
    edge(0, 2),
    edge(2, 4),
    edge(4, 6),
    edge(6, 7),
    edge(7, 8),
    edge(7, 9),
    edge(3, 6),
  ];

  if (targetCount >= 11) {
    nodes.push(node('monitor', 'camera', 58, 50));
    edges.push(edge(3, 10), edge(10, 6));
  }
  if (targetCount >= 12) {
    nodes.push(node('sideData', 'database', 72, 24));
    edges.push(edge(5, 11), edge(11, 8));
  }
  if (targetCount >= 13) {
    nodes.push(node('outerExit', 'exit', 44, 86));
    edges.push(edge(4, 12), edge(12, 9));
  }

  return finalizeNodeIds(nodes, edges);
}

function buildSecureTopology(targetCount, archetype, rng) {
  const nodes = [
    node('entry', 'entry', 8, 50),
    node('foyerA', 'camera', 20, 28),
    node('foyerB', 'data', 20, 72),
    node('controlA', 'firewall', 36, 26),
    node('watch', rng.pick(['camera', 'firewall']), 36, 74),
    node('controlB', 'firewall', 52, 72),
    node('hub', 'firewall', 52, 44),
    node('dataA', 'database', 68, 28),
    node('controlC', 'firewall', 68, 58),
    node('dataB', archetype.dataBias >= 4 ? 'database' : 'data', 78, 74),
    node('coreGate', 'firewall', 84, 44),
    node('core', 'core', 94, 44),
    node('exit', 'exit', 88, 84),
    node('monitor', 'camera', 52, 12),
  ];
  const edges = [
    edge(0, 1),
    edge(0, 2),
    edge(1, 3),
    edge(2, 4),
    edge(3, 6),
    edge(4, 5),
    edge(5, 6),
    edge(6, 7),
    edge(6, 8),
    edge(8, 9),
    edge(7, 10),
    edge(9, 10),
    edge(10, 11),
    edge(7, 12),
    edge(9, 12),
    edge(3, 13),
    edge(13, 8),
  ];

  if (targetCount >= 15) {
    nodes.push(node('vaultMirror', 'database', 84, 20));
    edges.push(edge(7, 14), edge(14, 10));
  }
  if (targetCount >= 16) {
    nodes.push(node('snare', 'firewall', 64, 88));
    edges.push(edge(5, 15), edge(15, 9), edge(15, 12));
  }
  if (targetCount >= 17) {
    nodes.push(node('noise', 'data', 36, 92));
    edges.push(edge(2, 16), edge(16, 5));
  }

  return finalizeNodeIds(nodes, edges);
}

function node(zone, kind, x, y) {
  return { zone, kind, x, y };
}

function edge(from, to) {
  return { from: `n-${from}`, to: `n-${to}` };
}

function finalizeNodeIds(nodes, edges) {
  return {
    nodes: nodes.map((candidate, index) => ({ ...candidate, id: `n-${index}` })),
    edges,
  };
}

function assignNodeSystems(nodes, distances, archetype, effectiveSecurity, template, rng) {
  const prepared = nodes.map((candidate) => {
    const distance = distances[candidate.id] ?? 99;
    const kind = sanitizeEarlyDataKind(candidate.kind, distance);
    const risk = clamp(effectiveSecurity + rng.nextInt(-1, 1) + riskBonus(candidate.zone), 1, 7);
    return {
      id: candidate.id,
      kind,
      event: pickNodeEvent(kind, distance, archetype, rng),
      state: candidate.id === 'n-0' ? 'visited' : distance <= 1 ? 'scanned' : 'unknown',
      x: clamp(candidate.x + rng.nextInt(-3, 3), 6, 94),
      y: clamp(candidate.y + rng.nextInt(-3, 3), 8, 92),
      risk,
      zone: candidate.zone,
    };
  });

  return assignIce(prepared, template, effectiveSecurity, rng).map(({ zone, ...nodeData }) => nodeData);
}

function sanitizeEarlyDataKind(kind, distance) {
  if (['data', 'database'].includes(kind) && distance < PAYDATA_MIN_DISTANCE) return 'data';
  return kind;
}

function riskBonus(zone) {
  if (['core', 'coreGate'].includes(zone)) return 1;
  if (zone.startsWith('control')) return 1;
  return 0;
}

function pickNodeEvent(kind, distance, archetype, rng) {
  if (kind === 'entry') return undefined;
  if (kind === 'core') return nodeEvents.core.kind;
  if (kind === 'exit') return nodeEvents.exit.kind;
  if (kind === 'camera') return nodeEvents.camera.kind;
  if (kind === 'firewall') return rng.weightedPick([
    { item: nodeEvents.gate.kind, weight: 3 },
    { item: nodeEvents.trap.kind, weight: 2 },
  ]);
  if (kind === 'database') return distance >= PAYDATA_MIN_DISTANCE ? nodeEvents.archive.kind : nodeEvents.decoy.kind;
  if (kind === 'data') {
    if (distance < PAYDATA_MIN_DISTANCE) return nodeEvents.decoy.kind;
    return rng.weightedPick([
      { item: nodeEvents.archive.kind, weight: archetype.dataBias + 1 },
      { item: nodeEvents.decoy.kind, weight: 3 },
    ]);
  }

  return undefined;
}

function assignIce(nodes, template, effectiveSecurity, rng) {
  const candidates = rng.shuffle(nodes.filter((nodeData) => !['entry', 'exit'].includes(nodeData.kind)));
  for (const nodeData of candidates) {
    const chance = iceChance(nodeData, effectiveSecurity);
    if (rng.nextFloat() < chance) nodeData.ice = pickIce(nodeData.risk, rng);
  }

  const minimumIce = minimumIceByTemplate[template];
  const priority = candidates.sort((left, right) => defensePriority(right) - defensePriority(left));
  for (const nodeData of priority) {
    if (nodes.filter((candidate) => candidate.ice).length >= minimumIce) break;
    if (!nodeData.ice) nodeData.ice = pickIce(nodeData.risk, rng);
  }

  return nodes;
}

function iceChance(nodeData, effectiveSecurity) {
  const zoneChance = {
    core: 0.42,
    coreGate: 0.38,
    controlA: 0.26,
    controlB: 0.26,
    controlC: 0.28,
    hub: 0.24,
    dataA: 0.16,
    dataB: 0.16,
    sideData: 0.14,
  }[nodeData.zone] ?? 0.08;
  return clamp(0.06 + effectiveSecurity * 0.055 + zoneChance, 0, 0.82);
}

function defensePriority(nodeData) {
  if (nodeData.kind === 'core') return 5;
  if (nodeData.kind === 'firewall') return 4;
  if (nodeData.kind === 'database') return 3;
  if (nodeData.kind === 'camera') return 2;
  return 1;
}

function pickIce(risk, rng) {
  const pool = iceByRisk.slice(0, clamp(risk, 1, iceByRisk.length));
  return rng.pick(pool);
}

function calculateDistances(edges, entryNodeId) {
  const distances = { [entryNodeId]: 0 };
  const queue = [entryNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighbor of connectedIds(edges, current)) {
      if (distances[neighbor] !== undefined) continue;
      distances[neighbor] = distances[current] + 1;
      queue.push(neighbor);
    }
  }
  return distances;
}

function validateHostTopology(nodes, edges, entryNodeId, coreNodeId) {
  const distances = calculateDistances(edges, entryNodeId);
  if (distances[coreNodeId] === undefined || distances[coreNodeId] < CORE_MIN_DISTANCE) {
    throw new Error('Generated host core is too close or unreachable');
  }
  if (!nodes.some((nodeData) => nodeData.kind === 'exit' && distances[nodeData.id] !== undefined)) {
    throw new Error('Generated host needs a reachable exit');
  }
  for (const nodeData of nodes) {
    if (nodeData.event === nodeEvents.archive.kind && distances[nodeData.id] < PAYDATA_MIN_DISTANCE) {
      throw new Error('Generated host placed paydata too close to entry');
    }
  }
}

function connectedIds(edges, nodeId) {
  return edges
    .filter((edgeData) => edgeData.from === nodeId || edgeData.to === nodeId)
    .map((edgeData) => (edgeData.from === nodeId ? edgeData.to : edgeData.from));
}

function defaultValuation() {
  return { score: 30, tier: 'C', difficulty: 'baja', payoutMultiplier: 1.3, securityModifier: 0, sizeModifier: 0 };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function uniqueEdges(edges) {
  const seen = new Set();
  return edges.filter((edgeData) => {
    const key = [edgeData.from, edgeData.to].sort().join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
