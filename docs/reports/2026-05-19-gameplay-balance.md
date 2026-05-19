# shadowHack gameplay balance - 2026-05-19

## Metodo

Se ejecutaron simulaciones por reducer, sin tocar UI:

- 4 hosts demo reales del repo.
- 60 hosts sinteticos por categoria/nombre para cubrir tiers `D` a `AAA`.
- Decks de nivel 1, 2 y 3 en stats/programas/hardware.
- Politica cautelosa: resolver ICE/evento activo con el programa recomendado, extraer primer payload alcanzable y salir.

Limitacion: no mide usabilidad visual ni errores humanos reales. Mide balance sistemico bajo una politica que conoce el mapa completo para planear, pero aun respeta `Scan` para moverse a nodos desconocidos.

## Hallazgos

### 1. El arranque es demasiado duro para un jugador nuevo

Con deck nivel 1, la muestra sintetica dio:

- Escape: 33%.
- Payload: 43%.
- Recompensa media: 97 cred.
- Turnos medios: 10.

Por tier con deck nivel 1:

- `D`: 10% escape, 30% payload, 62 cred media.
- `C`: 33% escape, 33% payload, 82 cred media.
- `B`: 43% escape, 43% payload, 110 cred media.
- `A`: 40% escape, 40% payload, 132 cred media.
- `AA`: 42% escape, 67% payload, 111 cred media.
- `AAA`: 35% escape, 40% payload, 96 cred media.

Lectura: el tier bajo no esta funcionando como tutorial blando. Los hosts `D` tienen menos recompensa, pero no bastante menos friccion.

### 2. La progresion acelera mucho al llegar a L3

Resultados por nivel de deck en muestra sintetica:

- L1: 33% escape, 43% payload, 97 cred media.
- L2: 33% escape, 50% payload, 102 cred media.
- L3: 58% escape, 82% payload, 136 cred media.

El salto de L1 a L2 apenas cambia supervivencia. El salto a L3 si cambia la run de forma fuerte.

### 3. Los costes de mejora estan razonables, pero el ingreso inicial no

Costes actuales:

- Programa L1->L2: 180.
- Stat L1->L2: 260.
- Hardware L1->L2: 240.
- Programa L2->L3: 270.
- Stat L2->L3: 390.
- Hardware L2->L3: 360.

Runs necesarias aproximadas:

- Si el jugador gana 36 cred por fallo bajo: 5 runs para programa L2, 8 para stat L2.
- Si gana 97 cred media L1: 2 runs para programa L2, 3 para stat L2.
- Si gana 150 cred escapando objetivos buenos: 2 runs para casi cualquier mejora temprana.

Lectura: la economia no esta rota por coste, sino por varianza de recompensa y por una primera experiencia que puede pagar migajas tras una derrota poco explicada.

### 4. Recompensa de fallo con payload puede ser demasiado generosa

Ejemplos medidos con deck L1:

- Fallo sin payload en Cafe Kitsune: 36 cred.
- Fallo con payload en Clinica Norte: 121-122 cred.
- Escape de objetivo alto con payload: 150-174 cred.

Esto permite una estrategia rara: entrar en objetivo alto, agarrar payload, aceptar dumped y aun progresar bastante. No es necesariamente malo si se quiere una fantasia de golpe sucio, pero ahora compite demasiado con el escape limpio.

### 5. El host demo inicial no ensena bien

Cafe Kitsune demo:

- Tier `D`, score 24.
- 10 nodos.
- 3 ICE.
- Con deck L1 y politica cautelosa: dumped sin payload, 36 cred.
- Con deck L5 y politica cautelosa: escaped con payload, 153 cred.

Lectura: como primer host, castiga demasiado pronto. Como host rejugable, esta bien. Para onboarding, no.

## Recomendaciones

### Balance inmediato

1. Crear una plantilla `tutorial/sandbox` para el primer host demo:
   - 7-9 nodos.
   - 0-1 ICE.
   - primer payload a 3 saltos, salida clara a 2-3 saltos.
   - una puerta, una camara, un archivo y una salida.

2. Separar recompensa de `dumped`:
   - Si hay payload pero no escape, pagar 35-50% del valor normal.
   - Mantener failure floor bajo, pero no humillante: 30-50 cred.

3. Subir la utilidad de L2:
   - Que L2 reduzca ruido o coste perceptible antes de L3.
   - Ahora L2 mejora payload algo, pero no supervivencia.

4. Ajustar tier bajo:
   - `D/C` deben ser mas seguros, no solo mas baratos.
   - Reducir probabilidad de ICE en `effectiveSecurity <= 2`.
   - Evitar combinaciones tempranas de camara + ICE + gate antes del primer payload.

### Progresion recomendada

Objetivo sano para beta:

- Primera mejora de programa: 2-3 runs.
- Primera mejora de stat/hardware: 3-4 runs.
- Primer deck L2 funcional: 8-12 runs, no 20.
- L3: visible tras 15-25 runs si el jugador escapa de forma consistente.

Con la economia actual esto es alcanzable, pero solo si el jugador aprende pronto a escapar con payload. Por eso el problema de balance es mas onboarding que tabla de precios.

## Estado

Balance sistemico prometedor, pero el primer contacto es aspero. Hay tension, hay recompensa, hay progresion. Falta domar la curva inicial y evitar que el mejor consejo sea "farmea objetivos altos aunque te expulsen".

## Proxima accion

Implementar un preset de primer host + ajustar recompensa parcial por dumped con payload. Despues repetir estas simulaciones y comparar escape L1 en tiers `D/C`: objetivo minimo 60-70% con politica cautelosa.
