# Propuesta: conexion Firebase y sincronizacion cloud

## Resumen

La app ya tiene Firebase preparado como capa opcional, pero el juego sigue funcionando 100% local. El objetivo de esta propuesta es convertir esos helpers en una sincronizacion real sin perder el modo offline-first.

Estado actual:

- `firebase` esta instalado.
- `src/firebase/firebaseConfig.js` detecta variables `VITE_FIREBASE_*`.
- `src/firebase/firebaseClient.js` inicializa App, Auth, Firestore y Messaging.
- `src/firebase/authClient.js` expone login anonimo, Google, email/password y logout.
- `src/firebase/cloudPersistence.js` guarda deck, progreso de host y tokens FCM.
- `src/firebase/messagingClient.js` puede pedir token Web Push si Messaging esta activo.
- `src/app/main.js` todavia no usa nada de lo anterior.

## Objetivo v1

Implementar una sincronizacion discreta y robusta:

- La app arranca sin Firebase si no hay `.env.local`.
- El usuario puede jugar offline como ahora.
- Si inicia sesion, se sincronizan deck, bookmarks y progreso.
- Los cambios locales se guardan en `localStorage` y se suben a Firestore cuando hay usuario.
- Los errores de nube no bloquean la run.

## Alcance v1

Incluido:

- Auth anonimo y Google.
- Carga inicial de deck remoto.
- Merge simple local/remoto.
- Guardado remoto de deck al mejorar, cobrar recompensa o guardar bookmark.
- Guardado remoto de progreso al cerrar una run.
- Estado visual basico de cuenta/sync.
- Reglas Firestore minimas para datos privados por usuario.

Fuera de v1:

- Sincronizacion realtime con `onSnapshot`.
- Resolucion compleja de conflictos multi-dispositivo.
- Compartir bookmarks entre usuarios.
- Panel de administracion.
- Cloud Functions para notificaciones automaticas.

## Decisiones pendientes

- Login principal: empezar con anonimo + Google es lo mas simple.
- Merge de deck: elegir remoto si tiene mayor `totalEarned`; mezclar bookmarks por `seedId`.
- Merge de progreso: por cada `seedId`, conservar mayor `bestScore`, sumar/usar maximo razonable en `attempts` y mantener `lastPlayedAt` mas reciente.
- Messaging: dejarlo detras de un boton explicito, no pedir permisos al arrancar.

## Fase 1: capa de sincronizacion

Crear `src/firebase/cloudSync.js`.

Responsabilidades:

- Observar sesion con `observeAuthState`.
- Exponer estado: `configured`, `user`, `status`, `message`, `lastSyncedAt`.
- Cargar deck remoto con `loadDeckProfileRemote(uid)`.
- Hacer merge remoto/local.
- Guardar el deck mergeado en local con `saveDeckProfile`.
- Subir deck con `saveDeckProfileRemote(uid, profile)`.
- Subir progreso con `saveHostProgressRemote(uid, progressEntry)`.
- Capturar errores y devolver mensajes no fatales.

Accionables:

- [ ] Crear `cloudSync.js`.
- [ ] Crear `mergeDeckProfiles(localProfile, remoteProfile)`.
- [ ] Crear `mergeHostProgress(localEntry, remoteEntry)` aunque v1 solo use guardado remoto.
- [ ] Crear `createCloudSyncController({ onDeckLoaded, onStatusChange })`.
- [ ] Añadir tests/checks basicos en `scripts/check.mjs`.

## Fase 2: conectar `main.js`

Puntos de integracion:

- Al arrancar: inicializar controlador cloud.
- Al cambiar auth: si hay usuario, cargar/mergear deck y renderizar.
- En upgrades: despues de `upgradeDeckProfile`, subir deck.
- En recompensa: despues de `awardRunCredits`, subir deck.
- En bookmark: despues de `addHostBookmark`, subir deck.
- En resultado de run: despues de `recordRunResult`, subir progreso.

Accionables:

- [ ] Importar controlador cloud en `src/app/main.js`.
- [ ] Añadir `cloud` a `appState`.
- [ ] Evitar que errores remotos rompan `dispatch`, `syncRunResult` o overlays.
- [ ] Centralizar guardado remoto en helpers tipo `syncDeckProfile()` y `syncProgressEntry(entry)`.
- [ ] Mostrar mensaje breve en deck/settings cuando la nube sincroniza o falla.

## Fase 3: UI de cuenta

Ubicacion recomendada: `renderSettingsOverlay`, porque ya concentra ajustes y acciones globales.

Controles v1:

- Estado: `Cloud offline`, `Firebase no configurado`, `Conectado`, `Sincronizando`, `Error sync`.
- Boton `Invitado` para `signInGuest`.
- Boton `Google` para `signInWithGoogle`.
- Boton `Salir` para `signOutUser`.

Accionables:

- [ ] Extender `renderSettingsOverlay(isOpen, audioState, activeTheme, cloudState)`.
- [ ] Añadir bloque `settings-cloud`.
- [ ] Añadir eventos `data-action="signInGuest"`, `signInGoogle`, `signOutCloud`.
- [ ] Mantener la UI compacta para movil.
- [ ] No mostrar email completo si no cabe; usar displayName/email truncado.

## Fase 4: Firestore y seguridad

Crear archivos de configuracion Firebase si decidimos versionarlos:

- `firebase.json`
- `firestore.rules`
- opcional: `firestore.indexes.json`

Reglas minimas:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Accionables:

- [ ] Crear reglas privadas por usuario.
- [ ] Documentar despliegue en `docs/firebase.md`.
- [ ] Confirmar que Auth anonimo y Google estan activados en Firebase Console.
- [ ] Confirmar dominios autorizados para local y produccion.

## Fase 5: Messaging opcional

Messaging debe ser opt-in. No pedir permiso de notificaciones durante el primer arranque.

Flujo:

- Usuario inicia sesion.
- Usuario pulsa `Activar avisos`.
- Se llama a `getAppServiceWorkerRegistration()`.
- Se llama a `requestMessagingPermission({ serviceWorkerRegistration })`.
- Si devuelve token, se guarda con `saveMessagingTokenRemote(uid, token, metadata)`.
- `listenForegroundMessages` muestra mensaje no intrusivo en UI.

Accionables:

- [ ] Añadir boton `Activar avisos` en ajustes solo si Firebase Messaging esta configurado.
- [ ] Guardar token con userAgent y fecha.
- [ ] Mostrar resultado: concedido, rechazado, no soportado o no configurado.
- [ ] Probar con `VITE_FIREBASE_ENABLE_MESSAGING=true`.

## Fase 6: QA

Comandos:

```bash
npm run check
npm run build
```

Pruebas manuales:

- Sin `.env.local`, la app arranca y juega como ahora.
- Con `.env.local`, Firebase se detecta pero no obliga a login.
- Login anonimo crea `users/{uid}/deck/profile`.
- Completar run crea/actualiza `users/{uid}/hostProgress/{seedId}`.
- Mejorar programa actualiza deck remoto.
- Guardar bookmark se refleja en deck remoto.
- Cerrar sesion deja el deck local disponible.
- Simular error de red no rompe la run.

## Riesgos

- Conflictos multi-dispositivo: v1 debe ser conservadora y documentar que el merge es simple.
- Login anonimo: si el usuario borra navegador puede perder identidad anonima salvo que enlace con Google despues.
- Firestore writes excesivos: guardar solo en eventos importantes, no en cada accion de la run.
- Messaging local: el service worker se desactiva en dev salvo `VITE_FIREBASE_ENABLE_MESSAGING=true`.

## Orden recomendado

1. Implementar `cloudSync.js`.
2. Conectar guardado remoto de deck/progreso sin UI nueva.
3. Añadir UI de cuenta en ajustes.
4. Añadir reglas Firestore y documentacion.
5. Añadir Messaging opt-in.
6. Ejecutar checks y prueba manual con proyecto Firebase real.
