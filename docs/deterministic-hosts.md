# Hosts deterministas basados en empresas

## Objetivo

Un host debe ser reproducible para cualquier jugador que seleccione la misma empresa normalizada. La generación no depende del dispositivo ni de `Math.random()`, sino de un hash estable.

## Contrato de semilla

El contrato base es `CompanySeedData`:

- `provider`: origen de datos, por ejemplo `osm`, `google_places`, `manual` o `custom`.
- `providerId`: identificador estable dentro del proveedor.
- `name`: nombre público del lugar.
- `category`: categoría del proveedor, si existe.
- `lat` y `lon`: coordenadas redondeadas.
- `address`: texto opcional, no usado por defecto en la semilla.

## Canonicalización

La semilla canónica se construye así:

```text
provider|providerId|name|category|lat|lon
```

Las cadenas se pasan a minúsculas, se eliminan acentos, se compactan espacios y se recortan. Las coordenadas se redondean a cinco decimales para evitar variaciones mínimas.

## Hash y PRNG

1. Se calcula SHA-256 sobre el string canónico.
2. Se usa el hexadecimal completo como entrada del PRNG.
3. El generador de mapa recibe el PRNG como dependencia obligatoria.
4. Cualquier decisión persistente del host debe salir del PRNG, no de `Math.random()`.

## Estabilidad esperada

- Mismo proveedor + mismo ID + mismos datos normalizados = mismo host.
- Si un negocio cambia de nombre, categoría o proveedor, puede cambiar el host.
- Para continuidad local se guarda `seedId`, alias, puntuación y estado resumido de la run, no la ubicación exacta del jugador.
