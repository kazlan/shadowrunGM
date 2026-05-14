# Valoración de empresas y dificultad de red

shadowHack asigna a cada empresa un valor determinista entre 5 y 100. Ese valor no pretende ser una valoración real ni financiera: es una métrica de juego para decidir lo grande, defendida y rentable que será la red generada.

## Entradas

La valoración usa únicamente señales ya disponibles en el objetivo:

- Arquetipo interno de empresa: comida, comercio, finanzas, salud, gobierno, seguridad, tecnología, industria o desconocido.
- Categoría/nombre/dirección normalizados del proveedor.
- Proveedor de datos, por ejemplo OSM o demo manual.
- Variación estable derivada de la seed para que dos objetivos similares no sean idénticos.

## Salidas

La valoración produce:

- `score`: valor 5-100.
- `tier`: D, C, B, A, AA o AAA.
- `difficulty`: mínima, baja, media, elevada, alta o letal.
- `securityModifier`: ajuste aplicado al nivel de seguridad de la red.
- `sizeModifier`: ajuste aplicado al tamaño del mapa.
- `payoutMultiplier`: multiplicador de puntuación final.

## Efectos de juego

- Empresas de mayor valor generan redes más grandes.
- Empresas de mayor valor suben la seguridad efectiva y la probabilidad de defensas.
- Empresas de mayor valor multiplican la puntuación si el jugador consigue extraer y salir.
- La métrica se guarda en progreso local por `seedId`, no por coordenadas exactas.

## Importante

Esta valoración es ficción sistémica. No debe mostrarse como valor económico real ni afirmación sobre una empresa real.
