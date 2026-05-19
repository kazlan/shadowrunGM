# Firebase y Firestore

`shadowHack` queda preparado para usar Firebase como capa opcional de nube. Si no hay variables `VITE_FIREBASE_*`, la app sigue funcionando con persistencia local.

## Variables necesarias

Copiar `.env.example` a `.env.local` y completar:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_FIRESTORE_DATABASE_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_MESSAGING_VAPID_KEY=
VITE_FIREBASE_ENABLE_MESSAGING=false
VITE_TARGETS_ENDPOINT=
```

`MEASUREMENT_ID` es opcional. `VAPID_KEY` y `ENABLE_MESSAGING=true` solo son necesarios para Web Push/FCM.

Para el proyecto Firebase **nexus** (`nexus-f20f5`) se usa una base Firestore Native nombrada, creada en `europe-southwest1`:

```text
VITE_FIREBASE_FIRESTORE_DATABASE_ID=shadowhack
```

La base `(default)` del proyecto Nexus esta en `DATASTORE_MODE`, asi que no se usa desde el SDK web de Firebase.

## Servicios previstos

- **Authentication**: login anónimo, Google con redirect, email/password preparado y vinculación de invitado con Google en `src/firebase/authClient.js`.
- **Cloud Firestore**: helpers iniciales en `src/firebase/cloudPersistence.js`.
- **Cloud sync**: controlador offline-first en `src/firebase/cloudSync.js`, conectado a ajustes, deck y resultados de run.
- **Cloud Messaging**: token Web Push mediante `src/firebase/messagingClient.js` y handler genérico en `public/service-worker.js`.
- **Cloud Functions**: backend opcional para scanner real con cache Firestore, Overpass y Geoapify como fallback privado.

## Estructura Firestore v1

```text
users/{uid}/deck/profile
users/{uid}/hostProgress/{seedId}
users/{uid}/messagingTokens/{tokenId}
placesCache/{cacheKey}
scanRateLimits/{fingerprint}
```

Datos previstos:

- `deck/profile`: créditos, total ganado, stats, hardware, programas desbloqueados, bookmarks y última recompensa.
- `hostProgress/{seedId}`: alias, tier, valor, runs completadas, mejor puntuación y timestamps.
- `messagingTokens/{tokenId}`: token FCM, plataforma, userAgent opcional y timestamp.
- `placesCache/{cacheKey}`: cache compartida de objetivos cercanos por celda aproximada; solo la Admin SDK de Functions debe leer/escribir.
- `scanRateLimits/{fingerprint}`: contador diario anonimo para proteger el backend del scanner sin guardar IP cruda.

## Decisiones pendientes

- Activar en Firebase Console los proveedores de Auth que se vayan a usar: anónimo y Google para v1.
- Google Auth usa `signInWithRedirect` para móvil/PWA; la pantalla de Google no se puede personalizar, pero el panel previo vive en ajustes como "Conectar deck a Nexus".
- Si los bookmarks deben ser privados por usuario o exportables/compartibles más adelante.
- Qué tipos de mensajes usaremos: recordatorios, retos, eventos de host, alertas de run asíncrona, etc.
- Reglas de seguridad definitivas antes de activar producción.

## CLI y despliegue

El repo usa Firebase CLI local:

```bash
npm run firebase -- --version
npm run firebase -- projects:list
```

Archivos preparados:

```text
.firebaserc
firebase.json
firestore.rules
firestore.indexes.json
```

Crear la base Firestore Native europea si no existe:

```bash
npm run firebase -- firestore:databases:create shadowhack --location europe-southwest1 --edition standard --project nexus-f20f5
```

Comprobarla:

```bash
npm run firebase -- firestore:databases:get shadowhack --project nexus-f20f5
```

Desplegar reglas:

```bash
npm run firebase -- deploy --only firestore --project nexus-f20f5
```

Backend del scanner:

```bash
npm --prefix functions install
npm run firebase -- functions:secrets:set GEOAPIFY_API_KEY --project nexus-f20f5
npm run firebase -- deploy --only functions,firestore --project nexus-f20f5
```

Antes de desplegar Functions por primera vez, comprobar que la API de Cloud Functions está activa en `nexus-f20f5`. Si `functions:list` devuelve `SERVICE_DISABLED`, activar Cloud Functions API y reintentar:

```bash
npm run firebase -- functions:list --project nexus-f20f5
```

Tras desplegar `getNearbyTargets`, completar `VITE_TARGETS_ENDPOINT` con la URL HTTPS de la Function. En Vercel producción:

```bash
vercel env add VITE_TARGETS_ENDPOINT production
vercel --prod
```

URL esperada para `nexus-f20f5`:

```text
https://europe-southwest1-nexus-f20f5.cloudfunctions.net/getNearbyTargets
```

En local, si esa variable está vacía, el scanner conserva el flujo directo Overpass -> sandbox.

Si el deploy falla indicando que `serviceusage.googleapis.com` esta deshabilitada, activar la **Service Usage API** en Google Cloud para `nexus-f20f5` y reintentar el comando de deploy.

## Notas de seguridad

La configuración pública de Firebase no es una clave secreta, pero debe ir por `.env.local` para separar entornos. Las reglas de Firestore y Auth son la frontera real de seguridad.
