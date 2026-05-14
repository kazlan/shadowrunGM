# Diseño de juego

## Fantasía central

El jugador actúa como un intruso digital que despliega un deck móvil para infiltrarse en hosts ficticios anclados a negocios cercanos. Cada host es una red de nodos abstracta con rutas, defensas, archivos y un núcleo.

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

La primera run offline separa el host determinista del estado mutable de partida. El host conserva nodos, conexiones, riesgos y defensas; la run conserva nodo actual, nodos descubiertos, defensas neutralizadas, alerta, traza, integridad, payload y log de acciones.

Acciones disponibles en el MVP:

- **Scan**: revela nodos conectados al nodo actual.
- **Move**: salta a un nodo conectado y descubierto.
- **Spike**: intenta neutralizar la defensa activa.
- **Ghost**: reduce firma y traza.
- **Shield**: amortigua daño y bloqueos durante dos pulsos.
- **Extract**: extrae payload desde nodos de dato, base de datos o núcleo.
- **Jack out**: completa la run si el jugador tiene payload y está en entrada/salida.
