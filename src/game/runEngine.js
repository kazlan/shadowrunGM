import { getConnectedNodeIds, getNodeState, isRunFinished, NODE_RUNTIME_STATE, RUN_STATUS } from './runState.js';

const MAX_LOG_LINES = 7;

export function reduceRun(system, run, action) {
  if (isRunFinished(run)) {
    return addLog(run, 'La run ya ha terminado. Reinicia para volver a entrar.');
  }

  switch (action.type) {
    case 'selectProgram':
      return selectProgram(run, action.program);
    case 'scan':
      return scan(system, run);
    case 'move':
      return move(system, run, action.nodeId);
    case 'runProgram':
      return runProgram(system, run, action.program);
    case 'extract':
      return extract(system, run);
    case 'jackOut':
      return jackOut(system, run);
    default:
      return addLog(run, 'Acción desconocida ignorada.');
  }
}

function selectProgram(run, program) {
  if (run.disabledPrograms.includes(program)) {
    return addLog(run, `${labelProgram(program)} está bloqueado por hielo hostil.`);
  }

  return {
    ...run,
    selectedProgram: program,
    log: appendLog(run.log, `${labelProgram(program)} preparado.`),
  };
}

function scan(system, run) {
  const connectedIds = getConnectedNodeIds(system, run.currentNodeId);
  const nextNodeStates = { ...run.nodeStates };
  let revealed = 0;

  for (const nodeId of connectedIds) {
    if (nextNodeStates[nodeId] === NODE_RUNTIME_STATE.UNKNOWN) {
      nextNodeStates[nodeId] = NODE_RUNTIME_STATE.SCANNED;
      revealed += 1;
    }
  }

  const nextRun = advanceTurn(
    {
      ...run,
      nodeStates: nextNodeStates,
      alert: clamp(run.alert + (revealed === 0 ? 1 : 0), 0, run.maxAlert),
      log: appendLog(run.log, revealed > 0 ? `Scan revela ${revealed} nodo(s) cercano(s).` : 'Scan sin nuevas rutas. La firma sube.'),
    },
    system,
  );

  return enforceFailure(nextRun);
}

function move(system, run, nodeId) {
  if (nodeId === run.currentNodeId) {
    return addLog(run, 'Ya estás en este nodo. Elige una ruta conectada o ejecuta un programa.');
  }

  const connectedIds = getConnectedNodeIds(system, run.currentNodeId);
  if (!connectedIds.includes(nodeId)) {
    return addLog(run, 'Ruta no conectada desde el nodo actual.');
  }

  const state = getNodeState(run, nodeId);
  if (state === NODE_RUNTIME_STATE.UNKNOWN) {
    return addLog(run, 'Nodo desconocido: ejecuta Scan antes de saltar.');
  }

  const node = system.nodes.find((candidate) => candidate.id === nodeId);
  const nextNodeStates = {
    ...run.nodeStates,
    [nodeId]: NODE_RUNTIME_STATE.VISITED,
  };
  const iceActive = node?.ice && !run.neutralizedIce.includes(nodeId);
  const status = iceActive ? RUN_STATUS.ENCOUNTER : RUN_STATUS.EXPLORING;
  const alertCost = state === NODE_RUNTIME_STATE.SCANNED ? 1 : 0;

  const nextRun = advanceTurn(
    {
      ...run,
      currentNodeId: nodeId,
      nodeStates: nextNodeStates,
      status,
      alert: clamp(run.alert + alertCost, 0, run.maxAlert),
      log: appendLog(run.log, iceActive ? `Salto a ${nodeLabel(node)}. Defensa ${node.ice} activa.` : `Salto a ${nodeLabel(node)}.`),
    },
    system,
  );

  return iceActive ? triggerIce(system, nextRun, node) : enforceFailure(nextRun);
}

function runProgram(system, run, program) {
  if (run.disabledPrograms.includes(program)) {
    return addLog(run, `${labelProgram(program)} sigue desactivado.`);
  }

  const preparedRun = { ...run, selectedProgram: program };

  if (program === 'scan') return scan(system, preparedRun);
  if (program === 'extract') return extract(system, preparedRun);
  if (program === 'shield') return shield(system, preparedRun);
  if (program === 'ghost') return ghost(system, preparedRun);
  if (program === 'spike') return spike(system, preparedRun);

  return addLog(run, 'Programa no reconocido.');
}

function shield(system, run) {
  return enforceFailure(
    advanceTurn(
      {
        ...run,
        shieldTurns: 2,
        log: appendLog(run.log, 'Shield activo durante dos pulsos.'),
      },
      system,
    ),
  );
}

function ghost(system, run) {
  if (run.alert <= 0 && run.trace <= 0) {
    return addLog(run, 'Ghost no encuentra firma activa que ocultar.');
  }

  return enforceFailure(
    advanceTurn(
      {
        ...run,
        alert: clamp(run.alert - 1, 0, run.maxAlert),
        trace: clamp(run.trace - 1, 0, run.maxTrace),
        integrity: clamp(run.integrity - 1, 0, run.maxIntegrity),
        log: appendLog(run.log, 'Ghost quema shell para reducir firma y difuminar la traza.'),
      },
      system,
    ),
  );
}

function spike(system, run) {
  const node = system.nodes.find((candidate) => candidate.id === run.currentNodeId);
  if (!node?.ice || run.neutralizedIce.includes(node.id)) {
    return enforceFailure(
      advanceTurn(
        {
          ...run,
          alert: clamp(run.alert + 1, 0, run.maxAlert),
          log: appendLog(run.log, 'Spike no encuentra defensa activa y deja ruido.'),
        },
        system,
      ),
    );
  }

  const success = run.alert + node.risk <= 12 || run.shieldTurns > 0;
  const nextRun = {
    ...run,
    status: RUN_STATUS.EXPLORING,
    neutralizedIce: success ? [...run.neutralizedIce, node.id] : run.neutralizedIce,
    alert: clamp(run.alert + (success ? 2 : 3), 0, run.maxAlert),
    integrity: clamp(run.integrity - (success ? 0 : 2), 0, run.maxIntegrity),
    log: appendLog(run.log, success ? `Spike neutraliza ${node.ice}.` : `Spike falla contra ${node.ice}. Retorno hostil.`),
  };

  return enforceFailure(advanceTurn(nextRun, system));
}

function extract(system, run) {
  const node = system.nodes.find((candidate) => candidate.id === run.currentNodeId);
  if (!node || !['database', 'core', 'data'].includes(node.kind)) {
    return addLog(run, 'No hay payload útil en este nodo.');
  }

  const nextNodeStates = {
    ...run.nodeStates,
    [node.id]: NODE_RUNTIME_STATE.COMPROMISED,
  };

  return enforceFailure(
    advanceTurn(
      {
        ...run,
        hasPayload: true,
        status: RUN_STATUS.OBJECTIVE_COMPLETE,
        nodeStates: nextNodeStates,
        alert: clamp(run.alert + (node.kind === 'core' ? 2 : 1), 0, run.maxAlert),
        log: appendLog(run.log, `Payload extraído desde ${nodeLabel(node)}. Busca salida.`),
      },
      system,
    ),
  );
}

function jackOut(system, run) {
  const node = system.nodes.find((candidate) => candidate.id === run.currentNodeId);
  const safeExit = run.currentNodeId === system.entryNodeId || node?.kind === 'exit';

  if (run.hasPayload && safeExit) {
    return {
      ...run,
      status: RUN_STATUS.ESCAPED,
      log: appendLog(run.log, 'Jack-out limpio. Payload asegurado.'),
    };
  }

  if (safeExit) {
    return {
      ...run,
      status: RUN_STATUS.ESCAPED,
      log: appendLog(run.log, 'Jack-out limpio sin payload. Run abortada.'),
    };
  }

  const damage = run.shieldTurns > 0 ? 1 : 3;
  const nextRun = {
    ...run,
    integrity: clamp(run.integrity - damage, 0, run.maxIntegrity),
    trace: clamp(run.trace + 1, 0, run.maxTrace),
    log: appendLog(run.log, 'Desconexión forzada lejos de salida. Dump shock.'),
  };

  return enforceFailure(nextRun.integrity <= 0 ? { ...nextRun, status: RUN_STATUS.DUMPED } : nextRun);
}

function triggerIce(system, run, node) {
  if (!node.ice || run.neutralizedIce.includes(node.id)) return enforceFailure(run);

  const shielded = run.shieldTurns > 0;
  const effects = {
    watcher: {
      alert: 2,
      trace: 0,
      integrity: 0,
      message: 'Centinela registra tu firma. Alerta subiendo.',
    },
    piercer: {
      alert: 1,
      trace: 0,
      integrity: shielded ? 1 : 2,
      message: 'Perforador golpea la integridad del avatar.',
    },
    tracer: {
      alert: 1,
      trace: shielded ? 1 : 2,
      integrity: 0,
      message: 'Rastreador engancha un vector hacia tu posición.',
    },
    locker: {
      alert: 1,
      trace: 1,
      integrity: 0,
      message: 'Ancla tensiona rutas y dificulta la salida.',
    },
    crasher: {
      alert: 1,
      trace: 0,
      integrity: shielded ? 0 : 1,
      message: 'Rompeprogramas intenta tumbar software cargado.',
    },
  }[node.ice];

  const disabledPrograms = node.ice === 'crasher' && !shielded ? unique([...run.disabledPrograms, run.selectedProgram]) : run.disabledPrograms;

  return enforceFailure({
    ...run,
    alert: clamp(run.alert + effects.alert, 0, run.maxAlert),
    trace: clamp(run.trace + effects.trace, 0, run.maxTrace),
    integrity: clamp(run.integrity - effects.integrity, 0, run.maxIntegrity),
    disabledPrograms,
    log: appendLog(run.log, effects.message),
  });
}

function advanceTurn(run, system) {
  const pressure = run.alert >= 7 ? 1 : 0;
  const shieldTurns = Math.max(0, run.shieldTurns - 1);
  const disabledPrograms = run.turn % 3 === 0 ? [] : run.disabledPrograms;
  const nextRun = {
    ...run,
    shieldTurns,
    disabledPrograms,
    trace: clamp(run.trace + pressure, 0, run.maxTrace),
    turn: run.turn + 1,
  };

  return enforceFailure(nextRun, system);
}

function enforceFailure(run) {
  if (run.integrity <= 0) {
    return { ...run, status: RUN_STATUS.DUMPED, log: appendLog(run.log, 'Integridad agotada. Dumped.') };
  }

  if (run.trace >= run.maxTrace) {
    return { ...run, status: RUN_STATUS.DUMPED, log: appendLog(run.log, 'Traza completa. El host te expulsa.') };
  }

  if (run.alert >= run.maxAlert) {
    return { ...run, status: RUN_STATUS.DUMPED, log: appendLog(run.log, 'Alerta máxima. Contramedidas cierran la run.') };
  }

  return run;
}

function addLog(run, message) {
  return {
    ...run,
    log: appendLog(run.log, message),
  };
}

function appendLog(log, message) {
  return [...log, message].slice(-MAX_LOG_LINES);
}

function unique(items) {
  return [...new Set(items)];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function labelProgram(program) {
  return program.charAt(0).toUpperCase() + program.slice(1);
}

function nodeLabel(node) {
  return `${node.kind.toUpperCase()} ${node.id}`;
}
