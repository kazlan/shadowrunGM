const STORAGE_KEY = 'shadowhack.hostProgress.v1';

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Could not load host progress', error);
    return {};
  }
}

export function getHostProgress(seedId) {
  return loadProgress()[seedId] ?? null;
}

export function recordRunResult(system, run, score) {
  const progress = loadProgress();
  const previous = progress[system.seedId] ?? {
    seedId: system.seedId,
    hostAlias: system.alias,
    companyName: system.company.name,
    archetype: system.archetype.archetype,
    companyValue: system.valuation?.score ?? 0,
    valueTier: system.valuation?.tier ?? 'C',
    discoveredAt: new Date().toISOString(),
    attempts: 0,
    completedRuns: 0,
    bestScore: 0,
  };

  progress[system.seedId] = {
    ...previous,
    hostAlias: system.alias,
    companyName: system.company.name,
    archetype: system.archetype.archetype,
    companyValue: system.valuation?.score ?? previous.companyValue ?? 0,
    valueTier: system.valuation?.tier ?? previous.valueTier ?? 'C',
    attempts: previous.attempts + 1,
    completedRuns: previous.completedRuns + (run.status === 'escaped' && run.hasPayload ? 1 : 0),
    bestScore: Math.max(previous.bestScore, score),
    lastStatus: run.status,
    lastScore: score,
    lastPlayedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn('Could not persist host progress', error);
  }

  return progress[system.seedId];
}

export function getPlayerProgressStats() {
  const entries = Object.values(loadProgress());
  return {
    hostsDominated: entries.filter((entry) => (Number(entry.completedRuns) || 0) > 0).length,
    totalRuns: entries.reduce((sum, entry) => sum + (Number(entry.attempts) || 0), 0),
    completedRuns: entries.reduce((sum, entry) => sum + (Number(entry.completedRuns) || 0), 0),
    bestScore: entries.reduce((best, entry) => Math.max(best, Number(entry.bestScore) || 0), 0),
  };
}

export function listRecentProgress(limit = 5) {
  return Object.values(loadProgress())
    .sort((left, right) => String(right.lastPlayedAt ?? right.discoveredAt).localeCompare(String(left.lastPlayedAt ?? left.discoveredAt)))
    .slice(0, limit);
}
