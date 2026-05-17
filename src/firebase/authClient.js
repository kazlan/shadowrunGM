import {
  getRedirectResult,
  GoogleAuthProvider,
  linkWithRedirect,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebaseClient.js';

export function observeAuthState(callback) {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInGuest() {
  const auth = requireAuth();
  return signInAnonymously(auth);
}

export async function signInWithGoogle() {
  const auth = requireAuth();
  return signInWithRedirect(auth, createGoogleProvider());
}

export async function linkCurrentUserWithGoogle() {
  const auth = requireAuth();
  if (!auth.currentUser) return signInWithGoogle();
  return linkWithRedirect(auth.currentUser, createGoogleProvider());
}

export async function resolveAuthRedirect() {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  return getRedirectResult(auth);
}

export async function signInWithEmail(email, password) {
  const auth = requireAuth();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  const auth = requireAuth();
  return signOut(auth);
}

function requireAuth() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase no está configurado.');
  return auth;
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
