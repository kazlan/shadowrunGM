import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCacheKey,
  mergePlaces,
  normalizeTargetRequest,
  resolveNearbyTargets,
} from '../src/targetSearch.js';

test('cache key is stable inside the same 500m-ish cell', () => {
  const left = createCacheKey({ lat: 39.4699, lon: -0.3763, radius: 700, limit: 10, minTargets: 4 });
  const right = createCacheKey({ lat: 39.4701, lon: -0.3761, radius: 700, limit: 10, minTargets: 4 });
  assert.equal(left, right);
});

test('request normalization clamps gameplay limits', () => {
  const request = normalizeTargetRequest({ lat: 39.4, lon: -0.3, radius: 5000, limit: 50, minTargets: 99 });
  assert.equal(request.radius, 3000);
  assert.equal(request.limit, 10);
  assert.equal(request.minTargets, 10);
  assert.throws(() => normalizeTargetRequest({ lat: 300, lon: -0.3 }), /Invalid lat\/lon/);
});

test('overpass success avoids geoapify', async () => {
  const calls = [];
  const db = createMockDb();
  const result = await resolveNearbyTargets({
    db,
    geoapifyApiKey: 'geo-key',
    input: { lat: 39.4699, lon: -0.3763, radius: 700, limit: 10, minTargets: 2 },
    fetchImpl: async (url) => {
      calls.push(String(url));
      return okJson({ elements: [
        overpassElement(1, 'Alpha Cafe'),
        overpassElement(2, 'Beta Shop'),
      ] });
    },
  });
  assert.equal(result.source, 'overpass');
  assert.equal(result.providerHealth.geoapify, 'not_needed');
  assert.equal(calls.some((url) => url.includes('geoapify')), false);
});

test('partial overpass merges with geoapify fallback', async () => {
  const result = await resolveNearbyTargets({
    db: createMockDb(),
    geoapifyApiKey: 'geo-key',
    input: { lat: 39.4699, lon: -0.3763, radius: 700, limit: 10, minTargets: 4 },
    fetchImpl: async (url) => {
      if (String(url).includes('geoapify')) {
        return okJson({ features: [
          geoFeature('g1', 'Gamma Office', -0.3762, 39.4701),
          geoFeature('g2', 'Delta Clinic', -0.3764, 39.4702),
          geoFeature('g3', 'Epsilon Data', -0.3765, 39.4703),
        ] });
      }
      return okJson({ elements: [overpassElement(1, 'Alpha Cafe')] });
    },
  });
  assert.equal(result.source, 'mixed');
  assert.equal(result.places.length, 4);
  assert.equal(result.providerHealth.overpass, 'partial');
  assert.equal(result.providerHealth.geoapify, 'ok');
});

test('overpass failure falls back to geoapify', async () => {
  const result = await resolveNearbyTargets({
    db: createMockDb(),
    geoapifyApiKey: 'geo-key',
    input: { lat: 39.4699, lon: -0.3763, radius: 700, limit: 10, minTargets: 2 },
    fetchImpl: async (url) => {
      if (String(url).includes('geoapify')) {
        return okJson({ features: [
          geoFeature('g1', 'Gamma Office', -0.3762, 39.4701),
          geoFeature('g2', 'Delta Clinic', -0.3764, 39.4702),
        ] });
      }
      return { ok: false, status: 504, json: async () => ({}) };
    },
  });
  assert.equal(result.source, 'geoapify');
  assert.equal(result.places.length, 2);
  assert.equal(result.providerHealth.overpass, 'failed');
});

test('thin search expands radius before returning empty real targets', async () => {
  const radii = [];
  const result = await resolveNearbyTargets({
    db: createMockDb(),
    geoapifyApiKey: '',
    input: { lat: 39.4699, lon: -0.3763, radius: 700, limit: 10, minTargets: 2 },
    fetchImpl: async (url, options = {}) => {
      assert.equal(String(url).includes('geoapify'), false);
      const query = options.body?.get?.('data') ?? String(options.body ?? '');
      const radius = Number(query.match(/around:(\d+)/)?.[1] ?? 0);
      radii.push(radius);
      if (radius >= 3000) {
        return okJson({ elements: [
          overpassElement(10, 'Wide Alpha'),
          overpassElement(11, 'Wide Beta'),
        ] });
      }
      return okJson({ elements: [] });
    },
  });
  assert.deepEqual(radii, [700, 3000]);
  assert.equal(result.radius, 3000);
  assert.equal(result.source, 'overpass');
  assert.equal(result.places.length, 2);
});

test('providers failure returns stale cache when available', async () => {
  const db = createMockDb();
  const key = createCacheKey({ lat: 39.4699, lon: -0.3763, radius: 700, limit: 10, minTargets: 1 });
  db.seed('placesCache', key, {
    source: 'overpass',
    places: [{ provider: 'osm', providerId: 'node/1', name: 'Cached Host', category: 'shop', lat: 39.47, lon: -0.376 }],
    expiresAt: new Date(Date.now() - 1000),
    staleUntil: new Date(Date.now() + 1000 * 60),
    providerHealth: { overpass: 'ok', geoapify: 'not_needed' },
  });
  const result = await resolveNearbyTargets({
    db,
    geoapifyApiKey: '',
    input: { lat: 39.4699, lon: -0.3763, radius: 700, limit: 10, minTargets: 1 },
    fetchImpl: async () => ({ ok: false, status: 504, json: async () => ({}) }),
  });
  assert.equal(result.cacheState, 'stale');
  assert.equal(result.places[0].name, 'Cached Host');
});

test('without real providers or stale cache returns empty for sandbox fill', async () => {
  const result = await resolveNearbyTargets({
    db: createMockDb(),
    geoapifyApiKey: '',
    input: { lat: 39.4699, lon: -0.3763, radius: 700, limit: 10, minTargets: 4 },
    fetchImpl: async () => ({ ok: false, status: 504, json: async () => ({}) }),
  });
  assert.equal(result.source, 'empty');
  assert.equal(result.places.length, 0);
});

test('merge prefers osm for near duplicate names', () => {
  const places = mergePlaces(
    [{ provider: 'geoapify', providerId: 'geo/1', name: 'Same Place', category: 'shop', lat: 39.47, lon: -0.376 }],
    [{ provider: 'osm', providerId: 'node/1', name: 'Same Place', category: 'shop', lat: 39.4701, lon: -0.3761 }],
  );
  assert.equal(places.length, 1);
  assert.equal(places[0].provider, 'osm');
});

function overpassElement(id, name) {
  return {
    type: 'node',
    id,
    lat: 39.4699 + id * 0.0001,
    lon: -0.3763 - id * 0.0001,
    tags: { name, amenity: 'cafe' },
  };
}

function geoFeature(id, name, lon, lat) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      place_id: id,
      name,
      categories: ['commercial'],
      address_line2: 'Geoapify Street',
      distance: 42,
    },
  };
}

function okJson(payload) {
  return { ok: true, status: 200, json: async () => payload };
}

function createMockDb() {
  const stores = new Map();
  const getStore = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };
  return {
    seed(collection, id, value) {
      getStore(collection).set(id, value);
    },
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              const store = getStore(name);
              const data = store.get(id);
              return {
                exists: Boolean(data),
                data: () => data,
              };
            },
            async set(value) {
              getStore(name).set(id, value);
            },
          };
        },
      };
    },
  };
}
