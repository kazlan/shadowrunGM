const VALUE_BY_ARCHETYPE = {
  food: 18,
  retail: 24,
  unknown: 30,
  industrial: 42,
  tech: 52,
  medical: 58,
  security: 62,
  government: 68,
  finance: 74,
};

const CATEGORY_SIGNALS = [
  { pattern: /bank|finance|atm|credit|banco|financ|insurance|broker/i, value: 28 },
  { pattern: /hospital|clinic|health|medical|pharmacy|clinica|salud|farmacia/i, value: 22 },
  { pattern: /government|court|police|public|ayuntamiento|juzgado|comisaria/i, value: 24 },
  { pattern: /security|alarm|seguridad|datacenter|data center/i, value: 24 },
  { pattern: /software|computer|telecom|data|tech|informatica|electronics/i, value: 18 },
  { pattern: /factory|warehouse|industrial|logistics|fabrica|almacen/i, value: 14 },
  { pattern: /supermarket|mall|department_store|market|retail|supermercado/i, value: 12 },
  { pattern: /restaurant|cafe|bar|bakery|food|cafeteria|panaderia/i, value: 4 },
];

const NAME_SIGNALS = [
  { pattern: /global|international|capital|group|holding|partners|systems|labs|delta|prime/i, value: 8 },
  { pattern: /central|nacional|national|regional|federal|royal/i, value: 7 },
  { pattern: /express|mini|local|corner|kiosk|puesto/i, value: -4 },
];

export function valueCompany(company, archetype, seedHex) {
  const archetypeKey = archetype.archetype ?? 'unknown';
  const haystack = `${company.category ?? ''} ${company.name ?? ''} ${company.address ?? ''}`;
  const base = VALUE_BY_ARCHETYPE[archetypeKey] ?? VALUE_BY_ARCHETYPE.unknown;
  const categoryBoost = sumSignals(CATEGORY_SIGNALS, haystack);
  const nameBoost = sumSignals(NAME_SIGNALS, haystack);
  const providerBoost = company.provider === 'osm' ? 4 : 0;
  const seedVariance = stableSeedVariance(seedHex);
  const score = clamp(Math.round(base + categoryBoost + nameBoost + providerBoost + seedVariance), 5, 100);

  return {
    score,
    tier: tierFromScore(score),
    difficulty: difficultyFromScore(score),
    payoutMultiplier: Number((1 + score / 100).toFixed(2)),
    securityModifier: modifierFromScore(score),
    sizeModifier: sizeModifierFromScore(score),
  };
}

function sumSignals(signals, haystack) {
  return signals.reduce((total, signal) => total + (signal.pattern.test(haystack) ? signal.value : 0), 0);
}

function stableSeedVariance(seedHex) {
  const slice = seedHex.slice(0, 8) || '00000000';
  const normalized = Number.parseInt(slice, 16) / 0xffffffff;
  return Math.round(normalized * 14) - 7;
}

function tierFromScore(score) {
  if (score >= 85) return 'AAA';
  if (score >= 70) return 'AA';
  if (score >= 55) return 'A';
  if (score >= 40) return 'B';
  if (score >= 25) return 'C';
  return 'D';
}

function difficultyFromScore(score) {
  if (score >= 85) return 'letal';
  if (score >= 70) return 'alta';
  if (score >= 55) return 'elevada';
  if (score >= 40) return 'media';
  if (score >= 25) return 'baja';
  return 'mínima';
}

function modifierFromScore(score) {
  if (score >= 85) return 2;
  if (score >= 55) return 1;
  if (score < 25) return -1;
  return 0;
}

function sizeModifierFromScore(score) {
  if (score >= 85) return 3;
  if (score >= 70) return 2;
  if (score >= 45) return 1;
  if (score < 20) return -1;
  return 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
