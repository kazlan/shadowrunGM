const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const ALLOWED_RADIUS = [250, 2000];
const OVERPASS_REQUEST_TIMEOUT_MS = 8500;

export function createOverpassProvider(options = {}) {
  const endpoints = normalizeEndpoints(options.endpoints ?? options.endpoint ?? OVERPASS_ENDPOINTS);
  const timeoutMs = options.timeoutMs ?? OVERPASS_REQUEST_TIMEOUT_MS;

  return {
    async searchNearbyPlaces(position, radiusMeters = 900) {
      const radius = clamp(Math.round(radiusMeters), ALLOWED_RADIUS[0], ALLOWED_RADIUS[1]);
      const query = buildOverpassQuery(position, radius);
      const payload = await fetchOverpassWithFallback(endpoints, query, timeoutMs);
      return normalizeOverpassElements(payload.elements ?? []).slice(0, 24);
    },
  };
}

function normalizeEndpoints(value) {
  return Array.isArray(value) ? value : [value];
}

async function fetchOverpassWithFallback(endpoints, query, timeoutMs) {
  const failures = [];
  for (const endpoint of endpoints) {
    try {
      return await fetchOverpass(endpoint, query, timeoutMs);
    } catch (error) {
      failures.push(`${shortEndpoint(endpoint)}: ${error.message}`);
    }
  }
  throw new Error(`Overpass sin respuesta estable (${failures.join(' | ')})`);
}

async function fetchOverpass(endpoint, query, timeoutMs) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(endpoint);
    url.searchParams.set('data', query);
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('timeout');
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function shortEndpoint(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

function buildOverpassQuery(position, radius) {
  return `[out:json][timeout:12];
(
  nwr["amenity"]["name"](around:${radius},${position.lat},${position.lon});
  nwr["shop"]["name"](around:${radius},${position.lat},${position.lon});
  nwr["leisure"]["name"](around:${radius},${position.lat},${position.lon});
);
out center tags 40;`;
}

function normalizeOverpassElements(elements) {
  const seen = new Set();
  return elements
    .map((element) => normalizeElement(element))
    .filter((place) => {
      if (!place?.name || !place.providerId) return false;
      const key = `${place.providerId}|${place.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeElement(element) {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!lat || !lon || !tags.name) return null;

  const category = tags.amenity
    ?? tags.shop
    ?? tags.office
    ?? tags.craft
    ?? tags.tourism
    ?? tags.leisure
    ?? tags.healthcare
    ?? tags.building
    ?? tags.landuse
    ?? 'unknown';
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const city = tags['addr:city'];

  return {
    provider: 'osm',
    providerId: `${element.type}/${element.id}`,
    name: tags.name,
    category,
    lat,
    lon,
    address: [street, city].filter(Boolean).join(', ') || undefined,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
