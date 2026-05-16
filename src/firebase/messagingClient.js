import { getToken, onMessage } from 'firebase/messaging';
import { firebaseVapidKey, isFirebaseMessagingConfigured } from './firebaseConfig.js';
import { getFirebaseMessaging } from './firebaseClient.js';

export async function requestMessagingPermission({ serviceWorkerRegistration } = {}) {
  if (!isFirebaseMessagingConfigured()) {
    return { ok: false, reason: 'not-configured', token: null };
  }

  if (!('Notification' in globalThis)) {
    return { ok: false, reason: 'unsupported', token: null };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: permission, token: null };
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) return { ok: false, reason: 'unsupported', token: null };

  const token = await getToken(messaging, {
    vapidKey: firebaseVapidKey,
    serviceWorkerRegistration,
  });

  return token
    ? { ok: true, reason: 'granted', token }
    : { ok: false, reason: 'empty-token', token: null };
}

export async function listenForegroundMessages(callback) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
