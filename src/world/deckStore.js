const STORAGE_KEY = 'shadowhack.deckProfile.v1';
const MAX_LEVEL = 5;

const DEFAULT_STATS = {
  pulse: 1,
  veil: 1,
  lens: 1,
  shell: 1,
};

const DEFAULT_PROGRAMS = {
  scan: 1,
  spike: 1,
  ghost: 1,
  shield: 1,
  extract: 1,
};

const DEFAULT_HARDWARE = {
  storage: 1,
  bookmarks: 1,
};

export const deckStatCatalog = {
  pulse: { kind: 'pulse', label: 'Pulse', description: 'Potencia ofensiva para Spike y ruptura de puertas.' },
  veil: { kind: 'veil', label: 'Veil', description: 'Sigilo, traza máxima y margen de Ghost.' },
  lens: { kind: 'lens', label: 'Lens', description: 'Lectura del mapa y alcance de Scan.' },
  shell: { kind: 'shell', label: 'Shell', description: 'Integridad base, Shield y resistencia a retorno hostil.' },
};

export function createDefaultDeckProfile() {
  return {
    credits: 0,
    totalEarned: 0,
    deck: { ...DEFAULT_STATS },
    hardware: { ...DEFAULT_HARDWARE },
    programs: { ...DEFAULT_PROGRAMS },
    unlockedPrograms: Object.keys(DEFAULT_PROGRAMS),
    bookmarks: [],
    lastReward: 0,
  };
}

export function loadDeckProfile() {
  const fallback = createDefaultDeckProfile();
  try {
    if (!globalThis.localStorage) return fallback;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return normalizeDeckProfile(JSON.parse(raw));
  } catch (error) {
    console.warn('Could not load deck profile', error);
    return fallback;
  }
}

export function saveDeckProfile(profile) {
  const normalized = normalizeDeckProfile(profile);
  try {
    if (globalThis.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch (error) {
    console.warn('Could not persist deck profile', error);
  }
  return normalized;
}

export function awardRunCredits(profile, system, run, score) {
  const reward = calculateRunCredits(system, run, score);
  const nextProfile = normalizeDeckProfile({
    ...profile,
    credits: profile.credits + reward,
    totalEarned: profile.totalEarned + reward,
    lastReward: reward,
  });

  return {
    profile: saveDeckProfile(nextProfile),
    reward,
  };
}

export function upgradeDeckProfile(profile, category, key) {
  const normalized = normalizeDeckProfile(profile);
  if (!['stat', 'program', 'hardware'].includes(category)) return { profile: normalized, changed: false, reason: 'unknown' };

  const collection = getUpgradeCollection(normalized, category);
  if (!Object.hasOwn(collection, key)) return { profile: normalized, changed: false, reason: 'missing' };

  const level = collection[key];
  if (level >= MAX_LEVEL) return { profile: normalized, changed: false, reason: 'max' };

  const cost = getUpgradeCost(category, level);
  if (normalized.credits < cost) return { profile: normalized, changed: false, reason: 'credits' };

  const nextProfile = normalizeDeckProfile({
    ...normalized,
    credits: normalized.credits - cost,
    [getUpgradeCollectionKey(category)]: {
      ...collection,
      [key]: level + 1,
    },
  });

  return { profile: saveDeckProfile(nextProfile), changed: true, cost };
}

export function getUpgradeCost(category, currentLevel) {
  const base = category === 'stat' ? 130 : category === 'hardware' ? 120 : 90;
  return base * (currentLevel + 1);
}

export function getDeckLevel(profile) {
  const normalized = normalizeDeckProfile(profile);
  const statTotal = Object.values(normalized.deck).reduce((sum, level) => sum + level, 0);
  const programTotal = Object.values(normalized.programs).reduce((sum, level) => sum + level, 0);
  return Math.floor((statTotal * 2 + programTotal) / 6);
}

export function normalizeDeckProfile(profile) {
  const source = profile && typeof profile === 'object' ? profile : {};
  return {
    credits: nonNegativeInt(source.credits),
    totalEarned: nonNegativeInt(source.totalEarned),
    deck: normalizeLevels(source.deck, DEFAULT_STATS),
    hardware: normalizeLevels(source.hardware, DEFAULT_HARDWARE),
    programs: normalizeLevels(source.programs, DEFAULT_PROGRAMS),
    unlockedPrograms: Array.isArray(source.unlockedPrograms) ? source.unlockedPrograms : Object.keys(DEFAULT_PROGRAMS),
    bookmarks: normalizeBookmarks(source.bookmarks),
    lastReward: nonNegativeInt(source.lastReward),
  };
}

export function getStorageCapacity(profile) {
  const normalized = normalizeDeckProfile(profile);
  return 3 + normalized.hardware.storage * 2;
}

export function getBookmarkCapacity(profile) {
  const normalized = normalizeDeckProfile(profile);
  return 2 + normalized.hardware.bookmarks;
}

export function hasHostBookmark(profile, seedId) {
  const normalized = normalizeDeckProfile(profile);
  return normalized.bookmarks.some((bookmark) => bookmark.seedId === seedId);
}

export function addHostBookmark(profile, system) {
  const normalized = normalizeDeckProfile(profile);
  if (hasHostBookmark(normalized, system.seedId)) return { profile: normalized, changed: false, reason: 'exists' };
  if (normalized.bookmarks.length >= getBookmarkCapacity(normalized)) return { profile: normalized, changed: false, reason: 'full' };

  const bookmark = {
    seedId: system.seedId,
    hostAlias: system.alias,
    provider: system.company.provider,
    providerId: system.company.providerId,
    name: system.company.name,
    category: system.company.category,
    lat: system.company.lat,
    lon: system.company.lon,
    address: system.company.address,
    savedAt: new Date().toISOString(),
  };
  const nextProfile = normalizeDeckProfile({
    ...normalized,
    bookmarks: [bookmark, ...normalized.bookmarks],
  });
  return { profile: saveDeckProfile(nextProfile), changed: true, bookmark };
}

function calculateRunCredits(system, run, score) {
  const tierBonus = { S: 90, A: 70, B: 50, C: 35, D: 25 }[system.valuation?.tier] ?? 30;
  const payloadBonus = run.hasPayload ? 45 : 0;
  const lootBonus = (run.lootTokens ?? 0) * 8;
  const escapeBonus = run.status === 'escaped' ? 35 : 0;
  const scoreBonus = Math.floor(score / 160);
  const failureFloor = run.status === 'dumped' ? 12 : 0;

  return Math.max(failureFloor, tierBonus + payloadBonus + lootBonus + escapeBonus + scoreBonus);
}

function normalizeLevels(source, defaults) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, clampLevel(source?.[key] ?? fallback)]),
  );
}

function normalizeBookmarks(bookmarks) {
  if (!Array.isArray(bookmarks)) return [];
  return bookmarks
    .filter((bookmark) => bookmark?.seedId && bookmark?.name && Number.isFinite(bookmark.lat) && Number.isFinite(bookmark.lon))
    .map((bookmark) => ({
      seedId: String(bookmark.seedId),
      hostAlias: String(bookmark.hostAlias ?? bookmark.name),
      provider: String(bookmark.provider ?? 'bookmark'),
      providerId: String(bookmark.providerId ?? bookmark.seedId),
      name: String(bookmark.name),
      category: String(bookmark.category ?? 'bookmark'),
      lat: Number(bookmark.lat),
      lon: Number(bookmark.lon),
      address: bookmark.address ? String(bookmark.address) : undefined,
      savedAt: bookmark.savedAt ? String(bookmark.savedAt) : new Date().toISOString(),
    }));
}

function getUpgradeCollection(profile, category) {
  if (category === 'stat') return profile.deck;
  if (category === 'hardware') return profile.hardware;
  return profile.programs;
}

function getUpgradeCollectionKey(category) {
  if (category === 'stat') return 'deck';
  if (category === 'hardware') return 'hardware';
  return 'programs';
}

function clampLevel(value) {
  return Math.min(MAX_LEVEL, Math.max(1, Number.parseInt(value, 10) || 1));
}

function nonNegativeInt(value) {
  return Math.max(0, Number.parseInt(value, 10) || 0);
}
