import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getFirebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

let app = null;
let auth = null;
let db = null;
let messagingPromise = null;

export function getFirebaseStatus() {
  return {
    configured: isFirebaseConfigured(),
    projectId: getFirebaseConfig()?.projectId ?? null,
  };
}

export function getFirebaseApp() {
  const config = getFirebaseConfig();
  if (!config) return null;
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(config);
  return app;
}

export function getFirebaseAuth() {
  const activeApp = getFirebaseApp();
  if (!activeApp) return null;
  auth ??= getAuth(activeApp);
  return auth;
}

export function getFirebaseDb() {
  const activeApp = getFirebaseApp();
  if (!activeApp) return null;
  db ??= getFirestore(activeApp);
  return db;
}

export async function getFirebaseMessaging() {
  const activeApp = getFirebaseApp();
  if (!activeApp) return null;
  messagingPromise ??= isSupported().then((supported) => (supported ? getMessaging(activeApp) : null));
  return messagingPromise;
}
