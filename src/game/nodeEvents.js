export const nodeEvents = {
  archive: {
    kind: 'archive',
    label: 'Archivo',
    glyph: 'AR',
    program: 'extract',
    hint: 'Extract captura payload útil.',
  },
  gate: {
    kind: 'gate',
    label: 'Puerta',
    glyph: 'GT',
    program: 'spike',
    hint: 'Spike fuerza la puerta y abre rutas.',
  },
  camera: {
    kind: 'camera',
    label: 'Cámara',
    glyph: 'CM',
    program: 'ghost',
    hint: 'Ghost apaga la firma antes de que suba la alerta.',
  },
  decoy: {
    kind: 'decoy',
    label: 'Señuelo',
    glyph: 'DC',
    program: 'scan',
    hint: 'Scan separa dato real de ruido.',
  },
  trap: {
    kind: 'trap',
    label: 'Trampa',
    glyph: 'TR',
    program: 'shield',
    hint: 'Shield absorbe el retorno hostil.',
  },
  core: {
    kind: 'core',
    label: 'Núcleo',
    glyph: 'CR',
    program: 'extract',
    hint: 'Extract completa el objetivo principal.',
  },
  exit: {
    kind: 'exit',
    label: 'Salida',
    glyph: 'EX',
    program: 'jackOut',
    hint: 'Jack out asegura la run desde aquí.',
  },
};

export function getNodeEvent(node) {
  return node?.event ? nodeEvents[node.event] : undefined;
}
