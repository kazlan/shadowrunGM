import { roundPosition } from './privacy.js';

export function requestCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este dispositivo no expone geolocalización web.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(roundPosition({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }));
      },
      (error) => reject(new Error(geolocationErrorMessage(error))),
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 10 * 1000,
      },
    );
  });
}

function geolocationErrorMessage(error) {
  if (error.code === error.PERMISSION_DENIED) return 'permiso denegado';
  if (error.code === error.POSITION_UNAVAILABLE) return 'posición no disponible';
  if (error.code === error.TIMEOUT) return 'tiempo de espera agotado';
  return 'error desconocido de geolocalización';
}
