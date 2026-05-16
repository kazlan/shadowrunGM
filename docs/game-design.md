# Diseño de juego

## Fantasía central

El jugador actúa como un intruso digital que despliega un deck móvil para infiltrarse en hosts ficticios anclados a negocios cercanos. Cada host es una red de nodos abstracta con rutas, defensas, archivos y un núcleo.

## Dirección de reglas

La ruta de diseño combina una estructura de host explorable con presión operativa moderna, sin implementar reglas oficiales de ningún juego de mesa. La base de progresión toma inspiración general del enfoque v2/v3: el deck importa como máquina/persona persistente, con atributos y programas mejorables. La fantasía es decking cyberpunk táctil: entrar en un sistema, leerlo, decidir cuánto riesgo asumir y salir antes de que la respuesta del host cierre la run.

Pilares de diseño:

- **Mapa de intrusión**: cada host se entiende como una red de nodos, rutas, entrada, núcleo, datastores, salida y defensas. La experiencia base es explorar una red, no gestionar una lista de permisos.
- **Relojes de presión**: alerta, traza e integridad sustituyen de forma jugable a vigilancia, rastreo y daño. Deben crear urgencia clara sin añadir contabilidad pesada.
- **Programas como verbos tácticos**: Scan, Spike, Ghost, Shield y Extract son decisiones directas. El catálogo v1 debe mantenerse corto hasta que los eventos de nodo den más profundidad al mapa.
- **Deck como build persistente**: el chasis, sus atributos y sus programas evolucionan entre runs. Las mejoras deben cambiar decisiones y tolerancia al riesgo, no solo subir puntuación.

El modelo base será una red explorable antes que una lista de permisos, marcas o estados administrativos. Si se añaden acciones inalámbricas, deberán traducirse a eventos de nodo o efectos tácticos simples: cámara, puerta, dron, señuelo, trampa, archivo, núcleo o salida.

## Eventos de nodo

Los eventos son la evolución principal del mapa. Cada nodo puede traer un problema o recompensa determinista que se resuelve con los programas v1:

- **Archivo**: payload útil. Se resuelve con Extract.
- **Puerta**: control de acceso que abre rutas cercanas. Se resuelve con Spike.
- **Cámara**: vigilancia contextual que sube alerta al entrar. Se resuelve con Ghost.
- **Señuelo**: dato falso que castiga una extracción precipitada. Se resuelve con Scan.
- **Trampa**: retorno hostil que daña shell y engancha traza. Se resuelve con Shield.
- **Núcleo**: objetivo principal de alto valor. Se resuelve con Extract.
- **Salida**: punto seguro para Jack out.

Las defensas quedan separadas en tres capas:

- **Defensas pasivas**: eventos de nodo que existen en el mapa y piden una respuesta táctica.
- **Defensas activas**: ICE que dispara efectos al entrar en el nodo y puede neutralizarse con Spike.
- **Respuesta de host**: presión global representada por alerta y traza; cuando cualquiera llega al máximo se produce una convergencia propia y la run queda expulsada.

## Bucle MVP

1. Elegir objetivo cercano.
2. Generar el host desde su semilla.
3. Entrar por el nodo de acceso.
4. Escanear nodos desconocidos.
5. Moverse por rutas conectadas.
6. Resolver defensas con programas.
7. Extraer datos del núcleo o base de datos.
8. Salir antes de que la alerta o el trazado lleguen al máximo.

## Atributos propios

Para evitar replicar reglas concretas de juegos existentes, el sistema usará atributos propios:

- **Pulse**: potencia de ejecución ofensiva.
- **Veil**: capacidad de sigilo y evasión.
- **Lens**: análisis, escaneo y lectura de rutas.
- **Shell**: absorción de daño, bloqueos y trazas.

## Deck y progresión

El deck es una capa persistente local, inspirada en la importancia del cyberdeck y las utilidades en sistemas v2/v3, pero con economía y nombres propios. Cada run otorga cred según valor del host, payload, escape y puntuación. Ese cred se gasta en:

- **Chasis/atributos**: Pulse, Veil, Lens y Shell, con nivel 1-5.
- **Hardware**: memoria de almacenamiento para loot, empezando como un buffer pobre y ampliable.
- **Programas**: Scan, Spike, Ghost, Shield y Extract, también con nivel 1-5.
- **Futuro arsenal**: nuevos programas deberán desbloquear nuevas respuestas tácticas a eventos, no duplicar un botón existente.

Efectos actuales:

- **Pulse + Spike**: mejora ruptura de ICE y puertas, reduciendo el ruido de fuerza bruta.
- **Veil + Ghost**: aumenta margen de traza y mejora reducción de alerta/traza.
- **Lens + Scan/Extract**: permite leer más mapa y extraer con menos ruido.
- **Shell + Shield**: sube integridad base y extiende protección.
- **Memoria**: define cuántos tokens de loot caben en el deck durante la run. Si se llena, hay que salir o mejorar almacenamiento.

La progresión debe conservar una tensión clara: un deck mejor permite asumir hosts más valiosos, pero no elimina alerta, traza ni convergencia.

## Programas iniciales

- **Scan**: revela nodos cercanos e identifica defensas.
- **Spike**: fuerza una defensa o puerta.
- **Ghost**: reduce ruido al moverse o manipular nodos.
- **Shield**: protege ante daño, bloqueo o ruptura de programas.
- **Extract**: captura datos y completa objetivos.

## Defensas iniciales

- **Centinela**: detecta actividad y sube alerta.
- **Perforador**: hace daño directo.
- **Rastreador**: aumenta el contador de trazado.
- **Ancla**: bloquea rutas o desconexión.
- **Rompeprogramas**: inutiliza un programa temporalmente.


## Bucle jugable implementado

La primera run offline separa el host determinista del estado mutable de partida. El host conserva nodos, conexiones, riesgos y defensas; la run conserva nodo actual, nodos descubiertos, defensas neutralizadas, eventos resueltos, alerta, traza, integridad, payload y log de acciones. El deck se conserva aparte como progresión local persistente.

Acciones disponibles en el MVP:

- **Scan**: revela nodos conectados al nodo actual.
- **Move**: salta a un nodo conectado y descubierto.
- **Spike**: intenta neutralizar la defensa activa.
- **Ghost**: reduce firma y traza.
- **Shield**: amortigua daño y bloqueos durante dos pulsos.
- **Extract**: extrae payload desde nodos de dato, base de datos o núcleo.
- **Jack out**: completa la run si el jugador tiene payload y está en entrada/salida.

Eventos de nodo implementados:

- **Archivo/Núcleo**: Extract asegura payload y compromete el nodo.
- **Puerta**: Spike resuelve el control y revela rutas conectadas.
- **Cámara**: al entrar sube alerta; Ghost la resuelve sin coste de shell.
- **Señuelo**: Scan lo limpia; Extract precipitado sube alerta y traza sin payload.
- **Trampa**: al entrar daña shell y sube traza; Shield la encapsula.
- **Salida**: Jack out permite cerrar la run de forma segura.


## Valor de empresa y dificultad

Cada objetivo recibe una valoración de juego entre 5 y 100. La valoración combina arquetipo, categoría, nombre, proveedor y una pequeña variación estable derivada de la seed. Ese valor produce un tier, una dificultad textual, ajustes de seguridad/tamaño y un multiplicador de puntuación. No representa un valor económico real.
