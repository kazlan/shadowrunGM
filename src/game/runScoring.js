export function scoreRun(system, run) {
  const payloadBonus = run.hasPayload ? 500 : 0;
  const lootBonus = (run.lootTokens ?? 0) * 80;
  const escapeBonus = run.status === 'escaped' ? 700 : 0;
  const integrityBonus = run.integrity * 80;
  const stealthBonus = Math.max(0, run.maxAlert - run.alert) * 45;
  const traceBonus = Math.max(0, run.maxTrace - run.trace) * 55;
  const speedBonus = Math.max(0, 30 - run.turn) * 25;
  const difficultyBonus = (system.effectiveSecurity ?? system.archetype.security) * 120;
  const valuationMultiplier = system.valuation?.payoutMultiplier ?? 1;

  return Math.round(Math.max(0, payloadBonus + lootBonus + escapeBonus + integrityBonus + stealthBonus + traceBonus + speedBonus + difficultyBonus) * valuationMultiplier);
}
