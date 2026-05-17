const DANGER_STOPS = [
  { score: 0, hue: 214, saturation: 88, lightness: 58 },
  { score: 3.8, hue: 214, saturation: 88, lightness: 58 },
  { score: 4.8, hue: 32, saturation: 96, lightness: 58 },
  { score: 6, hue: 32, saturation: 96, lightness: 58 },
  { score: 8, hue: 6, saturation: 100, lightness: 60 },
  { score: 10, hue: 0, saturation: 100, lightness: 62 },
];

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
  for (let index = 0; index < DANGER_STOPS.length - 1; index += 1) {
    const current = DANGER_STOPS[index];
    const next = DANGER_STOPS[index + 1];
    if (dangerScore > next.score) continue;
    const span = next.score - current.score;
    const mix = span <= 0 ? 0 : (dangerScore - current.score) / span;
    return {
      hue: Math.round(lerpHue(current.hue, next.hue, mix)),
      saturation: Math.round(lerp(current.saturation, next.saturation, mix)),
      lightness: Math.round(lerp(current.lightness, next.lightness, mix)),
    };
  }
  return DANGER_STOPS[DANGER_STOPS.length - 1];
}

function ratio(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return clamp(value / max, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, mix) {
  return start + (end - start) * clamp(mix, 0, 1);
}

function lerpHue(start, end, mix) {
  const delta = ((end - start + 540) % 360) - 180;
  return (start + delta * clamp(mix, 0, 1) + 360) % 360;
}
