const DANGER_PALETTES = {
  normal: { hue: 214, saturation: 88, lightness: 58 },
  orange: { hue: 32, saturation: 96, lightness: 58 },
  redOrange: { hue: 18, saturation: 100, lightness: 58 },
  red: { hue: 0, saturation: 100, lightness: 62 },
};

export function getDangerTheme(run) {
  const alertRatio = ratio(run.alert, run.maxAlert);
  const traceRatio = ratio(run.trace, run.maxTrace);
  const damageRatio = 1 - ratio(run.integrity, run.maxIntegrity);
  const encounterPressure = run.status === 'encounter' ? 0.42 : 0;
  const finishedRelief = run.status === 'escaped' ? -0.22 : 0;
  const dumpedDanger = run.status === 'dumped' ? 1 : 0;
  const level = clamp(Math.max(alertRatio, traceRatio, damageRatio, encounterPressure, dumpedDanger) + finishedRelief, 0, 1);
  const palette = getDangerPalette(level);
  const { hue, saturation, lightness } = palette;
  const alpha = (0.28 + level * 0.46).toFixed(2);
  const glowAlpha = (0.12 + level * 0.34).toFixed(2);

  return {
    level: level.toFixed(3),
    color: `hsl(${hue} ${saturation}% ${lightness}%)`,
    border: `hsla(${hue} ${saturation}% ${lightness}% / ${alpha})`,
    glow: `hsla(${hue} ${saturation}% ${lightness}% / ${glowAlpha})`,
  };
}

function getDangerPalette(level) {
  const dangerScore = level * 10;
  if (dangerScore < 4) return DANGER_PALETTES.normal;
  if (dangerScore < 6) return DANGER_PALETTES.orange;
  if (dangerScore < 8) {
    const heat = (dangerScore - 6) / 2;
    return {
      hue: Math.round(DANGER_PALETTES.orange.hue - (DANGER_PALETTES.orange.hue - DANGER_PALETTES.redOrange.hue) * heat),
      saturation: DANGER_PALETTES.redOrange.saturation,
      lightness: DANGER_PALETTES.redOrange.lightness,
    };
  }
  return DANGER_PALETTES.red;
}

function ratio(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return clamp(value / max, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
