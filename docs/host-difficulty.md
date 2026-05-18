# Dificultad de hosts

Este documento describe cómo `shadowHack` decide la dificultad de un host generado desde una empresa. La dificultad no se guarda como un número único: se compone de una valoración determinista de la empresa, la seguridad base de su arquetipo, el tamaño de la topología, el riesgo de cada nodo y la cantidad/probabilidad de defensas.

## Flujo general

1. La empresa se normaliza y se convierte en una seed estable según el contrato de hosts deterministas.
2. La empresa se clasifica en un arquetipo interno: comida, comercio, finanzas, salud, gobierno, seguridad, tecnología, industria o desconocido.
3. `valueCompany` calcula un `score` de 5 a 100 con el arquetipo, señales del proveedor y variación estable derivada de la seed.
4. El `score` se transforma en `tier`, `difficulty`, `securityModifier`, `sizeModifier` y `payoutMultiplier`.
5. `generateSystem` combina la seguridad base del arquetipo con `securityModifier` para obtener `effectiveSecurity`.
6. El generador elige plantilla de mapa, número de nodos, riesgo de nodo, eventos y ICE a partir de `effectiveSecurity`, `tier`, `dataBias` y PRNG sembrado.

En pseudocódigo, el corazón del cálculo es:

```text
score = baseArquetipo + señalesCategoria + señalesNombre + bonusProveedor + variaciónSeed
securityEffectiva = clamp(seguridadArquetipo + securityModifier(score), 1, 7)
plantilla = f(tier, securityEffectiva, dataBias)
riesgoNodo = clamp(securityEffectiva + variaciónNodo + bonusZona, 1, 7)
```

## Valoración determinista de empresa

La valoración vive en `src/world/companyValuation.js`. Su objetivo no es valorar una empresa real, sino producir una métrica jugable estable. Dos jugadores que seleccionen la misma empresa normalizada deberían recibir el mismo `score`, siempre que la seed canónica no cambie.

La base depende del arquetipo:

| Arquetipo | Base |
|---|---:|
| `food` | 18 |
| `retail` | 24 |
| `unknown` | 30 |
| `industrial` | 42 |
| `tech` | 52 |
| `medical` | 58 |
| `security` | 62 |
| `government` | 68 |
| `finance` | 74 |

Después se suman señales de categoría, nombre y dirección. Algunos ejemplos de señales positivas son bancos/finanzas, salud, gobierno, seguridad/datacenter, tecnología/datos, industria/logística, retail y hostelería. También hay señales de nombre: términos como `global`, `capital`, `group`, `systems` o `labs` empujan el valor hacia arriba; términos como `express`, `mini`, `local`, `corner` o `kiosk` lo reducen. El proveedor `osm` añade un pequeño bonus y la seed introduce una variación estable de `-7` a `+7` para que objetivos parecidos no sean clones exactos.

## Tabla de tiers y dificultad visible

El `score` se traduce a una etiqueta de tier y a una dificultad textual:

| Score | Tier | Dificultad |
|---:|---|---|
| `85–100` | `AAA` | `letal` |
| `70–84` | `AA` | `alta` |
| `55–69` | `A` | `elevada` |
| `40–54` | `B` | `media` |
| `25–39` | `C` | `baja` |
| `5–24` | `D` | `mínima` |

La etiqueta `difficulty` sirve para explicar el objetivo al jugador y para telemetría de diseño, pero los efectos mecánicos directos entran por los modificadores y la generación del sistema.

## Modificadores que sí afectan a la run

### `securityModifier`

`securityModifier` altera la seguridad base del arquetipo:

| Score | Modificador |
|---:|---:|
| `85+` | `+2` |
| `55–84` | `+1` |
| `25–54` | `0` |
| `<25` | `-1` |

La seguridad efectiva se calcula así:

```text
effectiveSecurity = clamp(archetype.security + valuation.securityModifier, 1, 7)
```

Ejemplos:

- Un bar pequeño (`food`, seguridad base 1) con score bajo puede quedar en `effectiveSecurity` 1.
- Una tienda (`retail`, seguridad base 2) de tier medio normalmente queda entre 2 y 3.
- Un banco (`finance`, seguridad base 5) con tier `AAA` puede llegar a `effectiveSecurity` 7.

### `sizeModifier`

`sizeModifier` expresa cuánto debería crecer el host según su valor:

| Score | Modificador |
|---:|---:|
| `85+` | `+3` |
| `70–84` | `+2` |
| `45–69` | `+1` |
| `20–44` | `0` |
| `<20` | `-1` |

El generador actual lo aplica de forma conservadora sobre el rango de la plantilla: valores mayores que 1 empujan el conteo de nodos en `+1`, valores negativos lo empujan en `-1`, y el resultado se limita al mínimo/máximo de la plantilla. Esto evita saltos bruscos de tamaño y deja el peso principal en la selección de plantilla.

### `payoutMultiplier`

`payoutMultiplier` recompensa asumir objetivos más valiosos:

```text
payoutMultiplier = 1 + score / 100
```

Un host de score 25 multiplica por `1.25`; uno de score 92 multiplica por `1.92`. Este multiplicador se aplica al cálculo final de puntuación/recompensa, junto al payload, loot, salida, integridad, sigilo, traza, velocidad y bonus por seguridad efectiva.

## Plantillas de topología

`generateSystem` elige una plantilla a partir del tier, la seguridad efectiva y el sesgo de datos del arquetipo:

| Plantilla | Condición principal | Rango de nodos | ICE mínimo |
|---|---|---:|---:|
| `secure` | tier `AA`/`AAA` o `effectiveSecurity >= 6` | 16–19 | 4 |
| `standard` | tier `A`, `effectiveSecurity >= 4` o `dataBias >= 4` | 12–15 | 2 |
| `small` | resto de hosts | 9–11 | 1 |

Esto significa que un objetivo puede ser grande por valor corporativo (`AA`/`AAA`), por seguridad efectiva alta o por ser un arquetipo muy orientado a datos. Por ejemplo, salud, tecnología y finanzas suelen tener `dataBias` alto, así que tienden a mapas `standard` aunque el score final no sea extremo.

## Riesgo de nodo y zonas peligrosas

Cada nodo recibe un `risk` entre 1 y 7:

```text
risk = clamp(effectiveSecurity + rng(-1, 1) + riskBonus(zone), 1, 7)
```

Algunas zonas son más peligrosas por diseño:

- `core`, `coreGate` y `hub` reciben `+1`.
- Zonas de control y puertas (`Gate`, `Control`) reciben `+1`.
- El resto no recibe bonus fijo.

Este riesgo influye en el tipo de ICE que puede aparecer. La lista base es:

```text
watcher → piercer → tracer → locker → crasher
```

A más riesgo, más opciones avanzadas entran en la pool. Un nodo de riesgo bajo tenderá a defensas simples; un nodo de riesgo alto puede incluir ICE más agresivo.

## Probabilidad de ICE

La probabilidad de ICE por nodo combina una base, la seguridad efectiva y un bonus por zona:

```text
chance = clamp(0.06 + effectiveSecurity * 0.055 + zoneChance, 0, 0.82)
```

Zonas críticas como core, coreGate, hub, gates de datos o trampas tienen `zoneChance` superior a zonas secundarias. Después de tirar probabilidades, el generador garantiza un mínimo de ICE según la plantilla: 1 en `small`, 2 en `standard`, 4 en `secure`. Si faltan defensas para llegar al mínimo, se priorizan core, firewalls, bases de datos y cámaras.

## Qué no escala todavía con la dificultad

La presión global de la run no se ajusta directamente por tier. Actualmente:

- `maxAlert` empieza en 10.
- `maxTrace` empieza en 8 y mejora con el deck del jugador.
- La integridad inicial depende del hardware `shell` del deck.

Por tanto, un host difícil no cambia por sí mismo los límites máximos de alerta o traza. La dificultad entra por mapa más grande, más seguridad efectiva, nodos de mayor riesgo, más ICE, rutas protegidas y mejor multiplicador de recompensa.

## Ejemplos de lectura de diseño

### Objetivo pequeño

Un café local puede quedar como `food`, base 18, con señales bajas y quizá un nombre que reste. Si el score cae por debajo de 25, será tier `D`, dificultad `mínima`, `securityModifier -1` y plantilla `small`. Tendrá pocos nodos, mínimo 1 ICE y seguridad efectiva cercana a 1.

### Objetivo medio

Una tienda tecnológica puede combinar arquetipo `tech`, base 52, señales de software/datos y `dataBias` alto. Aunque no llegue a `AA`, puede generar plantilla `standard` por `effectiveSecurity >= 4` o por `dataBias >= 4`. El jugador verá más rutas, más archivos y defensas moderadas.

### Objetivo alto

Un banco central o un proveedor de seguridad con nombre corporativo puede superar 85 puntos. Eso lo convierte en `AAA`/`letal`, añade `securityModifier +2`, empuja el tamaño y fuerza plantilla `secure`. El resultado esperado es una red de 16–19 nodos, al menos 4 ICE, nodos críticos con riesgo alto y una recompensa multiplicada notablemente si el jugador extrae y escapa.

## Principios de mantenimiento

- Mantener la generación determinista: cualquier decisión persistente debe salir del PRNG sembrado, no de `Math.random()`.
- No presentar el `score` como valor económico ni como juicio real sobre la empresa.
- Si se añade una nueva señal de categoría o nombre, revisar que no convierta categorías comunes en hosts excesivamente letales.
- Si se toca `securityModifier`, revisar también probabilidad de ICE, riesgo de nodo y puntuación para evitar doble escalado accidental.
- Si se decide que tier afecte a `maxAlert` o `maxTrace`, documentarlo aquí porque cambiaría el modelo actual de presión.
