import { getConnectedNodeIds, getNodeState, isRunFinished, NODE_RUNTIME_STATE, RUN_STATUS } from './runState.js';
import { getNodeEvent } from './nodeEvents.js';

const MAX_LOG_LINES = 7;

export function reduceRun(system, run, action, deckProfile = null) {
  if (isRunFinished(run)) {
    return addLog(run, 'La run ya ha terminado. Reinicia para volver a entrar.');
  }

  switch (action.type) {
    case 'selectProgram':
      return selectProgram(run, action.program);
    case 'scan':
      return scan(system, run, deckProfile);
    case 'move':
      return move(system, run, action.nodeId);
    case 'runProgram':
      return runProgram(system, run, action.program, deckProfile);
    case 'extract':
      return extract(system, run, deckProfile);
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

function scan(system, run, deckProfile = null) {
  const connectedIds = getConnectedNodeIds(system, run.currentNodeId);
  const currentNode = getCurrentNode(system, run);
  const currentEvent = getActiveEvent(run, currentNode);
  const nextNodeStates = { ...run.nodeStates };
  const bonusReveals = Math.max(0, Math.floor((getStatLevel(deckProfile, 'lens') + getProgramLevel(deckProfile, 'scan') - 2) / 2));
  let revealed = 0;

  for (const nodeId of connectedIds) {
    if (nextNodeStates[nodeId] === NODE_RUNTIME_STATE.UNKNOWN) {
      nextNodeStates[nodeId] = NODE_RUNTIME_STATE.SCANNED;
      revealed += 1;
    }
  }

  if (bonusReveals > 0) {
    for (const nodeId of connectedIds) {
      for (const farNodeId of getConnectedNodeIds(system, nodeId)) {
        if (revealed >= connectedIds.length + bonusReveals) break;
        if (farNodeId !== run.currentNodeId && nextNodeStates[farNodeId] === NODE_RUNTIME_STATE.UNKNOWN) {
          nextNodeStates[farNodeId] = NODE_RUNTIME_STATE.SCANNED;
          revealed += 1;
        }
      }
    }
  }

  const resolvesDecoy = currentEvent?.kind === 'decoy';
  const scanMessage = resolvesDecoy
    ? `Scan identifica un señuelo en ${nodeLabel(currentNode)} y lo saca del mapa útil.`
    : revealed > 0
      ? `Scan revela ${revealed} nodo(s) cercano(s).`
      : 'Scan sin nuevas rutas. La firma sube.';

  const nextRun = advanceTurn(
    {
      ...run,
      nodeStates: nextNodeStates,
      resolvedEvents: resolvesDecoy ? unique([...(run.resolvedEvents ?? []), currentNode.id]) : run.resolvedEvents,
      alert: clamp(run.alert + (revealed === 0 && !resolvesDecoy ? 1 : 0), 0, run.maxAlert),
      log: appendLog(run.log, scanMessage),
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
    [nodeId]: state === NODE_RUNTIME_STATE.COMPROMISED ? NODE_RUNTIME_STATE.COMPROMISED : NODE_RUNTIME_STATE.VISITED,
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

  const pressuredRun = iceActive ? triggerIce(system, nextRun, node) : enforceFailure(nextRun);
  return triggerNodeEvent(system, pressuredRun, node);
}

function runProgram(system, run, program, deckProfile = null) {
  if (run.disabledPrograms.includes(program)) {
    return addLog(run, `${labelProgram(program)} sigue desactivado.`);
  }

  const preparedRun = { ...run, selectedProgram: program };

  if (program === 'scan') return scan(system, preparedRun, deckProfile);
  if (program === 'extract') return extract(system, preparedRun, deckProfile);
  if (program === 'shield') return shield(system, preparedRun, deckProfile);
  if (program === 'ghost') return ghost(system, preparedRun, deckProfile);
  if (program === 'spike') return spike(system, preparedRun, deckProfile);

  return addLog(run, 'Programa no reconocido.');
}

function shield(system, run, deckProfile = null) {
  const node = getCurrentNode(system, run);
  const event = getActiveEvent(run, node);
  const resolvesTrap = event?.kind === 'trap';
  const shieldTurns = 2 + Math.floor((getStatLevel(deckProfile, 'shell') + getProgramLevel(deckProfile, 'shield') - 2) / 3);

  return enforceFailure(
    advanceTurn(
      {
        ...run,
        shieldTurns,
        resolvedEvents: resolvesTrap ? unique([...(run.resolvedEvents ?? []), node.id]) : run.resolvedEvents,
        log: appendLog(run.log, resolvesTrap ? `Shield encapsula la trampa de ${nodeLabel(node)}.` : 'Shield activo durante dos pulsos.'),
      },
      system,
    ),
  );
}

function ghost(system, run, deckProfile = null) {
  const node = getCurrentNode(system, run);
  const event = getActiveEvent(run, node);
  const resolvesCamera = event?.kind === 'camera';
  const reduction = Math.min(3, 1 + Math.floor((getStatLevel(deckProfile, 'veil') + getProgramLevel(deckProfile, 'ghost') - 2) / 3));

  if (!resolvesCamera && run.alert <= 0 && run.trace <= 0) {
    return addLog(run, 'Ghost no encuentra firma activa que ocultar.');
  }

  return enforceFailure(
    advanceTurn(
      {
        ...run,
        resolvedEvents: resolvesCamera ? unique([...(run.resolvedEvents ?? []), node.id]) : run.resolvedEvents,
        alert: clamp(run.alert - reduction, 0, run.maxAlert),
        trace: clamp(run.trace - reduction, 0, run.maxTrace),
        integrity: resolvesCamera ? run.integrity : clamp(run.integrity - 1, 0, run.maxIntegrity),
        log: appendLog(run.log, resolvesCamera ? `Ghost ciega la cámara de ${nodeLabel(node)}.` : 'Ghost quema shell para reducir firma y difuminar la traza.'),
      },
      system,
    ),
  );
}

function spike(system, run, deckProfile = null) {
  const node = system.nodes.find((candidate) => candidate.id === run.currentNodeId);
  const force = getStatLevel(deckProfile, 'pulse') + getProgramLevel(deckProfile, 'spike') - 2;
  if (!node?.ice || run.neutralizedIce.includes(node.id)) {
    const event = getActiveEvent(run, node);
    if (event?.kind === 'gate') {
      return enforceFailure(
        advanceTurn(
          {
            ...run,
            nodeStates: revealConnectedNodes(system, run),
            resolvedEvents: unique([...(run.resolvedEvents ?? []), node.id]),
            alert: clamp(run.alert + (force >= 3 ? 0 : 1), 0, run.maxAlert),
            log: appendLog(run.log, `Spike fuerza la puerta de ${nodeLabel(node)} y abre rutas.`),
          },
          system,
        ),
      );
    }

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

  const success = run.alert + node.risk <= 12 + force || run.shieldTurns > 0;
  const nextRun = {
    ...run,
    status: RUN_STATUS.EXPLORING,
    neutralizedIce: success ? [...run.neutralizedIce, node.id] : run.neutralizedIce,
    alert: clamp(run.alert + Math.max(1, success ? 2 - Math.floor(force / 3) : 3), 0, run.maxAlert),
    integrity: clamp(run.integrity - (success ? 0 : 2), 0, run.maxIntegrity),
    log: appendLog(run.log, success ? `Spike neutraliza ${node.ice}.` : `Spike falla contra ${node.ice}. Retorno hostil.`),
  };

  return enforceFailure(advanceTurn(nextRun, system));
}

function extract(system, run, deckProfile = null) {
  const node = system.nodes.find((candidate) => candidate.id === run.currentNodeId);
  const event = getActiveEvent(run, node);
  const finesse = Math.floor((getStatLevel(deckProfile, 'lens') + getProgramLevel(deckProfile, 'extract') - 2) / 3);

  if (node?.event === 'decoy' && (run.resolvedEvents ?? []).includes(node.id)) {
    return addLog(run, 'El señuelo ya está marcado como ruido. No hay payload útil en este nodo.');
  }

  if (event?.kind === 'decoy') {
    return enforceFailure(
      advanceTurn(
        {
          ...run,
          resolvedEvents: unique([...(run.resolvedEvents ?? []), node.id]),
          alert: clamp(run.alert + Math.max(1, 2 - finesse), 0, run.maxAlert),
          trace: clamp(run.trace + 1, 0, run.maxTrace),
          log: appendLog(run.log, `Extract muerde un señuelo en ${nodeLabel(node)}. Ruido y traza suben.`),
        },
        system,
      ),
    );
  }

  if (!node || (!['archive', 'core'].includes(event?.kind) && !['database', 'core', 'data'].includes(node.kind))) {
    return addLog(run, 'No hay payload útil en este nodo.');
  }

  if (getNodeState(run, node.id) === NODE_RUNTIME_STATE.COMPROMISED) {
    return addLog(run, `${nodeLabel(node)} ya fue vaciado en esta run.`);
  }

  const lootSize = getLootSize(node);
  const freeSpace = Math.max(0, (run.maxLootTokens ?? 0) - (run.lootTokens ?? 0));
  if (freeSpace <= 0) {
    return addLog(run, 'Memoria del deck llena. Busca salida o mejora almacenamiento.');
  }

  const nextNodeStates = {
    ...run.nodeStates,
    [node.id]: NODE_RUNTIME_STATE.COMPROMISED,
  };
  const storedLoot = Math.min(lootSize, freeSpace);
  const partial = storedLoot < lootSize;

  return enforceFailure(
    advanceTurn(
      {
        ...run,
        hasPayload: true,
        status: RUN_STATUS.OBJECTIVE_COMPLETE,
        lootTokens: (run.lootTokens ?? 0) + storedLoot,
        resolvedEvents: node.event ? unique([...(run.resolvedEvents ?? []), node.id]) : run.resolvedEvents,
        nodeStates: nextNodeStates,
        alert: clamp(run.alert + Math.max(0, (node.kind === 'core' ? 2 : 1) - finesse), 0, run.maxAlert),
        log: appendLog(run.log, `${storedLoot} token(s) de loot cargados desde ${nodeLabel(node)}${partial ? '; memoria al limite' : ''}. Busca salida.`),
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

function triggerNodeEvent(system, run, node) {
  if (isRunFinished(run)) return run;

  const event = getActiveEvent(run, node);
  if (!event) return enforceFailure(run);

  if (event.kind === 'camera') {
    return enforceFailure({
      ...run,
      alert: clamp(run.alert + 1, 0, run.maxAlert),
      log: appendLog(run.log, 'Cámara activa registra movimiento. Usa Ghost para cegarla.'),
    });
  }

  if (event.kind === 'trap') {
    const shielded = run.shieldTurns > 0;
    return enforceFailure({
      ...run,
      resolvedEvents: shielded ? unique([...(run.resolvedEvents ?? []), node.id]) : run.resolvedEvents,
      trace: clamp(run.trace + (shielded ? 0 : 1), 0, run.maxTrace),
      integrity: clamp(run.integrity - (shielded ? 0 : 1), 0, run.maxIntegrity),
      log: appendLog(run.log, shielded ? 'Shield absorbe una trampa latente.' : 'Trampa latente muerde shell y engancha traza.'),
    });
  }

  if (event.kind === 'gate') {
    return enforceFailure({
      ...run,
      log: appendLog(run.log, 'Puerta lógica detectada. Spike puede forzarla y abrir rutas.'),
    });
  }

  return enforceFailure(run);
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
    return { ...run, status: RUN_STATUS.DUMPED, log: appendLog(run.log, 'Convergencia: la traza cierra tu vector y el host te expulsa.') };
  }

  if (run.alert >= run.maxAlert) {
    return { ...run, status: RUN_STATUS.DUMPED, log: appendLog(run.log, 'Convergencia: alerta máxima y contramedidas cerrando la run.') };
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

function getCurrentNode(system, run) {
  return system.nodes.find((candidate) => candidate.id === run.currentNodeId);
}

function getActiveEvent(run, node) {
  if (!node || (run.resolvedEvents ?? []).includes(node.id)) return undefined;
  return getNodeEvent(node);
}

function revealConnectedNodes(system, run) {
  const nextNodeStates = { ...run.nodeStates };
  for (const nodeId of getConnectedNodeIds(system, run.currentNodeId)) {
    if (nextNodeStates[nodeId] === NODE_RUNTIME_STATE.UNKNOWN) {
      nextNodeStates[nodeId] = NODE_RUNTIME_STATE.SCANNED;
    }
  }
  return nextNodeStates;
}

function getStatLevel(deckProfile, stat) {
  return clampLevel(deckProfile?.deck?.[stat]);
}

function getProgramLevel(deckProfile, program) {
  return clampLevel(deckProfile?.programs?.[program]);
}

function getLootSize(node) {
  if (node.kind === 'core') return 3;
  if (node.kind === 'database') return 2;
  return 1;
}

function clampLevel(level) {
  return Math.min(5, Math.max(1, Number.parseInt(level, 10) || 1));
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
