# shadowHack

PWA móvil vertical de intrusión cyberpunk. El objetivo es convertir negocios cercanos al jugador en hosts ficticios generados de forma determinista: si dos jugadores seleccionan la misma empresa normalizada, ambos reciben el mismo sistema, mapa de nodos, defensas y personalidad visual.

## Principios del proyecto

- **Mobile-first real**: interfaz diseñada para uso vertical, táctil y a pantalla completa.
- **Hosts deterministas**: cada objetivo se genera desde un hash estable de los datos de la empresa.
- **Privacidad por defecto**: la ubicación sirve para descubrir objetivos cercanos, no para crear un historial sensible.
- **Inspiración, no copia**: tomamos ideas generales de ficción cyberpunk, mapas de nodos y decking, sin reproducir reglas, textos, pantallas ni assets propietarios.
- **Estructura de host, presión moderna**: los hosts se juegan como mapas de nodos deterministas con defensas y paydata; la tensión viene de alerta, traza e integridad, no de reproducir reglas de mesa existentes.
- **Deck como progresión**: el chasis, sus atributos y sus programas mejoran entre runs para que la preparación del deck sea parte central del juego.
- **MVP rápido**: antes de simular todo, necesitamos un bucle jugable mínimo: entrar, explorar, extraer y salir.

`shadowHack` no implementa Shadowrun v3, Shadowrun v5 ni ninguna edición concreta. La ruta de diseño toma inspiración general de decking cyberpunk: estructura de host explorable, presión acumulativa y acciones tácticas legibles en móvil, con nombres, reglas y mecánicas propias.

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

La app ya arranca con objetivos demo, calcula una semilla SHA-256 por empresa, clasifica el arquetipo del host, genera un mapa de nodos reproducible mediante PRNG sembrado, permite jugar una run offline con escaneo, movimiento, eventos de nodo, programas, extracción, loot segmentado, alerta, traza e integridad, valora cada empresa para modular dificultad/recompensa, guarda progreso local por `seedId`, mantiene un deck local con cred, memoria, bookmarks, atributos y programas mejorables, usa SFX WebAudio procedurales y música adaptativa por stems/capas, tiene placeholders SVG conectados a la UI para validar fondos, logo, programas y defensas antes de sustituirlos por imágenes finales, y deja preparada una integración opcional con Firebase Auth, Firestore y Cloud Messaging mediante variables de entorno.
