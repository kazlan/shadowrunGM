import { linkCurrentUserWithGoogle, observeAuthState, resolveAuthRedirect, signInGuest, signInWithGoogle, signOutUser } from './authClient.js';
import { getFirebaseStatus } from './firebaseClient.js';
import { loadDeckProfileRemote, saveDeckProfileRemote, saveHostProgressRemote } from './cloudPersistence.js';
import { loadDeckProfile, normalizeDeckProfile, saveDeckProfile } from '../world/deckStore.js';

const disabledState = {
  configured: false,
  databaseId: '(default)',
  projectId: null,
  user: null,
  status: 'disabled',
  message: 'Firebase no configurado.',
  lastSyncedAt: null,
};

export function createCloudSyncController({ onDeckLoaded, onStatusChange } = {}) {
  const firebaseStatus = getFirebaseStatus();
  let state = {
    ...disabledState,
    configured: firebaseStatus.configured,
    databaseId: firebaseStatus.databaseId,
    projectId: firebaseStatus.projectId,
    status: firebaseStatus.configured ? 'signed-out' : 'disabled',
    message: firebaseStatus.configured ? 'Cloud listo. Conecta una cuenta.' : disabledState.message,
  };
  let activeUser = null;
  let disposed = false;

  const setState = (patch) => {
    state = { ...state, ...patch };
    onStatusChange?.(getState());
  };

  const unsubscribe = observeAuthState((user) => {
    if (disposed) return;
    activeUser = user;
    if (!user) {
      setState({
        user: null,
        status: firebaseStatus.configured ? 'signed-out' : 'disabled',
        message: firebaseStatus.configured ? 'Cloud desconectado.' : disabledState.message,
      });
      return;
    }

    void loadRemoteDeck(user);
  });

  if (firebaseStatus.configured) {
    void completeRedirectSignIn();
  }

  async function loadRemoteDeck(user) {
    setState({
      user: projectUser(user),
      status: 'syncing',
      message: 'Sincronizando deck...',
    });

    try {
      const localProfile = loadDeckProfile();
      const remoteProfile = await loadDeckProfileRemote(user.uid);
      const mergedProfile = mergeDeckProfiles(localProfile, remoteProfile);
      const savedProfile = saveDeckProfile(mergedProfile);
      await saveDeckProfileRemote(user.uid, savedProfile);
      onDeckLoaded?.(savedProfile);
      setState({
        user: projectUser(user),
        status: 'connected',
        message: remoteProfile ? 'Deck sincronizado.' : 'Deck subido a Nexus.',
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (error) {
      setState({
        user: projectUser(user),
        status: 'error',
        message: syncErrorMessage(error),
      });
    }
  }

  async function syncDeckProfile(profile) {
    if (!activeUser) return { ok: false, reason: 'signed-out' };
    setState({ status: 'syncing', message: 'Subiendo deck...' });
    try {
      const normalized = normalizeDeckProfile(profile);
      await saveDeckProfileRemote(activeUser.uid, normalized);
      setState({
        user: projectUser(activeUser),
        status: 'connected',
        message: 'Deck sincronizado.',
        lastSyncedAt: new Date().toISOString(),
      });
      return { ok: true };
    } catch (error) {
      setState({ status: 'error', message: syncErrorMessage(error) });
      return { ok: false, reason: 'error', error };
    }
  }

  async function syncHostProgress(progressEntry) {
    if (!activeUser) return { ok: false, reason: 'signed-out' };
    try {
      await saveHostProgressRemote(activeUser.uid, progressEntry);
      setState({
        user: projectUser(activeUser),
        status: 'connected',
        message: 'Progreso sincronizado.',
        lastSyncedAt: new Date().toISOString(),
      });
      return { ok: true };
    } catch (error) {
      setState({ status: 'error', message: syncErrorMessage(error) });
      return { ok: false, reason: 'error', error };
    }
  }

  return {
    dispose() {
      disposed = true;
      unsubscribe();
    },
    getState,
    signInGuest: () => signInWithStatus(signInGuest, 'Abriendo sesion invitada...'),
    signInGoogle: () => signInWithStatus(signInWithGoogle, 'Saliendo hacia Google...'),
    linkGoogle: () => signInWithStatus(linkCurrentUserWithGoogle, 'Vinculando Google...'),
    signOut: signOutWithStatus,
    syncDeckProfile,
    syncHostProgress,
  };

  function getState() {
    return { ...state };
  }

  async function signInWithStatus(signIn, message) {
    if (!firebaseStatus.configured) return { ok: false, reason: 'disabled' };
    setState({ status: 'authenticating', message });
    try {
      await signIn();
      return { ok: true };
    } catch (error) {
      setState({ status: 'error', message: authErrorMessage(error) });
      return { ok: false, reason: 'error', error };
    }
  }

  async function signOutWithStatus() {
    if (!firebaseStatus.configured) return { ok: false, reason: 'disabled' };
    setState({ status: 'authenticating', message: 'Cerrando sesion...' });
    try {
      await signOutUser();
      return { ok: true };
    } catch (error) {
      setState({ status: 'error', message: authErrorMessage(error) });
      return { ok: false, reason: 'error', error };
    }
  }

  async function completeRedirectSignIn() {
    try {
      const result = await resolveAuthRedirect();
      if (!result?.user) {
        if (!activeUser) {
          setState({ status: 'signed-out', message: 'Cloud listo. Conecta una cuenta.' });
        }
        return;
      }
      activeUser = result.user;
      await loadRemoteDeck(result.user);
    } catch (error) {
      setState({ status: 'error', message: authErrorMessage(error) });
    }
  }
}

export function mergeDeckProfiles(localProfile, remoteProfile) {
  const local = normalizeDeckProfile(localProfile);
  if (!remoteProfile) return local;

  const remote = normalizeDeckProfile(remoteProfile);
  const base = remote.totalEarned > local.totalEarned ? remote : local;
  return normalizeDeckProfile({
    ...base,
    bookmarks: mergeBookmarks(local.bookmarks, remote.bookmarks),
    player: mergePlayerProfiles(local.player, remote.player),
  });
}

function mergeBookmarks(localBookmarks, remoteBookmarks) {
  const bySeed = new Map();
  for (const bookmark of [...remoteBookmarks, ...localBookmarks]) {
    const previous = bySeed.get(bookmark.seedId);
    if (!previous || String(bookmark.savedAt).localeCompare(String(previous.savedAt)) > 0) {
      bySeed.set(bookmark.seedId, bookmark);
    }
  }

  return [...bySeed.values()].sort((left, right) => String(right.savedAt).localeCompare(String(left.savedAt)));
}

function mergePlayerProfiles(localPlayer, remotePlayer) {
  const localHasCustomIdentity = localPlayer.shadowName !== 'NEON GHOST' || localPlayer.avatar !== 'runner01';
  const remoteHasCustomIdentity = remotePlayer.shadowName !== 'NEON GHOST' || remotePlayer.avatar !== 'runner01';
  if (localHasCustomIdentity) return localPlayer;
  if (remoteHasCustomIdentity) return remotePlayer;
  return remotePlayer;
}

function projectUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    isAnonymous: Boolean(user.isAnonymous),
  };
}

function syncErrorMessage(error) {
  const code = error?.code ? ` (${error.code})` : '';
  return `Cloud sin sincronizar${code}.`;
}

function authErrorMessage(error) {
  if (error?.code === 'auth/network-request-failed') {
    return 'No se pudo conectar con Google/Firebase. Revisa red, dominio autorizado o bloqueo del navegador.';
  }
  if (error?.code === 'auth/unauthorized-domain') {
    return 'Dominio no autorizado en Firebase Auth. Anade este host en Authentication > Settings > Authorized domains.';
  }
  if (error?.code === 'auth/operation-not-supported-in-this-environment') {
    return 'Este navegador no permite completar el redirect de Google en este entorno.';
  }
  const code = error?.code ? ` (${error.code})` : '';
  return `No se pudo iniciar sesion${code}.`;
}
