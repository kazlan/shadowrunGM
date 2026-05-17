# Propuesta: arte promocional para landing

## Objetivo

La primera landing usa placeholders ya integrados para no bloquear la publicacion. Para una v2 conviene producir un pequeno set de arte propio que venda `shadowHack` antes de que el jugador entre en `/play`.

## Assets recomendados

- **Key art vertical 9:16**: cyberdeck movil con mapa de nodos en pantalla, luz cyan/magenta, espacio libre para titular y CTA. Uso: hero y social previews recortadas.
- **Mockup de gameplay**: captura compuesta de una run con HUD, mapa de nodos, alerta/traza/shell y dock de programas. Uso: bloque "Que es".
- **Icono PWA final**: 512x512, 192x192 y maskable, sustituyendo el icono SVG temporal de `public/icons/icon.svg`.
- **Banner social**: 1200x630 con logo, mapa abstracto y CTA "Jugar demo".
- **Fondo calmado/alerta**: dos variantes del mismo lenguaje visual para web publica y promocion.

## Prompt base

> Arte promocional original para una PWA movil llamada shadowHack, juego tactil de intrusion digital cyberpunk. Un cyberdeck portatil muestra un mapa de nodos conectado con rutas neon, alertas de traza y datos extraidos, paleta negro azulado, cyan, magenta, rojo alerta y amarillo dato. Composicion limpia, legible como hero de landing, sin marcas reales, sin texto pequeno, sin referencias a franquicias existentes, atmosfera de terminal retro moderno, alto contraste, 9:16.

## Integracion sugerida

- Guardar arte final bajo `public/assets/landing/`.
- Mantener `public/assets/logos/` para marca y splash.
- Optimizar raster como WebP/AVIF y dejar fallback PNG si hace falta.
- No sustituir el gameplay real por arte generico: la landing debe seguir enlazando de forma clara a `/play`.
