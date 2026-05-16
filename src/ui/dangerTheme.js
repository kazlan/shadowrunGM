const MIN_HUE = 0;
const MAX_HUE = 214;

export function getDangerTheme(run) {
  const alertRatio = ratio(run.alert, run.maxAlert);
  const traceRatio = ratio(run.trace, run.maxTrace);
  const damageRatio = 1 - ratio(run.integrity, run.maxIntegrity);
  const encounterPressure = run.status === 'encounter' ? 0.42 : 0;
  const finishedRelief = run.status === 'escaped' ? -0.22 : 0;
  const dumpedDanger = run.status === 'dumped' ? 1 : 0;
  const level = clamp(Math.max(alertRatio, traceRatio, damageRatio, encounterPressure, dumpedDanger) + finishedRelief, 0, 1);
  const hue = Math.round(MAX_HUE - (MAX_HUE - MIN_HUE) * level);
  const saturation = Math.round(88 + level * 12);
  const lightness = Math.round(58 + level * 6);
  const alpha = (0.28 + level * 0.46).toFixed(2);
  const glowAlpha = (0.12 + level * 0.34).toFixed(2);

  return {
    level: level.toFixed(3),
    color: `hsl(${hue} ${saturation}% ${lightness}%)`,
    border: `hsla(${hue} ${saturation}% ${lightness}% / ${alpha})`,
    glow: `hsla(${hue} ${saturation}% ${lightness}% / ${glowAlpha})`,
  };
}

function ratio(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return clamp(value / max, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
