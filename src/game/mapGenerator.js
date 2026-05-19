import { nodeEvents } from './nodeEvents.js';
import { generateHostAlias } from '../world/hostIdentity.js';

const iceByRisk = ['watcher', 'piercer', 'tracer', 'locker', 'crasher'];
const PAYDATA_MIN_DISTANCE = 3;
const CORE_MIN_DISTANCE = 4;
const templateRanges = {
  tutorial: [8, 8],
  small: [9, 11],
  standard: [12, 15],
  secure: [16, 19],
};
const DATA_CORE_MIN_EXIT_DISTANCE = 3;
const LAYOUT_ATTEMPTS = 64;
const MIN_NODE_CENTER_DISTANCE = 13;
const MIN_CORE_CENTER_DISTANCE = 16;
const LAYOUT_CANVAS_CENTER = 50;
const LAYOUT_CANVAS_MIN = 6;
const LAYOUT_CANVAS_MAX = 94;
const layoutTargetSpan = {
  tutorial: { x: 88, y: 82 },
  small: { x: 74, y: 76 },
  standard: { x: 82, y: 82 },
  secure: { x: 86, y: 86 },
};
const SEGMENT_EPSILON = 0.001;
const minimumIceByTemplate = {
  tutorial: 0,
  small: 1,
  standard: 2,
  secure: 4,
};

export function generateSystem(params) {
  const { rng, seedId, company, archetype, valuation = defaultValuation(), tutorial = false } = params;
  const useTutorial = tutorial === true;
  const effectiveSecurity = useTutorial ? 1 : clamp(archetype.security + valuation.securityModifier, 1, 7);
  const template = useTutorial ? 'tutorial' : pickTopologyTemplate(archetype, valuation, effectiveSecurity);
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
    template,
    tutorial: useTutorial,
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
  if (template === 'tutorial') return buildTutorialTopology();
  return buildStarTopology(template, targetCount, archetype, rng);
}

function buildTutorialTopology() {
  const nodes = [
    node('entry', 'entry', 6, 88, { risk: 1 }),
    node('tutorialCamera', 'camera', 20, 76, { event: nodeEvents.camera.kind, risk: 1 }),
    node('tutorialHub', 'firewall', 38, 62, { event: undefined, risk: 1 }),
    node('tutorialArchive', 'database', 20, 25, { event: nodeEvents.archive.kind, risk: 1 }),
    node('tutorialGate', 'firewall', 58, 62, { event: nodeEvents.gate.kind, risk: 1 }),
    node('tutorialCore', 'core', 82, 36, { event: nodeEvents.core.kind, risk: 2, ice: 'watcher' }),
    node('tutorialExitGate', 'firewall', 70, 82, { event: undefined, risk: 1 }),
    node('tutorialExit', 'exit', 94, 94, { event: nodeEvents.exit.kind, risk: 1 }),
  ];
  const edges = [
    edge(0, 1),
    edge(1, 2),
    edge(2, 3),
    edge(2, 4),
    edge(4, 5),
    edge(4, 6),
    edge(6, 7),
  ];

  return finalizeNodeIds(nodes, edges);
}

function buildStarTopology(template, targetCount, archetype, rng) {
  let lastTopology = null;
  for (let attempt = 0; attempt < LAYOUT_ATTEMPTS; attempt += 1) {
    const topology = buildStarTopologyAttempt(template, targetCount, archetype, rng);
    lastTopology = topology;
    if (isReadableLayout(topology.nodes, topology.edges)) return finalizeNodeIds(topology.nodes, topology.edges);
  }

  const reason = lastTopology ? ` overlap=${hasNodeOverlap(lastTopology.nodes)} cross=${hasCrossingEdges(lastTopology.edges, lastTopology.nodes)}` : '';
  throw new Error(`Unable to generate a readable host map layout${reason}`);
}

function buildStarTopologyAttempt(template, targetCount, archetype, rng) {
  const nodes = [];
  const edges = [];
  const mirrorX = rng.nextFloat() < 0.5;
  const mirrorY = rng.nextFloat() < 0.5;
  const drift = rng.nextFloat() < 0.5 ? -1 : 1;
  const place = (x, y) => {
    const placedX = mirrorX ? 100 - x : x;
    const placedY = mirrorY ? 100 - y : y;
    return {
      x: clamp(placedX, 4, 96),
      y: clamp(placedY + drift * Math.sin((x + y) / 19) * 1.8, 4, 96),
    };
  };

  const addNode = (zone, kind, x, y) => {
    const point = place(x, y);
    const index = nodes.length;
    nodes.push(node(zone, kind, point.x, point.y));
    return index;
  };
  const connect = (from, to) => edges.push(edge(from, to));

  const entry = addNode('entry', 'entry', 8, 84);
  const entryControl = addNode('entryControl', rng.pick(['camera', 'firewall']), 24, 75);
  const hub = addNode('hub', 'firewall', 38, 63);
  const coreGate = addNode('coreGate', 'firewall', 49, 56);
  const core = addNode('core', 'core', 53, 39);
  const exitGate = addNode('exitGate', rng.pick(['camera', 'firewall']), 53, 73);
  const exitNode = addNode('exit', 'exit', 50, 91);
  const primaryDataGate = addNode('dataGateA', rng.pick(['firewall', 'camera']), 34, 34);
  const primaryData = addNode('dataA', 'database', 52, 18);

  connect(entry, entryControl);
  connect(entryControl, hub);
  connect(hub, coreGate);
  connect(coreGate, core);
  connect(hub, exitGate);
  connect(exitGate, exitNode);
  connect(hub, primaryDataGate);
  connect(primaryDataGate, primaryData);

  if (targetCount >= 10) {
    const decoyGate = addNode('decoyGate', rng.pick(['camera', 'data']), 20, 53);
    connect(entryControl, decoyGate);
    if (targetCount >= 11) {
      const decoy = addNode('decoy', 'data', 6, 39);
      connect(decoyGate, decoy);
    }
  }

  if (targetCount >= 12 && (template === 'secure' || template === 'standard' || archetype.dataBias >= 4)) {
    const secondaryDataGate = addNode('dataGateB', rng.pick(['firewall', 'camera']), 69, 34);
    const secondaryDataKind = archetype.dataBias >= 4 ? 'database' : rng.pick(['database', 'data']);
    const secondaryData = addNode('dataB', secondaryDataKind, 84, 25);
    connect(coreGate, secondaryDataGate);
    connect(secondaryDataGate, secondaryData);
    if (rng.nextFloat() < 0.7) safeConnect(edges, nodes, primaryData, secondaryDataGate);
  }

  if (targetCount >= 14) {
    const monitor = addNode('monitor', 'camera', 73, 56);
    connect(coreGate, monitor);
    safeConnect(edges, nodes, monitor, exitGate);
  }

  if (targetCount >= 15) {
    const relay = addNode('relay', rng.pick(['firewall', 'camera']), 18, 24);
    connect(primaryDataGate, relay);
    safeConnect(edges, nodes, relay, decoyGateIndex(nodes));
  }

  if (targetCount >= 16) {
    const snare = addNode('snare', 'firewall', 79, 75);
    connect(exitGate, snare);
    safeConnect(edges, nodes, snare, monitorIndex(nodes));
  }

  if (targetCount >= 17) {
    const vaultGate = addNode('vaultGate', 'firewall', 34, 94);
    const vault = addNode('vaultMirror', 'database', 18, 96);
    connect(exitGate, vaultGate);
    connect(vaultGate, vault);
    safeConnect(edges, nodes, vaultGate, entryControl);
  }

  if (targetCount >= 19) {
    const outerExit = addNode('outerExit', 'exit', 93, 91);
    safeConnect(edges, nodes, snareIndex(nodes), outerExit);
  }

  addStarCrossLinks(edges, nodes, template, rng);
  spreadLayout(nodes, template);

  return { nodes, edges };
}

function decoyGateIndex(nodes) {
  return nodes.findIndex((candidate) => candidate.zone === 'decoyGate');
}

function monitorIndex(nodes) {
  return nodes.findIndex((candidate) => candidate.zone === 'monitor');
}

function snareIndex(nodes) {
  return nodes.findIndex((candidate) => candidate.zone === 'snare');
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
    if (!safeConnect(edges, nodes, left, right)) continue;
    added += 1;
  }
}

function safeConnect(edges, nodes, from, to) {
  const candidate = edge(from, to);
  if (!isReadableEdge(candidate, edges, nodes)) return false;
  edges.push(candidate);
  return true;
}

function spreadLayout(nodes, template) {
  const target = layoutTargetSpan[template] ?? layoutTargetSpan.standard;
  spreadLayoutAxis(nodes, 'x', target.x);
  spreadLayoutAxis(nodes, 'y', target.y);
}

function spreadLayoutAxis(nodes, axis, targetSpan) {
  if (nodes.length < 2) return;
  const values = nodes.map((candidate) => candidate[axis]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span <= 0 || span >= targetSpan) {
    recenterLayoutAxis(nodes, axis);
    return;
  }

  const center = (min + max) / 2;
  const safeSpan = Math.min(targetSpan, LAYOUT_CANVAS_MAX - LAYOUT_CANVAS_MIN);
  const scale = safeSpan / span;
  for (const candidate of nodes) {
    candidate[axis] = clamp(LAYOUT_CANVAS_CENTER + (candidate[axis] - center) * scale, LAYOUT_CANVAS_MIN, LAYOUT_CANVAS_MAX);
  }
}

function recenterLayoutAxis(nodes, axis) {
  const values = nodes.map((candidate) => candidate[axis]);
  const center = (Math.min(...values) + Math.max(...values)) / 2;
  const offset = LAYOUT_CANVAS_CENTER - center;
  for (const candidate of nodes) {
    candidate[axis] = clamp(candidate[axis] + offset, LAYOUT_CANVAS_MIN, LAYOUT_CANVAS_MAX);
  }
}

function isReadableLayout(nodes, edges) {
  return !hasNodeOverlap(nodes) && edges.every((edgeData, index) => isReadableEdge(edgeData, edges.slice(0, index), nodes));
}

function hasNodeOverlap(nodes) {
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const left = nodes[leftIndex];
      const right = nodes[rightIndex];
      const minimumDistance = left.kind === 'core' || right.kind === 'core' ? MIN_CORE_CENTER_DISTANCE : MIN_NODE_CENTER_DISTANCE;
      if (Math.hypot(left.x - right.x, left.y - right.y) < minimumDistance) return true;
    }
  }
  return false;
}

function isReadableEdge(candidate, edges, nodes) {
  return !edges.some((edgeData) => edgesCross(candidate, edgeData, nodes));
}

function edgesCross(leftEdge, rightEdge, nodes) {
  if (sharesEndpoint(leftEdge, rightEdge)) return false;
  const leftFrom = getLayoutNode(nodes, leftEdge.from);
  const leftTo = getLayoutNode(nodes, leftEdge.to);
  const rightFrom = getLayoutNode(nodes, rightEdge.from);
  const rightTo = getLayoutNode(nodes, rightEdge.to);
  if (!leftFrom || !leftTo || !rightFrom || !rightTo) return false;
  return segmentsIntersect(leftFrom, leftTo, rightFrom, rightTo);
}

function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);

  if (Math.abs(abC) < SEGMENT_EPSILON && onSegment(a, c, b)) return true;
  if (Math.abs(abD) < SEGMENT_EPSILON && onSegment(a, d, b)) return true;
  if (Math.abs(cdA) < SEGMENT_EPSILON && onSegment(c, a, d)) return true;
  if (Math.abs(cdB) < SEGMENT_EPSILON && onSegment(c, b, d)) return true;

  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) + SEGMENT_EPSILON
    && b.x + SEGMENT_EPSILON >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y) + SEGMENT_EPSILON
    && b.y + SEGMENT_EPSILON >= Math.min(a.y, c.y);
}

function sharesEndpoint(leftEdge, rightEdge) {
  return leftEdge.from === rightEdge.from
    || leftEdge.from === rightEdge.to
    || leftEdge.to === rightEdge.from
    || leftEdge.to === rightEdge.to;
}

function getLayoutNode(nodes, nodeId) {
  return nodes[Number.parseInt(String(nodeId).replace('n-', ''), 10)] ?? null;
}

function node(zone, kind, x, y, extras = {}) {
  return { zone, kind, x, y, ...extras };
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
    const risk = candidate.risk ?? clamp(effectiveSecurity + rng.nextInt(-1, 1) + riskBonus(candidate.zone), 1, 7);
    const event = Object.hasOwn(candidate, 'event') ? candidate.event : pickNodeEvent(kind, distance, archetype, rng);
    return {
      id: candidate.id,
      kind,
      event,
      state: candidate.id === 'n-0' ? 'visited' : distance <= 1 ? 'scanned' : 'unknown',
      x: clamp(candidate.x, 4, 96),
      y: clamp(candidate.y, 4, 96),
      risk,
      zone: candidate.zone,
      ...(candidate.ice ? { ice: candidate.ice } : {}),
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
  if (template === 'tutorial') return nodes;
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
  if (hasNodeOverlap(nodes)) throw new Error('Generated host map nodes overlap');
  if (hasCrossingEdges(edges, nodes)) throw new Error('Generated host map routes cross');
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

function hasCrossingEdges(edges, nodes) {
  for (let leftIndex = 0; leftIndex < edges.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < edges.length; rightIndex += 1) {
      if (edgesCross(edges[leftIndex], edges[rightIndex], nodes)) return true;
    }
  }
  return false;
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
