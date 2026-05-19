# shadowHack estado actual - 2026-05-19

## Estado

Repo sincronizado desde `https://github.com/kazlan/shadowrunGM` en `shadowrunGM`, rama `master`, commit `11edb152496b10a65e5d6810c20c43f4cf0e5819`.

Verificaciones ejecutadas:

- `npm install`
- `npm run check`
- `npm run build`
- `npm --prefix functions install`
- `npm --prefix functions test`

Resultado: frontend y tests de Functions pasan. Vite avisa de bundle grande: `dist/assets/index-BkosWClH.js` queda en `501.30 kB`, `157.21 kB` gzip. Functions declara Node 20, pero la máquina local ejecuta Node 22 y muestra `EBADENGINE` durante instalación.

## Lectura de producto

`shadowHack` ya no es solo concepto. Tiene un loop offline jugable:

- elegir objetivo demo o cercano,
- generar host determinista,
- escanear,
- moverse por nodos descubiertos,
- resolver ICE/eventos con programas,
- extraer payload,
- salir por entrada/salida,
- cobrar progreso local.

La base técnica está bien separada: `app`, `game`, `world`, `location`, `firebase`, `ui`, `pwa`. La generación determinista vive en `src/game/mapGenerator.js`; el reducer de partida en `src/game/runEngine.js`; progresión/deck en `src/world/deckStore.js`.

## Jugabilidad actual

Funciona como run táctica corta de exploración. Los verbos son claros: `Scan`, `Spike`, `Ghost`, `Shield`, `Extract`, `Jack out`. La presión viene de tres relojes: alerta, traza e integridad.

Muestra de hosts demo generados:

- Café Kitsune: tier `D`, score `24`, 10 nodos, 3 ICE.
- Clínica Norte: tier `AA`, score `82`, 19 nodos, 10 ICE.
- Banco Delta: tier `AAA`, score `100`, 19 nodos, 7 ICE.
- Dataforge Repair: tier `AA`, score `70`, 18 nodos, 8 ICE.

El problema principal es de onboarding/balance: un jugador nuevo puede tomar una ruta razonable pero mala y ser expulsado antes de entender por qué. En una simulación manual sobre Café Kitsune, una ruta torpe llegó a `dumped` por alerta 10 antes de extraer. Eso no es necesariamente bug, pero ahora mismo la claridad de riesgo depende demasiado del log y del mapa.

## Riesgos

- `renderHud()` está vacío en `src/ui/renderHud.js`. La UI principal depende del mapa, dock y overlays; falta HUD superior real o fue recortado. Para móvil, esto puede dejar demasiado contexto crítico escondido.
- Falta revisión visual real móvil con screenshot/Lighthouse. Hay build, pero no validación de legibilidad táctil.
- El bundle principal supera el umbral de 500 kB minificado. No rompe MVP, pero conviene cortar Firebase/audio/overlays si empieza a doler en móvil.
- Functions instala en Node 22 con aviso porque el paquete declara Node 20. En despliegue Firebase está bien, en local puede confundir.
- Hay 9 vulnerabilidades low en `functions` tras instalar dependencias. No bloquea prototipo, pero debe auditase antes de beta.
- El plan v1 todavía marca pendientes: fallback manual por ciudad/barrio/código postal, cache cercana, assets finales, modo captura/streamer, QA móvil, privacidad y tests unitarios más finos.

## Ruta Recomendada

1. **Cerrar claridad de run móvil**
   - Restaurar o rediseñar HUD compacto.
   - Hacer visibles causa/efecto de cada acción antes y después del toque.
   - Marcar riesgo de nodo, ICE y evento con lenguaje mínimo.

2. **Balance inicial**
   - Crear 3 perfiles de dificultad: demo blando, normal, alto valor.
   - Garantizar que el primer host demo enseñe Scan, Spike, Extract y salida sin castigo opaco.
   - Medir rutas esperadas: turnos hasta primer payload, presión media y tasa de expulsión.

3. **QA móvil**
   - Playwright o equivalente con viewport móvil.
   - Smoke de primera run completa.
   - Capturas de mapa, overlay scanner, deck y resultado.
   - Lighthouse PWA.

4. **Entrega v1 cerrada**
   - Fallback manual de ubicación.
   - Modo privacidad/captura para ocultar nombres reales.
   - Assets finales mínimos: iconos PWA, fondos por arquetipo, nodos/programas/defensas.
   - Decidir si Firebase queda experimental o activado para beta.

## Próxima acción

Atacar primero HUD + primera run guiada por diseño sistémico, no tutorial largo. El juego necesita que el jugador entienda el peligro en la mano, no que lea documentación.
