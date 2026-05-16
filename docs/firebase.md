# Firebase y Firestore

`shadowHack` queda preparado para usar Firebase como capa opcional de nube. Si no hay variables `VITE_FIREBASE_*`, la app sigue funcionando con persistencia local.

## Variables necesarias

Copiar `.env.example` a `.env.local` y completar:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_MESSAGING_VAPID_KEY=
VITE_FIREBASE_ENABLE_MESSAGING=false
```

`MEASUREMENT_ID` es opcional. `VAPID_KEY` y `ENABLE_MESSAGING=true` solo son necesarios para Web Push/FCM.

## Servicios previstos

- **Authentication**: login anónimo, Google y email/password preparados en `src/firebase/authClient.js`.
- **Cloud Firestore**: helpers iniciales en `src/firebase/cloudPersistence.js`.
- **Cloud Messaging**: token Web Push mediante `src/firebase/messagingClient.js` y handler genérico en `public/service-worker.js`.

## Estructura Firestore v1

```text
users/{uid}/deck/profile
users/{uid}/hostProgress/{seedId}
users/{uid}/messagingTokens/{tokenId}
```

Datos previstos:

- `deck/profile`: créditos, total ganado, stats, hardware, programas desbloqueados, bookmarks y última recompensa.
- `hostProgress/{seedId}`: alias, tier, valor, runs completadas, mejor puntuación y timestamps.
- `messagingTokens/{tokenId}`: token FCM, plataforma, userAgent opcional y timestamp.

## Decisiones pendientes

- Proveedor de login principal: Google, email/password, anónimo o mezcla.
- Si el progreso local debe sincronizarse automáticamente al iniciar sesión o solo con un botón.
- Si los bookmarks deben ser privados por usuario o exportables/compartibles más adelante.
- Qué tipos de mensajes usaremos: recordatorios, retos, eventos de host, alertas de run asíncrona, etc.
- Reglas de seguridad definitivas antes de activar producción.

## Notas de seguridad

La configuración pública de Firebase no es una clave secreta, pero debe ir por `.env.local` para separar entornos. Las reglas de Firestore y Auth son la frontera real de seguridad.
