export function roundPosition(position, decimals = 4) {
  return {
    lat: Number(position.lat.toFixed(decimals)),
    lon: Number(position.lon.toFixed(decimals)),
  };
}
