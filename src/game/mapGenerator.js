import { nodeEvents } from './nodeEvents.js';
import { generateHostAlias } from '../world/hostIdentity.js';

const iceByRisk = ['watcher', 'piercer', 'tracer', 'locker', 'crasher'];

export function generateSystem(params) {
  const { rng, seedId, company, archetype, valuation = defaultValuation() } = params;
  const [minNodes, maxNodes] = archetype.mapSize;
  const nodeCount = Math.max(6, rng.nextInt(minNodes + valuation.sizeModifier, maxNodes + valuation.sizeModifier));
  const effectiveSecurity = clamp(archetype.security + valuation.securityModifier, 1, 7);
  const coreIndex = nodeCount - 1;

  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    const kind = pickNodeKind(index, coreIndex, archetype, rng);
    const risk = clamp(effectiveSecurity + rng.nextInt(-1, 1), 1, 7);
    const hasIce = !['entry', 'exit'].includes(kind) && rng.nextFloat() < 0.18 + effectiveSecurity * 0.085;

    return {
      id: `n-${index}`,
      kind,
      event: pickNodeEvent(kind, rng),
      state: index === 0 ? 'visited' : index <= 2 ? 'scanned' : 'unknown',
      x: 12 + (index % 4) * 25 + rng.nextInt(-4, 4),
      y: 8 + Math.floor(index / 4) * 18 + rng.nextInt(-3, 3),
      risk,
      ice: hasIce ? rng.pick(iceByRisk) : undefined,
    };
  });

  const edges = [];
  for (let index = 0; index < nodeCount - 1; index += 1) {
    edges.push({ from: `n-${index}`, to: `n-${index + 1}` });
    if (index + 2 < nodeCount && rng.nextFloat() < 0.42) edges.push({ from: `n-${index}`, to: `n-${index + 2}` });
    if (index + 4 < nodeCount && rng.nextFloat() < 0.28) edges.push({ from: `n-${index}`, to: `n-${index + 4}` });
  }

  return {
    seedId,
    alias: generateHostAlias(company, archetype, rng),
    company,
    archetype,
    valuation,
    effectiveSecurity,
    nodes,
    edges: uniqueEdges(edges),
    entryNodeId: 'n-0',
    coreNodeId: `n-${coreIndex}`,
  };
}

function pickNodeKind(index, coreIndex, archetype, rng) {
  if (index === 0) return 'entry';
  if (index === coreIndex) return 'core';
  if (index === coreIndex - 1) return 'database';
  if (index % 7 === 0) return 'exit';

  return rng.weightedPick([
    { item: 'firewall', weight: archetype.security + 1 },
    { item: 'data', weight: archetype.dataBias + 2 },
    { item: 'camera', weight: 2 },
    { item: 'database', weight: Math.max(1, archetype.dataBias - 1) },
  ]);
}

function pickNodeEvent(kind, rng) {
  if (kind === 'entry') return undefined;
  if (kind === 'core') return nodeEvents.core.kind;
  if (kind === 'exit') return nodeEvents.exit.kind;
  if (kind === 'camera') return nodeEvents.camera.kind;
  if (kind === 'firewall') return rng.weightedPick([
    { item: nodeEvents.gate.kind, weight: 3 },
    { item: nodeEvents.trap.kind, weight: 2 },
  ]);
  if (kind === 'database') return nodeEvents.archive.kind;
  if (kind === 'data') return rng.weightedPick([
    { item: nodeEvents.archive.kind, weight: 4 },
    { item: nodeEvents.decoy.kind, weight: 1 },
  ]);

  return undefined;
}

function defaultValuation() {
  return { score: 30, tier: 'C', difficulty: 'baja', payoutMultiplier: 1.3, securityModifier: 0, sizeModifier: 0 };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function uniqueEdges(edges) {
  const seen = new Set();
  return edges.filter((edge) => {
    const key = [edge.from, edge.to].sort().join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
