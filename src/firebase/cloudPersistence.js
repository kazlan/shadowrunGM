import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from './firebaseClient.js';

export const cloudPaths = {
  deckProfile: (uid) => ['users', uid, 'deck', 'profile'],
  hostProgress: (uid, seedId) => ['users', uid, 'hostProgress', seedId],
  messagingToken: (uid, token) => ['users', uid, 'messagingTokens', tokenToDocId(token)],
};

export async function saveDeckProfileRemote(uid, deckProfile) {
  const db = requireDb();
  await setDoc(doc(db, ...cloudPaths.deckProfile(uid)), {
    ...deckProfile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function loadDeckProfileRemote(uid) {
  const db = requireDb();
  const snapshot = await getDoc(doc(db, ...cloudPaths.deckProfile(uid)));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveHostProgressRemote(uid, progressEntry) {
  const db = requireDb();
  if (!progressEntry?.seedId) throw new Error('Host progress needs seedId.');
  await setDoc(doc(db, ...cloudPaths.hostProgress(uid, progressEntry.seedId)), {
    ...progressEntry,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function saveMessagingTokenRemote(uid, token, metadata = {}) {
  const db = requireDb();
  await setDoc(doc(db, ...cloudPaths.messagingToken(uid, token)), {
    token,
    platform: 'web',
    ...metadata,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function userCollection(uid, name) {
  return collection(requireDb(), 'users', uid, name);
}

function requireDb() {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase no está configurado.');
  return db;
}

function tokenToDocId(token) {
  return encodeURIComponent(token).replaceAll('.', '%2E');
}
