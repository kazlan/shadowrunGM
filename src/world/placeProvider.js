export const demoPlaces = [
  {
    provider: 'manual',
    providerId: 'demo-cafe-kitsune',
    name: 'Café Kitsune',
    category: 'cafe food',
    lat: 40.41677,
    lon: -3.70379,
    address: 'Objetivo de demostración',
  },
  {
    provider: 'manual',
    providerId: 'demo-clinica-norte',
    name: 'Clínica Norte',
    category: 'medical clinic',
    lat: 40.41715,
    lon: -3.70412,
    address: 'Objetivo de demostración',
  },
  {
    provider: 'manual',
    providerId: 'demo-banco-delta',
    name: 'Banco Delta',
    category: 'finance bank',
    lat: 40.41801,
    lon: -3.70221,
    address: 'Objetivo de demostración',
  },
  {
    provider: 'manual',
    providerId: 'demo-dataforge',
    name: 'Dataforge Repair',
    category: 'computer tech repair',
    lat: 40.41844,
    lon: -3.70152,
    address: 'Objetivo de demostración',
  },
];

export function createDemoNearbyProvider() {
  return {
    async searchNearbyPlaces(position, radiusMeters = 900) {
      const spread = Math.min(Math.max(radiusMeters, 250), 1500) / 111_320;
      return demoPlaces.map((place, index) => ({
        ...place,
        provider: 'manual',
        providerId: `${place.providerId}-nearby-${position.lat.toFixed(3)}-${position.lon.toFixed(3)}`,
        lat: position.lat + spread * (index + 1) * 0.08,
        lon: position.lon - spread * (index + 1) * 0.06,
        address: 'Objetivo demo generado cerca de tu posición aproximada',
      }));
    },
  };
}

export async function searchNearbyPlaces(provider, position, radiusMeters) {
  const places = await provider.searchNearbyPlaces(position, radiusMeters);
  return places.filter((place) => place.name && place.providerId);
}
