# Propuesta: integración selectiva de Cybercore CSS

## Resumen

Cybercore CSS puede servir como cantera de patrones visuales, efectos e iconos para `shadowHack`, pero no conviene importar el framework completo. La ruta recomendada es adaptar piezas concretas a nuestro sistema actual de temas, clases y layout móvil.

Referencias:

- Cybercore CSS: https://github.com/sebyx07/cybercore-css
- Demo y documentación: https://sebyx07.github.io/cybercore-css/
- Licencia MIT: https://raw.githubusercontent.com/sebyx07/cybercore-css/main/LICENSE

## Decisión principal

No usar `cybercore.min.css` completo. El paquete trae reset, variables, capas, componentes y estilos globales que podrían chocar con `theme.css`, los temas claros/oscuros y la interfaz móvil vertical.

La integración debe ser selectiva:

- Mantener clases propias de `shadowHack`.
- Mantener variables actuales (`--cyan`, `--magenta`, `--yellow`, `--panel`, etc.).
- Adaptar patrones visuales, no copiar una identidad visual literal.
- Añadir atribución MIT si se copia código o SVG sustancial.

## Aprovechable v1

- **Botones**: esquina cortada, estado hover/focus más expresivo, variantes por intención.
- **Cards**: bracket corners para scanner, deck overlay, software y paneles de resultado.
- **Terminal**: header compacto, prompt/cursor y líneas de estado para run log y pantallas post-run.
- **Datastream**: barrido sutil para extracción, payload, memoria y acciones de scanner.
- **Badges**: fuente real/sandbox, estado de host, alerta, traza, loot y proxy remoto.
- **Iconos SVG**: scanner, deck, settings, host, seguridad, memoria, proxy, archivo, núcleo, salida y estados.

## No hacer

- No sustituir el sistema de temas existente.
- No importar el CSS completo desde CDN o npm como base global.
- No añadir un reset externo.
- No aplicar efectos pesados a todos los paneles.
- No copiar estética literal de Cyberpunk/Night City.
- No romper la legibilidad de temas claros.

## Fases accionables

### Fase 1: micro-estilos propios

Crear una pequeña capa en `src/styles/theme.css` con utilidades internas inspiradas en Cybercore:

- botón con esquina cortada;
- card con bracket corners;
- terminal chrome/cursor;
- badge de estado;
- datastream reducido y respetuoso con `prefers-reduced-motion`.

No cambiar markup masivo todavía. Aplicar como clases auxiliares o reglas sobre componentes actuales.

### Fase 2: iconos

Revisar el set de iconos de Cybercore y elegir solo los necesarios para `shadowHack`.

Candidatos iniciales:

- terminal;
- chip/cpu/memory;
- shield/lock/eye;
- database/cloud/sync;
- settings/sliders;
- bookmark;
- warning/success/error;
- globe/server/signal.

Si se copian SVGs concretos, guardarlos en `public/assets/ui/` o `public/assets/icons/` y añadir atribución MIT en documentación o archivo de licencias.

### Fase 3: primera aplicación visual

Aplicar los patrones primero donde más aportan:

- `scanner` targets y badges real/sandbox/proxy;
- `deck overlay` y tarjetas de software;
- `run log` y post-run terminal;
- botones principales (`Jack out`, scanner, upgrades).

Mantener densidad móvil y evitar tarjetas dentro de tarjetas.

### Fase 4: QA visual

Probar contraste y legibilidad en:

- negro;
- Amiga/Workbench;
- NeXT;
- Kali;
- temas claros, especialmente Atari ST y Workbench claro.

Comprobar que animaciones se apagan o reducen con `prefers-reduced-motion`.

## Test plan

- Verificar que no se importa `cybercore.min.css`.
- Ejecutar `npm run check` tras implementar estilos o iconos.
- Ejecutar `npm run build` tras cualquier cambio CSS/asset.
- Revisar visualmente scanner, deck overlay y run log en viewport móvil.
- Confirmar que temas claros mantienen contraste suficiente.

## Supuestos

- La estética de `shadowHack` sigue siendo propia.
- Cybercore CSS se usa como inspiración y cantera puntual, no como dependencia base.
- La primera implementación debe ser pequeña y reversible.
- Cualquier copia sustancial de código o SVG requiere atribución MIT.
