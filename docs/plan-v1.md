# Plan accionable hacia v1

## Fase 0 — Base técnica

- [x] Sustituir el prototipo Meteor por una PWA moderna.
- [x] Crear manifest con orientación vertical y display fullscreen.
- [x] Añadir service worker básico para shell offline.
- [x] Separar dominios: app, game, location, pwa, ui y world.
- [x] Dejar objetivos demo para desarrollar sin depender aún de APIs externas.

## Fase 1 — Host determinista

- [x] Definir `CompanySeedData` como contrato de entrada.
- [x] Normalizar nombre, categoría, proveedor, ID y coordenadas.
- [x] Calcular SHA-256 con Web Crypto.
- [x] Convertir el hash en semilla para un PRNG determinista.
- [x] Generar mapa de nodos sin usar `Math.random()`.
- [x] Añadir prueba smoke de reproducibilidad: misma empresa, mismo grafo.
- [x] Guardar hosts visitados por `seedId`, no por coordenadas exactas del jugador.

## Fase 2 — Geolocalización y proveedores

- [x] Crear servicio de geolocalización web.
- [x] Crear interfaz de proveedor de lugares.
- [x] Añadir explicación previa al permiso de ubicación en UI del scanner local.
- [x] Implementar proveedor OpenStreetMap/Overpass para MVP con fallback demo.
- [ ] Añadir fallback manual por ciudad, barrio o código postal. Fallback demo ya disponible si falla geolocalización.
- [ ] Cachear resultados cercanos con expiración corta.
- [x] Filtrar lugares sin nombre o sin ID estable en la capa de proveedor.

## Fase 3 — Bucle jugable

- [x] Implementar estados de run: idle, entering, exploring, encounter, objectiveComplete, escaped y dumped.
- [x] Acciones táctiles: escanear, mover, ejecutar programa, extraer y desconectar.
- [x] Sistema de alerta que sube por ruido, fallos y defensas activas.
- [x] Integridad de avatar/deck y contador de trazado.
- [x] Condición de victoria: extraer dato y salir.
- [x] Condición de derrota: integridad cero, traza completa o alerta máxima.

## Fase 4 — Contenido v1

- [x] Catálogo inicial de defensas: centinela, perforador, rastreador, ancla y rompeprogramas.
- [x] Catálogo inicial de programas: Scan, Spike, Ghost, Shield y Extract.
- [x] Añadir deck persistente con atributos y programas mejorables.
- [x] Añadir economía local de cred ganada por runs y gastada en mejoras.
- [x] Diseñar valoración determinista de empresas para modular dificultad, tamaño y recompensa de red.
- [ ] Generar identidades ficticias de host con alias, color, sigil y lema.
- [x] Añadir eventos de nodo: archivo, puerta, cámara, señuelo, trampa, núcleo y salida.
- [x] Documentar eventos de nodo como evolución principal del sistema antes de ampliar el catálogo de programas.
- [x] Diferenciar defensas pasivas, defensas activas y respuesta de host.
- [x] Añadir convergencia propia como cierre dramático cuando alerta o traza llegan al máximo.
- [x] Mantener Scan, Spike, Ghost, Shield y Extract como catálogo v1 hasta que los eventos de nodo aporten profundidad suficiente.
- [ ] Diseñar desbloqueo de nuevos programas como extensiones tácticas del deck, inspirado en la variedad de utilidades v2/v3 sin copiar nombres ni listas oficiales.

## Fase 5 — Arte, UX y pulido

- [x] Crear carpeta `arte/` con prompts base para assets.
- [ ] Producir iconos finales de PWA en 192, 512 y maskable. Slots de assets ya preparados.
- [ ] Producir fondos verticales 9:16 y variantes por arquetipo. Rutas de fondos ya preparadas en `public/assets/backgrounds`.
- [ ] Producir lenguaje visual de nodos, defensas y programas.
- [ ] Añadir microanimaciones de escaneo, alerta y daño.
- [ ] Preparar modo captura/streamer que oculte nombres reales de empresas.

## Fase 6 — Calidad y entrega

- [ ] Tests unitarios de normalización, hash, PRNG y generación de mapa.
- [ ] Lighthouse PWA en móvil.
- [ ] Revisión de accesibilidad táctil: contraste, tamaños, foco y labels.
- [ ] Validación de privacidad y textos de consentimiento.
- [ ] Beta cerrada con objetivos demo y proveedor real opcional.
