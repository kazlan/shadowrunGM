const prefixes = ['NEON', 'NULL', 'GHOST', 'CIPHER', 'VOID', 'KERNEL', 'MONO', 'RAVEN'];
const suffixes = ['VAULT', 'GATE', 'HIVE', 'SPINDLE', 'ORACLE', 'MIRROR', 'STACK', 'NEXUS'];

export function generateHostAlias(company, profile, rng) {
  const prefix = rng.pick(prefixes);
  const suffix = rng.pick(suffixes);
  const marker = company.name.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || profile.archetype.slice(0, 3).toUpperCase();
  return `${prefix}-${marker}-${suffix}`;
}
