# Propuesta: adquisicion resiliente de hosts con Overpass, Geoapify y Firestore

## Resumen ejecutivo

El sistema actual de adquisicion de hosts funciona bien cuando Overpass responde, pero las llamadas directas desde el cliente pueden fallar con `Failed to fetch`, timeouts o saturacion de endpoints publicos. La propuesta es mantener Overpass como primera opcion gratuita, pero anadir una cadena de resiliencia con cache compartida en Firestore y Geoapify como fallback controlado.

Flujo objetivo:

```text
1. Firestore cache fresh
2. Firestore cache stale si existe
3. Overpass publico como proveedor principal
4. Geoapify Places API como fallback si Overpass falla o da pocos objetivos
5. Sandbox local como ultimo recurso
```

Objetivo de producto:

- Reducir la probabilidad de llegar al final de una run sin objetivos reales listos.
- Evitar que cada jugador golpee Overpass y Geoapify para la misma zona.
- Mantener coste Geoapify muy bajo usando `limit=10` y llamandolo solo cuando Overpass no sea suficiente.
- Preparar prefetch de zonas cercanas al host actual y bookmarks mientras el jugador esta dentro de una run.

## Estado actual detectado

El cliente ya tiene:

- `src/world/overpassProvider.js` con varios endpoints Overpass y timeout.
- `src/app/main.js` con `searchRealPlaces(position, radius)`, `scanFromPosition(position, successLabel)` y fallback sandbox.
- `MIN_SCANNER_TARGETS = 4` y `EXPANDED_SCAN_RADIUS = 1500`.
- Bookmarks con `lat` y `lon`, utiles como puntos de escaneo remoto.
- Firestore/Firebase ya integrado como capa cloud opcional para deck, progreso y sync.

Problema principal:

- El scanner depende de que Overpass responda en ese momento.
- No existe cache compartida de objetivos por zona.
- El prefetch aun no aprovecha el tiempo de juego para preparar objetivos.
- Si Overpass falla, el sistema cae a sandbox aunque podria consultar un proveedor comercial de fallback.

## Decision recomendada

Mantener Overpass como proveedor principal y usar Geoapify solo como seguro anti-caidas.

```text
Overpass primero porque:
- no consume creditos Geoapify;
- encaja con el modelo OSM actual;
- ya esta implementado.

Geoapify despues porque:
- aporta estabilidad cuando Overpass falla;
- permite controlar coste con limit=10;
- encaja con Places/POIs cercanos;
- puede quedar oculto detras de Cloud Functions para no exponer la API key.
```

## Calculo economico con `limit=10`

Geoapify Places API cobra por bloques de resultados. Para nuestro caso operativo:

```text
limit=10 -> 1 credito por request
limit=20 -> tambien 1 credito por request
```

Por tanto, `limit=10` no reduce creditos frente a `limit=20`, pero si reduce payload, almacenamiento, egress y ruido en la lista de objetivos. Para gameplay normal es suficiente porque solo necesitamos una lista corta de hosts candidatos.

### Formula base

```text
zonas_dia = sesiones_dia * zonas_por_sesion

geoapify_creditos_dia =
  zonas_dia
  * cache_miss_rate
  * geoapify_fallback_rate
```

Donde:

- `cache_miss_rate`: porcentaje de zonas no encontradas frescas en Firestore.
- `geoapify_fallback_rate`: porcentaje de misses donde Overpass falla, timeoutea o devuelve menos de `MIN_SCANNER_TARGETS`.

### Supuesto recomendado

```text
limit Geoapify = 10
zonas_por_sesion = 3
cache hit = 80%
cache miss = 20%
fallback Geoapify tras Overpass = 30%
```

Creditos por sesion:

```text
3 zonas * 0,20 misses * 0,30 fallback = 0,18 creditos/sesion
```

Con 3.000 creditos/dia:

```text
3.000 / 0,18 = ~16.666 sesiones/dia
```

### Escenario malo razonable

```text
zonas_por_sesion = 3
cache hit = 60%
cache miss = 40%
fallback Geoapify tras Overpass = 60%
```

Creditos por sesion:

```text
3 * 0,40 * 0,60 = 0,72 creditos/sesion
```

Con 3.000 creditos/dia:

```text
3.000 / 0,72 = ~4.166 sesiones/dia
```

Incluso en un escenario bastante malo, el tier gratuito de Geoapify podria cubrir una beta moderada si Firestore cachea bien y el prefetch esta limitado.

### Tabla orientativa

| Sesiones/dia | Zonas/sesion | Cache hit | Fallback Geoapify | Creditos Geoapify/dia |
|---:|---:|---:|---:|---:|
| 1.000 | 3 | 80% | 30% | 180 |
| 2.000 | 3 | 80% | 30% | 360 |
| 5.000 | 3 | 80% | 30% | 900 |
| 5.000 | 3 | 80% | 60% | 1.800 |
| 10.000 | 3 | 80% | 30% | 1.800 |
| 10.000 | 3 | 80% | 60% | 3.600 |
| 10.000 | 6 | 80% | 30% | 3.600 |
| 10.000 | 6 | 80% | 60% | 7.200 |

Lectura:

- Con 3 zonas/sesion y cache buena, Geoapify Free puede ser suficiente durante bastante tiempo.
- Si se sube a 6 zonas/sesion por prefetch agresivo, el consumo se duplica.
- API 10 seria el primer plan razonable cuando se superen ~3.000 creditos/dia sostenidos.

## Firestore como backend/cache

Firestore debe estar antes de Overpass y Geoapify. Si no, no reduce fragilidad ni coste.

Orden correcto:

```text
PWA -> Cloud Function / endpoint Firebase -> Firestore cache -> Overpass -> Geoapify -> Firestore cache -> PWA
```

No recomendado:

```text
PWA -> Overpass -> Geoapify -> Firestore
```

Motivo:

- Firestore evita repetir llamadas externas para zonas ya resueltas.
- Cloud Functions oculta la API key de Geoapify.
- Firestore permite compartir cache entre usuarios, sesiones y dispositivos.

### Modelo de cache recomendado

Un documento por zona cacheada, no un documento por place.

Coleccion:

```text
placesCache/{cacheKey}
```

Ejemplo de documento:

```js
{
  key: "v1:ezs42:1500:targets:limit10",
  version: 1,
  geohash: "ezs42",
  lat: 39.47,
  lon: -0.38,
  radius: 1500,
  limit: 10,
  minTargets: 4,
  fetchedAt: Timestamp,
  expiresAt: Timestamp,
  staleUntil: Timestamp,
  source: "overpass" | "geoapify" | "mixed" | "sandbox",
  providerHealth: {
    overpass: "ok" | "partial" | "failed" | "skipped",
    geoapify: "ok" | "not_needed" | "failed" | "skipped"
  },
  places: [
    {
      provider: "osm" | "geoapify",
      providerId: "...",
      name: "...",
      category: "...",
      lat: 39.47,
      lon: -0.38,
      address: "..."
    }
  ],
  count: 10
}
```

Ventajas:

- Leer una zona = 1 Firestore read.
- Actualizar una zona = 1 Firestore write.
- El cliente recibe una lista completa y compacta.
- El coste no escala por numero de places dentro del documento.

### TTL recomendado

```text
fresh TTL: 24 horas
stale TTL: 7-30 dias
```

Flujo:

```text
1. Si hay cache fresh con >= MIN_SCANNER_TARGETS:
   devolver inmediatamente.

2. Si hay cache stale suficiente:
   devolver inmediatamente y refrescar en background.

3. Si no hay cache util:
   intentar Overpass.

4. Si Overpass falla o devuelve pocos:
   llamar Geoapify limit=10.

5. Guardar resultado combinado.

6. Si todo falla:
   sandbox.
```

## Estrategia Overpass + Geoapify

### Regla de decision

```text
Si Overpass devuelve >= MIN_SCANNER_TARGETS:
  no llamar a Geoapify.

Si Overpass devuelve 1-3 objetivos:
  llamar a Geoapify y mezclar resultados.

Si Overpass falla/timeout/Failed to fetch:
  llamar a Geoapify.

Si Geoapify falla:
  usar cache stale si existe; si no, sandbox.
```

Con el valor actual:

```text
MIN_SCANNER_TARGETS = 4
Geoapify limit = 10
EXPANDED_SCAN_RADIUS = 1500
```

### Merge recomendado

No descartar resultados parciales de Overpass.

```js
const targets = mergePlaces(overpassPlaces, geoapifyPlaces).slice(0, 10);
```

Prioridad sugerida:

1. OSM/Overpass si es valido.
2. Geoapify para completar.
3. Sandbox solo si no hay suficientes reales.

### Metadatos para UI

El scanner deberia poder explicar de donde vienen los objetivos:

```text
- "Objetivos OSM encontrados"
- "Objetivos completados con Geoapify"
- "Objetivos precargados en cache"
- "Cache antigua usada por inestabilidad de proveedores"
- "Sandbox de relleno"
```

Esto ayuda a debuggear y da confianza al jugador.

## Prefetch durante la run

El prefetch es viable y recomendable, pero debe ser limitado.

### Que precargar

Mientras el jugador esta dentro de una run:

1. Zona del host actual.
2. Hasta 2 bookmarks cercanos/relevantes.
3. Opcional: ultima posicion local si ya hay permiso concedido y no se dispara prompt.

No pedir permiso de geolocalizacion en mitad de una run si el navegador esta en estado `prompt`.

### Limites recomendados

```text
max zonas por sesion normal: 3
max zonas por sesion agresiva: 6
concurrencia: 1 request externa activa
Geoapify fallback: solo si Overpass falla o da pocos
no repetir misma cacheKey en la misma sesion
```

### Cancelacion

Usar el `runSessionId` actual del cliente para ignorar resultados de prefetch si el jugador cambia de run antes de que termine.

## Seguridad y API keys

No exponer la API key de Geoapify en el frontend.

Arquitectura recomendada:

```text
PWA
  -> HTTPS Callable Function / Cloud Function
      -> Firestore cache
      -> Overpass publico
      -> Geoapify con API key privada
```

Minimos de seguridad:

- API key Geoapify solo en variables de entorno del backend.
- Rate limiting por usuario/IP/sesion.
- Validar lat/lon/radius/limit en Cloud Function.
- Limitar radio maximo a 1500m o el valor de diseño.
- Limitar `limit` a 10 en gameplay normal.
- Guardar logs agregados de hits/misses/fallbacks.

## Accionables por fase

### Fase 1: contrato comun de targets

- [ ] Definir el contrato backend `getNearbyTargets({ lat, lon, radius, limit })`.
- [ ] Normalizar respuesta a `{ places, source, cacheState, providerHealth }`.
- [ ] Mantener compatibilidad con el modelo actual de `place` usado por `buildSystem(place)`.
- [ ] Documentar categorias internas esperadas: `amenity`, `shop`, `office`, `craft`, `tourism`, `leisure`, `healthcare`, `building`, `landuse`, `commercial`, `service`.

### Fase 2: Firestore cache

- [ ] Crear coleccion `placesCache`.
- [ ] Crear helper de `cacheKey` por geohash/celda, radio, limit y version.
- [ ] Guardar un documento por zona.
- [ ] Implementar fresh/stale TTL.
- [ ] Anadir `providerHealth` y `source` al documento.
- [ ] Evitar documentos por place individual.

### Fase 3: Cloud Function de adquisicion

- [ ] Crear Cloud Function `getNearbyTargets`.
- [ ] Leer cache antes de consultar proveedores externos.
- [ ] Consultar Overpass primero.
- [ ] Si Overpass falla o da menos de 4 objetivos, consultar Geoapify con `limit=10`.
- [ ] Mezclar resultados parciales.
- [ ] Guardar en Firestore.
- [ ] Devolver cache stale si proveedores fallan.
- [ ] Devolver sandbox solo si no hay datos reales ni stale util.

### Fase 4: proveedor Geoapify

- [ ] Crear normalizador Geoapify -> place interno.
- [ ] Mapear `place_id` a `providerId`.
- [ ] Mapear categorias Geoapify a categorias internas.
- [ ] Extraer direccion compacta si esta disponible.
- [ ] Fijar `provider: "geoapify"`.
- [ ] Usar `limit=10` por defecto.
- [ ] No usar Place Details en gameplay normal.

### Fase 5: cliente PWA

- [ ] Cambiar `searchRealPlaces()` para llamar al backend/cache en vez de consultar siempre Overpass desde el cliente.
- [ ] Mantener `fillWithSandboxTargets()` como fallback final local.
- [ ] Actualizar mensajes de `scannerResultMessage()` con `cacheState` y `source`.
- [ ] Anadir prefetch silencioso tras `startRun(place)`.
- [ ] Prefetchear host actual y bookmarks con deduplicacion.
- [ ] Limitar prefetch a 3 zonas/sesion.

### Fase 6: observabilidad y costes

- [ ] Registrar contadores diarios: cache hits, stale hits, Overpass ok, Overpass partial, Overpass failed, Geoapify used, Geoapify failed, sandbox used.
- [ ] Anadir logs no sensibles en Cloud Function.
- [ ] Crear dashboard minimo o consulta manual para creditos estimados.
- [ ] Alertar si Geoapify supera 2.500 creditos/dia.
- [ ] Alertar si Firestore reads se aproxima a 50.000/dia.

### Fase 7: QA

- [ ] Test unitario de `cacheKey` estable.
- [ ] Test de merge `Overpass parcial + Geoapify`.
- [ ] Test de fallback `Overpass falla -> Geoapify`.
- [ ] Test de fallback `Overpass y Geoapify fallan -> stale/sandbox`.
- [ ] Test manual con Geoapify desactivado.
- [ ] Test manual con Overpass simulado en timeout.
- [ ] Test manual de prefetch durante run.

## Riesgos y mitigaciones

### Riesgo: prefetch demasiado agresivo

Mitigacion:

- Limitar a 3 zonas/sesion en v1.
- Deduplicar por `cacheKey`.
- No refrescar fresh cache.
- Concurrencia 1.

### Riesgo: API key Geoapify expuesta

Mitigacion:

- Llamadas Geoapify solo desde Cloud Functions.
- Variables de entorno/secret manager.
- Validacion de parametros.

### Riesgo: Firestore reads excesivos

Mitigacion:

- Documento por zona.
- Cache local de sesion en memoria del cliente.
- No leer la misma `cacheKey` varias veces durante la misma run.

### Riesgo: datos stale demasiado antiguos

Mitigacion:

- `staleUntil` maximo 30 dias.
- Mostrar mensaje UI si se usa stale.
- Refrescar en background cuando sea posible.

### Riesgo: dependencia comercial

Mitigacion:

- Geoapify solo como fallback.
- Overpass sigue como principal.
- Sandbox sigue garantizando jugabilidad.
- La arquitectura permite sustituir Geoapify por otro proveedor Places si hiciera falta.

## Criterios de exito

- Menos caidas a sandbox cuando Overpass falla.
- Menos esperas al abrir scanner tras una run.
- Geoapify por debajo de 3.000 creditos/dia durante beta.
- Firestore por debajo de 50.000 reads/dia durante beta.
- El usuario siempre recibe objetivos: cache, Overpass, Geoapify o sandbox.
- La API key de Geoapify no aparece en el bundle frontend.

## Propuesta final de configuracion v1

```text
MIN_SCANNER_TARGETS = 4
GEOAPIFY_LIMIT = 10
SCAN_RADIUS = radio actual del deck, maximo 1500m
CACHE_FRESH_TTL = 24h
CACHE_STALE_TTL = 14d
MAX_PREFETCH_ZONES_PER_SESSION = 3
MAX_EXTERNAL_CONCURRENCY = 1
PROVIDER_ORDER = cache -> overpass -> geoapify -> sandbox
```

## Fuentes de referencia

- Geoapify Pricing: https://www.geoapify.com/pricing/
- Geoapify Pricing Details: https://www.geoapify.com/pricing-details/
- Geoapify Places API: https://apidocs.geoapify.com/docs/places/
- Firebase Pricing: https://firebase.google.com/pricing
- Firestore Pricing: https://firebase.google.com/docs/firestore/pricing
