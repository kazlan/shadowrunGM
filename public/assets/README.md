# Assets de shadowHack

Carpeta preparada para recibir las imágenes finales esta tarde sin tocar rutas de código.

## Estructura

```text
backgrounds/   Fondos verticales 9:16. Recomendado: 1440x2560 o 1080x1920.
characters/    Retratos/avatar del decker y variaciones de estado.
defenses/      Iconos/avatares de defensas digitales.
logos/         Logo, wordmark, splash y variantes de marca.
programs/      Iconos de programas: scan, spike, ghost, shield, extract.
ui/            Overlays, scanlines, bordes, efectos y elementos de interfaz.
```

## Convenciones de nombres esperadas

```text
backgrounds/bg-default.svg
backgrounds/bg-retail.svg
backgrounds/bg-food.svg
backgrounds/bg-finance.svg
backgrounds/bg-medical.svg
backgrounds/bg-industrial.svg
backgrounds/bg-government.svg
backgrounds/bg-security.svg
backgrounds/bg-tech.svg
backgrounds/bg-unknown.svg
logos/logo-shadowhack.svg
logos/splash-shadowhack.svg
programs/program-scan.svg
programs/program-spike.svg
programs/program-ghost.svg
programs/program-shield.svg
programs/program-extract.svg
defenses/ice-watcher.svg
defenses/ice-piercer.svg
defenses/ice-tracer.svg
defenses/ice-locker.svg
defenses/ice-crasher.svg
```

## Notas

- Mantener assets originales; no copiar pantallas, sprites ni logos propietarios.
- Los placeholders actuales son SVG. Para arte final, se puede mantener SVG o sustituir por WebP actualizando `src/assets/assetRegistry.js`.
- La app ya tiene fallbacks CSS si falta un archivo.


## Placeholders incluidos

Los placeholders SVG actuales son intencionadamente ligeros y sirven para probar carga, layout y contraste. No son arte final.

La app ya usa el logo, fondos por arquetipo, iconos de programas e iconos de defensas desde estas rutas.
