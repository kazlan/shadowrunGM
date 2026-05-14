const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const ALLOWED_RADIUS = [250, 1500];

export function createOverpassProvider(options = {}) {
  const endpoint = options.endpoint ?? OVERPASS_ENDPOINT;

  return {
    async searchNearbyPlaces(position, radiusMeters = 900) {
      const radius = clamp(Math.round(radiusMeters), ALLOWED_RADIUS[0], ALLOWED_RADIUS[1]);
      const query = buildOverpassQuery(position, radius);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
      });

      if (!response.ok) {
        throw new Error(`Overpass respondió ${response.status}`);
      }

      const payload = await response.json();
      return normalizeOverpassElements(payload.elements ?? []).slice(0, 24);
    },
  };
}

function buildOverpassQuery(position, radius) {
  return `[out:json][timeout:12];
(
  node["name"]["amenity"](around:${radius},${position.lat},${position.lon});
  node["name"]["shop"](around:${radius},${position.lat},${position.lon});
  node["name"]["office"](around:${radius},${position.lat},${position.lon});
  node["name"]["craft"](around:${radius},${position.lat},${position.lon});
  way["name"]["amenity"](around:${radius},${position.lat},${position.lon});
  way["name"]["shop"](around:${radius},${position.lat},${position.lon});
  way["name"]["office"](around:${radius},${position.lat},${position.lon});
  way["name"]["craft"](around:${radius},${position.lat},${position.lon});
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

  const category = tags.amenity ?? tags.shop ?? tags.office ?? tags.craft ?? 'unknown';
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
