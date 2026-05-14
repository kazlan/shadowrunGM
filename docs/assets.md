# Integración de assets visuales

La app ya espera assets bajo `public/assets/` y mantiene fallbacks CSS cuando falte una imagen. Esto permite recibir los artes finales y copiarlos a rutas estables sin cambiar el código.

## Fondos por arquetipo

Las rutas esperadas están declaradas en `src/assets/assetRegistry.js`:

```text
public/assets/backgrounds/bg-default.svg
public/assets/backgrounds/bg-retail.svg
public/assets/backgrounds/bg-food.svg
public/assets/backgrounds/bg-finance.svg
public/assets/backgrounds/bg-medical.svg
public/assets/backgrounds/bg-industrial.svg
public/assets/backgrounds/bg-government.svg
public/assets/backgrounds/bg-security.svg
public/assets/backgrounds/bg-tech.svg
public/assets/backgrounds/bg-unknown.svg
```

## Iconos y marca

```text
public/assets/logos/logo-shadowhack.svg
public/assets/logos/splash-shadowhack.svg
public/assets/programs/program-scan.svg
public/assets/programs/program-spike.svg
public/assets/programs/program-ghost.svg
public/assets/programs/program-shield.svg
public/assets/programs/program-extract.svg
public/assets/defenses/ice-watcher.svg
public/assets/defenses/ice-piercer.svg
public/assets/defenses/ice-tracer.svg
public/assets/defenses/ice-locker.svg
public/assets/defenses/ice-crasher.svg
```

## Formato recomendado

- Fondos: SVG placeholder actual; arte final recomendado WebP vertical 9:16, 1080x1920 o 1440x2560.
- Iconos: SVG si es posible; PNG transparente si hay textura/raster.
- Mantener nombres exactos para evitar tocar código.


## Placeholders actuales

Se han generado placeholders SVG para validar la integración antes de recibir arte final. Actualmente la UI ya consume:

- Fondo por arquetipo desde `src/assets/assetRegistry.js`.
- Logo placeholder en el HUD.
- Iconos placeholder de programas en el dock inferior.
- Iconos placeholder de defensas en el mapa de nodos.

Cuando llegue el arte final, se puede reemplazar archivo por archivo manteniendo los nombres o actualizar el registry si cambia el formato.
