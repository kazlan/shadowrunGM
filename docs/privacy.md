# Privacidad y geolocalización

## Política de diseño

La ubicación se usa para descubrir objetivos cercanos, no para perfilar al jugador. Por defecto, la app debe funcionar con la mínima información necesaria.

## Reglas

- Pedir consentimiento explícito antes de llamar a geolocalización.
- Explicar que la ubicación se usa para listar negocios cercanos convertidos en objetivos ficticios.
- No guardar coordenadas exactas salvo consentimiento específico y justificación clara.
- Guardar progreso por `seedId`, alias ficticio y estado de juego.
- Ofrecer fallback manual por ciudad, barrio o código postal.
- Incluir un modo captura/streamer que oculte nombres reales de empresas.

## Datos recomendados para persistencia local

```json
{
  "seedId": "abc123def456",
  "hostAlias": "NEON-CAF-VAULT",
  "discoveredAt": "2026-05-14T00:00:00.000Z",
  "completedRuns": 2,
  "bestScore": 8300
}
```

## Datos no recomendados por defecto

- Coordenadas exactas del jugador.
- Historial temporal de movimientos.
- Lista cruda de lugares visitados físicamente.
- Capturas con nombres reales si el usuario activó modo privacidad.


## Estado actual del scanner local

El scanner local solicita geolocalización desde la UI y redondea la posición antes de usarla. Primero intenta consultar OpenStreetMap/Overpass para obtener objetivos reales cercanos. Si Overpass no responde, no devuelve resultados o el permiso falla, la app vuelve a objetivos demo sin bloquear la experiencia. El progreso se guarda localmente por `seedId`, alias y puntuación, no por coordenadas exactas.
