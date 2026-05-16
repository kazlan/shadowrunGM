import { NODE_RUNTIME_STATE } from './runState.js';

export function projectSystemForRun(system, run) {
  return {
    ...system,
    nodes: system.nodes.map((node) => ({
      ...node,
      state: run.nodeStates[node.id] ?? NODE_RUNTIME_STATE.UNKNOWN,
      isCurrent: node.id === run.currentNodeId,
      iceNeutralized: run.neutralizedIce.includes(node.id),
      eventResolved: run.resolvedEvents?.includes(node.id) ?? false,
    })),
  };
}
