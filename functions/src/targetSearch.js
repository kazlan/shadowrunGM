const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const OVERPASS_TIMEOUT_MS = 8500;
const CACHE_COLLECTION = 'placesCache';
const CACHE_VERSION = 1;
const CACHE_GRID_METERS = 500;
const MIN_TARGET_RADIUS = 250;
const MAX_TARGET_RADIUS = 15000;
const OVERPASS_MAX_RADIUS = 3000;
const EXPANDED_TARGET_RADII = [3000, 8000, 15000];
const FRESH_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const GEOAPIFY_CATEGORIES = [
  'commercial',
  'catering',
  'healthcare',
  'office',
  'service',
  'tourism',
  'leisure',
  'entertainment',
  'education',
  'accommodation',
];

export const validationError = { code: 'invalid_request' };

export async function resolveNearbyTargets({ db, fetchImpl = fetch, geoapifyApiKey = '', input = {}, now = new Date() }) {
  const request = normalizeTargetRequest(input);
  const cacheKey = createCacheKey(request);
  const cached = await readUsableCache(db, cacheKey, request.minTargets, now);
  if (cached?.state === 'fresh') return cacheResponse(cached.data, 'fresh', request);

  const stale = cached?.state === 'stale' ? cached.data : null;
  const providerHealth = { overpass: 'skipped', geoapify: 'skipped' };
  let overpassPlaces = [];
  let geoapifyPlaces = [];
  let resolvedRadius = request.radius;

  for (const radius of getSearchRadii(request.radius)) {
    resolvedRadius = radius;
    if (radius <= OVERPASS_MAX_RADIUS) {
      try {
        const radiusOverpassPlaces = await fetchOverpassPlaces(fetchImpl, request.position, radius);
        overpassPlaces = mergePlaces(overpassPlaces, radiusOverpassPlaces);
        recordProviderHealth(providerHealth, 'overpass', overpassPlaces.length >= request.minTargets
          ? 'ok'
          : radiusOverpassPlaces.length > 0 ? 'partial' : 'partial');
      } catch (error) {
        recordProviderHealth(providerHealth, 'overpass', 'failed');
      }
    }

    if (mergePlaces(overpassPlaces, geoapifyPlaces).length >= request.minTargets) {
      if (providerHealth.geoapify === 'skipped') providerHealth.geoapify = 'not_needed';
      break;
    }

    if (geoapifyApiKey) {
      try {
        const radiusGeoapifyPlaces = await fetchGeoapifyPlaces(fetchImpl, request.position, radius, request.limit, geoapifyApiKey);
        geoapifyPlaces = mergePlaces(geoapifyPlaces, radiusGeoapifyPlaces);
        recordProviderHealth(providerHealth, 'geoapify', radiusGeoapifyPlaces.length > 0 ? 'ok' : 'partial');
      } catch (error) {
        recordProviderHealth(providerHealth, 'geoapify', 'failed');
      }
    } else {
      providerHealth.geoapify = 'not_configured';
    }

    if (mergePlaces(overpassPlaces, geoapifyPlaces).length >= request.minTargets) break;
  }

  const places = mergePlaces(overpassPlaces, geoapifyPlaces).slice(0, request.limit);
  if (places.length === 0 && stale) return cacheResponse(stale, 'stale', request);

  const source = resolveSource(overpassPlaces, geoapifyPlaces, places);
  if (places.length > 0) {
    await writeCache(db, cacheKey, {
      key: cacheKey,
      version: CACHE_VERSION,
      cell: getGridCell(request.position),
      lat: request.position.lat,
      lon: request.position.lon,
      radius: resolvedRadius,
      limit: request.limit,
      minTargets: request.minTargets,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + FRESH_TTL_MS),
      staleUntil: new Date(now.getTime() + STALE_TTL_MS),
      source,
      providerHealth,
      places,
      count: places.length,
    });
  }

  return {
    places,
    source,
    cacheState: 'miss',
    providerHealth,
    radius: resolvedRadius,
    limit: request.limit,
  };
}

export function normalizeTargetRequest(input) {
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throwInvalidRequest('Invalid lat/lon');
  }
  const radius = clamp(Number.parseInt(input.radius, 10) || 900, MIN_TARGET_RADIUS, MAX_TARGET_RADIUS);
  const limit = clamp(Number.parseInt(input.limit, 10) || 10, 1, 10);
  const minTargets = clamp(Number.parseInt(input.minTargets, 10) || 4, 1, 10);
  return {
    position: {
      lat: roundCoord(lat),
      lon: roundCoord(lon),
    },
    radius,
    limit,
    minTargets,
  };
}

function getSearchRadii(radius) {
  const radii = [radius, ...EXPANDED_TARGET_RADII.filter((expandedRadius) => radius < expandedRadius)];
  return [...new Set(radii.map((value) => clamp(value, MIN_TARGET_RADIUS, MAX_TARGET_RADIUS)))];
}

function recordProviderHealth(providerHealth, provider, state) {
  const rank = {
    skipped: 0,
    not_needed: 1,
    not_configured: 1,
    failed: 2,
    partial: 3,
    ok: 4,
  };
  const current = providerHealth[provider] ?? 'skipped';
  if ((rank[state] ?? 0) >= (rank[current] ?? 0)) providerHealth[provider] = state;
}

export function createCacheKey(requestOrInput) {
  const request = requestOrInput.position ? requestOrInput : normalizeTargetRequest(requestOrInput);
  const cell = getGridCell(request.position);
  return `v${CACHE_VERSION}:g${CACHE_GRID_METERS}:${cell.lat}:${cell.lon}:r${request.radius}:l${request.limit}:m${request.minTargets}`;
}

export function mergePlaces(...placeGroups) {
  const byProviderId = new Map();
  const merged = [];
  for (const place of placeGroups.flat()) {
    const normalized = normalizePlaceForResponse(place);
    if (!normalized) continue;
    const providerKey = `${normalized.provider}:${normalized.providerId}`;
    if (byProviderId.has(providerKey)) continue;
    const duplicateIndex = merged.findIndex((candidate) => isNearDuplicate(candidate, normalized));
    if (duplicateIndex >= 0) {
      if (normalized.provider === 'osm' && merged[duplicateIndex].provider !== 'osm') {
        merged[duplicateIndex] = normalized;
      }
      byProviderId.set(providerKey, normalized);
      continue;
    }
    byProviderId.set(providerKey, normalized);
    merged.push(normalized);
  }
  return merged;
}

async function readUsableCache(db, cacheKey, minTargets, now) {
  const snapshot = await db.collection(CACHE_COLLECTION).doc(cacheKey).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (!Array.isArray(data.places) || data.places.length < minTargets) return null;
  const expiresAt = asDate(data.expiresAt);
  if (expiresAt && expiresAt.getTime() > now.getTime()) return { state: 'fresh', data };
  const staleUntil = asDate(data.staleUntil);
  if (staleUntil && staleUntil.getTime() > now.getTime()) return { state: 'stale', data };
  return null;
}

async function writeCache(db, cacheKey, data) {
  await db.collection(CACHE_COLLECTION).doc(cacheKey).set(data, { merge: true });
}

function cacheResponse(cacheData, cacheState, request) {
  return {
    places: (cacheData.places ?? []).slice(0, request.limit).map(normalizePlaceForResponse).filter(Boolean),
    source: cacheData.source ?? 'cache',
    cacheState,
    providerHealth: cacheData.providerHealth ?? { overpass: 'skipped', geoapify: 'skipped' },
    radius: cacheData.radius ?? request.radius,
    limit: cacheData.limit ?? request.limit,
  };
}

async function fetchOverpassPlaces(fetchImpl, position, radius) {
  const failures = [];
  const query = buildOverpassQuery(position, radius);
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(fetchImpl, endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
      }, OVERPASS_TIMEOUT_MS);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      return normalizeOverpassElements(payload.elements ?? [], position);
    } catch (error) {
      failures.push(error.message);
    }
  }
  throw new Error(`Overpass unavailable (${failures.join(' | ')})`);
}

async function fetchGeoapifyPlaces(fetchImpl, position, radius, limit, apiKey) {
  const url = new URL('https://api.geoapify.com/v2/places');
  url.searchParams.set('categories', GEOAPIFY_CATEGORIES.join(','));
  url.searchParams.set('filter', `circle:${position.lon},${position.lat},${radius}`);
  url.searchParams.set('bias', `proximity:${position.lon},${position.lat}`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('apiKey', apiKey);

  const response = await fetchWithTimeout(fetchImpl, url, {}, OVERPASS_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Geoapify HTTP ${response.status}`);
  const payload = await response.json();
  return normalizeGeoapifyFeatures(payload.features ?? [], position);
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function buildOverpassQuery(position, radius) {
  return `[out:json][timeout:12];
(
  nwr["name"]["amenity"](around:${radius},${position.lat},${position.lon});
  nwr["name"]["shop"](around:${radius},${position.lat},${position.lon});
  nwr["name"]["office"](around:${radius},${position.lat},${position.lon});
  nwr["name"]["craft"](around:${radius},${position.lat},${position.lon});
  nwr["name"]["tourism"](around:${radius},${position.lat},${position.lon});
  nwr["name"]["leisure"](around:${radius},${position.lat},${position.lon});
  nwr["name"]["healthcare"](around:${radius},${position.lat},${position.lon});
  nwr["name"]["building"~"commercial|retail|industrial|office|hospital|school|university|hotel"](around:${radius},${position.lat},${position.lon});
  nwr["name"]["landuse"~"commercial|retail|industrial"](around:${radius},${position.lat},${position.lon});
);
out center tags 40;`;
}

function normalizeOverpassElements(elements, origin) {
  return elements
    .map((element) => {
      const tags = element.tags ?? {};
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)) || !tags.name) return null;
      const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
      const city = tags['addr:city'];
      return normalizePlaceForResponse({
        provider: 'osm',
        providerId: `${element.type}/${element.id}`,
        name: tags.name,
        category: tags.amenity
          ?? tags.shop
          ?? tags.office
          ?? tags.craft
          ?? tags.tourism
          ?? tags.leisure
          ?? tags.healthcare
          ?? tags.building
          ?? tags.landuse
          ?? 'unknown',
        lat,
        lon,
        address: [street, city].filter(Boolean).join(', ') || undefined,
        distance: distanceMeters(origin, { lat, lon }),
      });
    })
    .filter(Boolean);
}

function normalizeGeoapifyFeatures(features, origin) {
  return features
    .map((feature) => {
      const properties = feature.properties ?? {};
      const [lon, lat] = feature.geometry?.coordinates ?? [];
      const name = properties.name ?? properties.address_line1;
      if (!name || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)) || !properties.place_id) return null;
      return normalizePlaceForResponse({
        provider: 'geoapify',
        providerId: `geoapify/${properties.place_id}`,
        name,
        category: mapGeoapifyCategory(properties.categories ?? []),
        lat,
        lon,
        address: properties.address_line2 ?? properties.formatted,
        distance: Number.isFinite(properties.distance) ? Math.round(properties.distance) : distanceMeters(origin, { lat, lon }),
      });
    })
    .filter(Boolean);
}

function normalizePlaceForResponse(place) {
  if (!place?.name || !place.providerId) return null;
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    provider: String(place.provider ?? 'unknown'),
    providerId: String(place.providerId),
    name: String(place.name),
    category: String(place.category ?? 'unknown'),
    lat: roundCoord(lat),
    lon: roundCoord(lon),
    ...(place.address ? { address: String(place.address) } : {}),
    ...(Number.isFinite(place.distance) ? { distance: Math.round(place.distance) } : {}),
  };
}

function mapGeoapifyCategory(categories) {
  const joined = categories.join(' ');
  if (joined.includes('catering')) return 'food';
  if (joined.includes('healthcare')) return 'healthcare';
  if (joined.includes('commercial')) return 'shop';
  if (joined.includes('office')) return 'office';
  if (joined.includes('tourism') || joined.includes('accommodation')) return 'tourism';
  if (joined.includes('education')) return 'education';
  if (joined.includes('service')) return 'service';
  if (joined.includes('entertainment') || joined.includes('leisure')) return 'leisure';
  return categories[0] ?? 'unknown';
}

function resolveSource(overpassPlaces, geoapifyPlaces, places) {
  if (places.length === 0) return 'empty';
  if (overpassPlaces.length > 0 && geoapifyPlaces.length > 0) return 'mixed';
  if (overpassPlaces.length > 0) return 'overpass';
  if (geoapifyPlaces.length > 0) return 'geoapify';
  return 'empty';
}

function isNearDuplicate(left, right) {
  return normalizeText(left.name) === normalizeText(right.name)
    && distanceMeters(left, right) <= 80;
}

function getGridCell(position) {
  const latMeters = position.lat * 111_320;
  const lonMeters = position.lon * 111_320 * Math.max(0.2, Math.cos(position.lat * Math.PI / 180));
  return {
    lat: Math.floor(latMeters / CACHE_GRID_METERS),
    lon: Math.floor(lonMeters / CACHE_GRID_METERS),
  };
}

function distanceMeters(left, right) {
  const lat1 = left.lat * Math.PI / 180;
  const lat2 = right.lat * Math.PI / 180;
  const deltaLat = (right.lat - left.lat) * Math.PI / 180;
  const deltaLon = (right.lon - left.lon) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return Math.round(6371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function throwInvalidRequest(message) {
  const error = new Error(message);
  error.code = validationError.code;
  throw error;
}

function roundCoord(value) {
  return Number(value.toFixed(5));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
