import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import { firebaseFirestoreDatabaseId, getFirebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

let app = null;
let auth = null;
let db = null;
let messagingPromise = null;

export function getFirebaseStatus() {
  return {
    configured: isFirebaseConfigured(),
    databaseId: firebaseFirestoreDatabaseId,
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
  auth ??= initializeFirebaseAuth(activeApp);
  return auth;
}

function initializeFirebaseAuth(activeApp) {
  try {
    return initializeAuth(activeApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (error) {
    return getAuth(activeApp);
  }
}

export function getFirebaseDb() {
  const activeApp = getFirebaseApp();
  if (!activeApp) return null;
  db ??= firebaseFirestoreDatabaseId === '(default)'
    ? getFirestore(activeApp)
    : getFirestore(activeApp, firebaseFirestoreDatabaseId);
  return db;
}

export async function getFirebaseMessaging() {
  const activeApp = getFirebaseApp();
  if (!activeApp) return null;
  messagingPromise ??= isSupported().then((supported) => (supported ? getMessaging(activeApp) : null));
  return messagingPromise;
}
