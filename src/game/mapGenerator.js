import { nodeEvents } from './nodeEvents.js';
import { generateHostAlias } from '../world/hostIdentity.js';

const iceByRisk = ['watcher', 'piercer', 'tracer', 'locker', 'crasher'];
const PAYDATA_MIN_DISTANCE = 3;
const CORE_MIN_DISTANCE = 4;
const templateRanges = {
  small: [9, 11],
  standard: [12, 15],
  secure: [16, 19],
};
const DATA_CORE_MIN_EXIT_DISTANCE = 3;
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
  return buildStarTopology(template, targetCount, archetype, rng);
}

function buildStarTopology(template, targetCount, archetype, rng) {
  const nodes = [];
  const edges = [];
  const usedAngles = [];
  const rotation = rng.nextInt(0, 359);
  const clockwise = rng.nextFloat() < 0.5 ? 1 : -1;
  const spread = template === 'secure' ? 42 : template === 'standard' ? 52 : 64;
  const dataBranchCount = template === 'secure' ? 2 : template === 'standard' || archetype.dataBias >= 4 ? 2 : 1;

  const addNode = (zone, kind, radius, angle, radiusJitter = 0) => {
    const point = polarPoint(radius + rng.nextInt(-radiusJitter, radiusJitter), angle + rng.nextInt(-5, 5));
    const index = nodes.length;
    nodes.push(node(zone, kind, point.x, point.y));
    usedAngles.push(angle);
    return index;
  };
  const connect = (from, to) => edges.push(edge(from, to));
  const angleAt = (offset) => normalizeAngle(rotation + clockwise * offset);

  const entryAngle = angleAt(180 + rng.nextInt(-20, 20));
  const exitAngle = angleAt(rng.nextInt(-28, 28));
  const coreAngle = angleAt(80 + rng.nextInt(-18, 18));
  const dataAngles = [angleAt(-spread + rng.nextInt(-12, 12)), angleAt(spread + rng.nextInt(-12, 12))];
  const decoyAngle = angleAt(130 + rng.nextInt(-18, 18));
  const monitorAngle = angleAt(-130 + rng.nextInt(-18, 18));

  const entry = addNode('entry', 'entry', 43, entryAngle, 2);
  const entryControl = addNode('entryControl', rng.pick(['camera', 'firewall']), 30, entryAngle, 3);
  const hub = addNode('hub', 'firewall', 13, angleAt(160), 2);
  const coreGate = addNode('coreGate', 'firewall', 8, coreAngle, 1);
  const core = addNode('core', 'core', 0, coreAngle, 0);
  const exitGate = addNode('exitGate', rng.pick(['camera', 'firewall']), 29, exitAngle, 3);
  const exitNode = addNode('exit', 'exit', 43, exitAngle, 2);
  const primaryDataGate = addNode('dataGateA', rng.pick(['firewall', 'camera']), 26, dataAngles[0], 3);
  const primaryData = addNode('dataA', 'database', 39, dataAngles[0], 2);

  connect(entry, entryControl);
  connect(entryControl, hub);
  connect(hub, coreGate);
  connect(coreGate, core);
  connect(hub, exitGate);
  connect(exitGate, exitNode);
  connect(hub, primaryDataGate);
  connect(primaryDataGate, primaryData);

  if (targetCount >= 10) {
    const decoyGate = addNode('decoyGate', rng.pick(['camera', 'data']), 28, decoyAngle, 3);
    connect(entryControl, decoyGate);
    if (targetCount >= 11) {
      const decoy = addNode('decoy', 'data', 39, decoyAngle, 2);
      connect(decoyGate, decoy);
    }
  }

  if (targetCount >= 12 && dataBranchCount > 1) {
    const secondaryDataGate = addNode('dataGateB', rng.pick(['firewall', 'camera']), 25, dataAngles[1], 3);
    const secondaryDataKind = archetype.dataBias >= 4 ? 'database' : rng.pick(['database', 'data']);
    const secondaryData = addNode('dataB', secondaryDataKind, 38, dataAngles[1], 2);
    connect(hub, secondaryDataGate);
    connect(secondaryDataGate, secondaryData);
    if (rng.nextFloat() < 0.7) connect(primaryDataGate, secondaryDataGate);
  }

  if (targetCount >= 14) {
    const monitor = addNode('monitor', 'camera', 32, monitorAngle, 3);
    connect(entryControl, monitor);
    connect(monitor, hub);
  }

  if (targetCount >= 15) {
    const relayAngle = leastCrowdedAngle(usedAngles, rng);
    const relay = addNode('relay', rng.pick(['firewall', 'camera']), 22, relayAngle, 3);
    connect(hub, relay);
    connect(relay, coreGate);
  }

  if (targetCount >= 16) {
    const snareAngle = angleAt(35 + rng.nextInt(-15, 15));
    const snare = addNode('snare', 'firewall', 33, snareAngle, 3);
    connect(exitGate, snare);
    connect(snare, hub);
  }

  if (targetCount >= 17) {
    const vaultAngle = angleAt(-92 + rng.nextInt(-16, 16));
    const vaultGate = addNode('vaultGate', 'firewall', 24, vaultAngle, 3);
    const vault = addNode('vaultMirror', 'database', 36, vaultAngle, 2);
    connect(hub, vaultGate);
    connect(vaultGate, vault);
    connect(vaultGate, coreGate);
  }

  if (targetCount >= 19) {
    const outerExitAngle = angleAt(115 + rng.nextInt(-18, 18));
    const outerExit = addNode('outerExit', 'exit', 43, outerExitAngle, 2);
    connect(entryControl, outerExit);
  }

  addStarCrossLinks(edges, nodes, template, rng);

  return finalizeNodeIds(nodes, edges);
}

function addStarCrossLinks(edges, nodes, template, rng) {
  const linkBudget = { small: 1, standard: 2, secure: 3 }[template] ?? 1;
  const candidates = [
    ['dataGateA', 'exitGate'],
    ['dataGateB', 'monitor'],
    ['decoyGate', 'dataGateA'],
    ['monitor', 'coreGate'],
    ['snare', 'dataGateB'],
    ['relay', 'vaultGate'],
  ];

  let added = 0;
  for (const [leftZone, rightZone] of rng.shuffle(candidates)) {
    if (added >= linkBudget) break;
    const left = nodes.findIndex((candidate) => candidate.zone === leftZone);
    const right = nodes.findIndex((candidate) => candidate.zone === rightZone);
    if (left === -1 || right === -1) continue;
    if (rng.nextFloat() > 0.62) continue;
    edges.push(edge(left, right));
    added += 1;
  }
}

function polarPoint(radius, angleDegrees) {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: 50 + Math.cos(radians) * radius,
    y: 50 + Math.sin(radians) * radius,
  };
}

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function leastCrowdedAngle(angles, rng) {
  const candidates = [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => angle + rng.nextInt(-12, 12));
  return candidates.sort((left, right) => nearestAngleDistance(right, angles) - nearestAngleDistance(left, angles))[0];
}

function nearestAngleDistance(angle, angles) {
  return Math.min(...angles.map((candidate) => angleDistance(angle, candidate)));
}

function angleDistance(left, right) {
  const diff = Math.abs(normalizeAngle(left) - normalizeAngle(right));
  return Math.min(diff, 360 - diff);
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
  if (['core', 'coreGate', 'hub'].includes(zone)) return 1;
  if (zone.startsWith('control') || zone.endsWith('Gate') || zone.endsWith('Control')) return 1;
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
    entryControl: 0.22,
    exitGate: 0.18,
    coreGate: 0.38,
    hub: 0.3,
    dataGateA: 0.26,
    dataGateB: 0.26,
    vaultGate: 0.28,
    relay: 0.24,
    snare: 0.3,
    dataA: 0.18,
    dataB: 0.18,
    vaultMirror: 0.2,
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
  const exits = nodes.filter((nodeData) => nodeData.kind === 'exit' && distances[nodeData.id] !== undefined);
  if (exits.length === 0) {
    throw new Error('Generated host needs a reachable exit');
  }
  for (const exitNode of exits) {
    const exitDistances = calculateDistances(edges, exitNode.id);
    if (exitDistances[coreNodeId] < DATA_CORE_MIN_EXIT_DISTANCE) {
      throw new Error('Generated host core is too close to an exit');
    }
  }
  for (const nodeData of nodes) {
    if (nodeData.event === nodeEvents.archive.kind && distances[nodeData.id] < PAYDATA_MIN_DISTANCE) {
      throw new Error('Generated host placed paydata too close to entry');
    }
    if (nodeData.event === nodeEvents.archive.kind) {
      for (const exitNode of exits) {
        const exitDistances = calculateDistances(edges, exitNode.id);
        if (exitDistances[nodeData.id] < DATA_CORE_MIN_EXIT_DISTANCE) {
          throw new Error('Generated host placed paydata too close to exit');
        }
      }
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
