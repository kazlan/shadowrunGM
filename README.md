# shadowHack

PWA móvil vertical de intrusión cyberpunk. El objetivo es convertir negocios cercanos al jugador en hosts ficticios generados de forma determinista: si dos jugadores seleccionan la misma empresa normalizada, ambos reciben el mismo sistema, mapa de nodos, defensas y personalidad visual.

## Principios del proyecto

- **Mobile-first real**: interfaz diseñada para uso vertical, táctil y a pantalla completa.
- **Hosts deterministas**: cada objetivo se genera desde un hash estable de los datos de la empresa.
- **Privacidad por defecto**: la ubicación sirve para descubrir objetivos cercanos, no para crear un historial sensible.
- **Inspiración, no copia**: tomamos ideas generales de ficción cyberpunk, mapas de nodos y decking, sin reproducir reglas, textos, pantallas ni assets propietarios.
- **MVP rápido**: antes de simular todo, necesitamos un bucle jugable mínimo: entrar, explorar, extraer y salir.

## Scripts

```bash
npm install
npm run dev
npm run build
```

## Estructura actual

```text
arte/                  Prompts y guía de assets visuales.
docs/                  Plan, decisiones de diseño, privacidad y referencias.
public/                Manifest, icono temporal, assets preparados y service worker.
src/app/               Bootstrap vanilla JS de la PWA.
src/game/              PRNG, generación de mapas, programas y defensas.
src/location/          Geolocalización y utilidades de privacidad.
src/pwa/               Registro del service worker.
src/styles/            Tema visual mobile-first.
src/ui/                HUD y mapa de nodos.
src/world/             Empresas, semillas, arquetipos, proveedores y alias de host.
```

## Estado del prototipo

La app ya arranca con objetivos demo, calcula una semilla SHA-256 por empresa, clasifica el arquetipo del host, genera un mapa de nodos reproducible mediante PRNG sembrado, permite jugar una run offline con escaneo, movimiento, programas, extracción, alerta, traza e integridad, valora cada empresa para modular dificultad/recompensa, guarda progreso local por `seedId` y tiene placeholders SVG conectados a la UI para validar fondos, logo, programas y defensas antes de sustituirlos por imágenes finales.
