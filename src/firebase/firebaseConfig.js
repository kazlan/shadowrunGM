const firebaseEnv = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env?.VITE_FIREBASE_APP_ID ?? '',
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID ?? '',
};

export const firebaseVapidKey = import.meta.env?.VITE_FIREBASE_MESSAGING_VAPID_KEY ?? '';
export const firebaseMessagingEnabled = import.meta.env?.VITE_FIREBASE_ENABLE_MESSAGING === 'true';
export const firebaseFirestoreDatabaseId = import.meta.env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID ?? '(default)';

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];

export function isFirebaseConfigured() {
  return requiredConfigKeys.every((key) => Boolean(firebaseEnv[key]));
}

export function isFirebaseMessagingConfigured() {
  return isFirebaseConfigured() && firebaseMessagingEnabled && Boolean(firebaseVapidKey);
}

export function getFirebaseConfig() {
  if (!isFirebaseConfigured()) return null;
  return Object.fromEntries(
    Object.entries(firebaseEnv).filter(([, value]) => Boolean(value)),
  );
}
