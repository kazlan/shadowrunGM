export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (isLocalDev()) {
    window.addEventListener('load', () => {
      void clearLocalServiceWorkers();
    });
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}

async function clearLocalServiceWorkers() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn('Local service worker cleanup failed', error);
  }
}

function isLocalDev() {
  return import.meta.env?.DEV || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}
