import { programs } from '../game/programCatalog.js';
import { escapeHtml } from './html.js';

const gameSteps = [
  'Elige un objetivo cercano o demo para generar un host determinista.',
  'Usa Scan para revelar nodos conectados antes de saltar.',
  'Toca un nodo descubierto y conectado para moverte por la red.',
  'Neutraliza defensas con Spike, o gana margen con Ghost y Shield.',
  'Extrae payload en nodos de datos, base de datos o núcleo.',
  'Vuelve a la entrada o a una salida y pulsa Jack out antes de agotar alerta, traza o shell.',
];

const statHelp = [
  {
    label: 'ALERTA',
    description: 'Ruido dentro del host. Sube al moverte a nodos recién descubiertos, fallar o usar acciones ruidosas; si llega a 10, las contramedidas cierran la run.',
  },
  {
    label: 'TRAZA',
    description: 'Rastreo hacia tu posición. La suben defensas como Tracer, desconexiones forzadas y presión alta; si llega a 8, el host te expulsa.',
  },
  {
    label: 'SHELL',
    description: 'Integridad de tu avatar/deck. Baja por hielo ofensivo, fallos y dump shock; si llega a 0, quedas dumped.',
  },
];

export function renderHelpOverlay(isOpen) {
  if (!isOpen) return '';

  const programHelp = programs
    .map(
      (program) => `<li>
        <strong>${escapeHtml(program.label)}</strong>
        <span>${escapeHtml(program.description)}</span>
      </li>`,
    )
    .join('');

  const steps = gameSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
  const stats = statHelp
    .map(
      (stat) => `<li>
        <strong>${escapeHtml(stat.label)}</strong>
        <span>${escapeHtml(stat.description)}</span>
      </li>`,
    )
    .join('');

  return `<aside class="help-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <button class="help-overlay__backdrop" data-action="closeHelp" type="button" aria-label="Cerrar ayuda"></button>
    <section class="help-panel">
      <div class="help-panel__header">
        <div>
          <p class="eyebrow">Manual rápido</p>
          <h2 id="help-title">Cómo correr el host</h2>
        </div>
        <button class="help-close" data-action="closeHelp" type="button" aria-label="Cerrar ayuda">×</button>
      </div>
      <div class="help-panel__content">
        <div>
          <h3>Programas</h3>
          <ol class="help-list help-list--programs">${programHelp}</ol>
        </div>
        <div>
          <h3>Stats</h3>
          <ol class="help-list">${stats}</ol>
        </div>
        <div>
          <h3>Instrucciones</h3>
          <ol class="help-list">${steps}</ol>
        </div>
      </div>
    </section>
  </aside>`;
}
