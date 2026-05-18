# Reintegración futura de memoria local

## Contexto

Se retira la caja fija de memoria local del HUD para dar más aire al mapa y evitar que la interfaz compita con la lectura de nodos. La capacidad de loot puede seguir existiendo como regla interna del deck, pero no debe ocupar una banda permanente durante la run.

## Objetivo futuro

Reintegrar la memoria local solo si aporta una decisión táctica visible sin reducir el mapa:

- Mostrar memoria como overlay contextual temporal al extraer datos.
- Integrarla en el botón del deck como contador compacto, no como caja independiente.
- Avisar de buffer lleno mediante ticket de log y microanimación, no mediante panel persistente.
- Mantener el detalle completo de memoria dentro del banco de trabajo del deck.

## Criterios de aceptación

- No añade una nueva fila fija al layout principal.
- No reduce la altura disponible del mapa.
- Se entiende el estado de loot sin abrir menús cuando está cerca de llenarse.
- Funciona con el historial de log modal y los tickets flotantes del mapa.
