export const RUN_STATUS = {
  IDLE: 'idle',
  ENTERING: 'entering',
  EXPLORING: 'exploring',
  ENCOUNTER: 'encounter',
  OBJECTIVE_COMPLETE: 'objectiveComplete',
  ESCAPED: 'escaped',
  DUMPED: 'dumped',
};

export const NODE_RUNTIME_STATE = {
  UNKNOWN: 'unknown',
  SCANNED: 'scanned',
  VISITED: 'visited',
  COMPROMISED: 'compromised',
};

export function createInitialRunState(system) {
  const nodeStates = Object.fromEntries(system.nodes.map((node) => [node.id, NODE_RUNTIME_STATE.UNKNOWN]));
  nodeStates[system.entryNodeId] = NODE_RUNTIME_STATE.VISITED;

  for (const neighborId of getConnectedNodeIds(system, system.entryNodeId)) {
    nodeStates[neighborId] = NODE_RUNTIME_STATE.SCANNED;
  }

  return {
    status: RUN_STATUS.EXPLORING,
    currentNodeId: system.entryNodeId,
    nodeStates,
    disabledPrograms: [],
    neutralizedIce: [],
    shieldTurns: 0,
    alert: 0,
    trace: 0,
    integrity: 10,
    maxAlert: 10,
    maxTrace: 8,
    maxIntegrity: 10,
    hasPayload: false,
    selectedProgram: 'scan',
    turn: 1,
    log: [
      'Jack-in completado.',
      'Nodo de entrada asegurado.',
      'Rutas adyacentes detectadas.',
    ],
  };
}

export function getConnectedNodeIds(system, nodeId) {
  return system.edges
    .filter((edge) => edge.from === nodeId || edge.to === nodeId)
    .map((edge) => (edge.from === nodeId ? edge.to : edge.from));
}

export function getNodeState(run, nodeId) {
  return run.nodeStates[nodeId] ?? NODE_RUNTIME_STATE.UNKNOWN;
}

export function isRunFinished(run) {
  return run.status === RUN_STATUS.ESCAPED || run.status === RUN_STATUS.DUMPED;
}
