import { assetPaths } from '../assets/assetRegistry.js';

export function renderLandingPage() {
  return `<main class="landing-shell">
    <div class="landing-scanline" aria-hidden="true"></div>
    <section class="landing-hero" aria-labelledby="landing-title">
      <div class="landing-hero__copy">
        <img class="landing-hero__logo" src="${assetPaths.logo}" alt="" />
        <p class="eyebrow">Juego en el mundo real · demo jugable</p>
        <h1 id="landing-title">shadowHack</h1>
        <p class="landing-hero__lead">Sal a la calle y convierte lugares reales en hosts jugables.</p>
        <p class="landing-hero__text">shadowHack usa tu entorno como tablero: cafeterías, clínicas, tiendas y oficinas cercanas se transforman en redes ficticias que puedes infiltrar desde el móvil.</p>
        <div class="landing-hero__actions">
          <a class="landing-cta landing-cta--primary" href="/play">Jugar demo</a>
        <a class="landing-cta" href="#que-es">Qué es shadowHack</a>
        </div>
        <p class="landing-privacy">Puedes probar sin permisos con objetivos demo. Cuando activas el scanner local, tu ubicación solo sirve para encontrar objetivos reales cercanos.</p>
      </div>
      <div class="landing-terminal" aria-label="Estado de ejemplo del deck">
        <div class="landing-terminal__bar">
          <span>deck://shadowhack</span>
          <b>live</b>
        </div>
        <div class="landing-terminal__map" aria-hidden="true">
          <i class="landing-node landing-node--entry"></i>
          <i class="landing-node landing-node--data"></i>
          <i class="landing-node landing-node--ice"></i>
          <i class="landing-node landing-node--core"></i>
          <svg viewBox="0 0 320 210" focusable="false">
            <path d="M55 155 C105 92 132 76 170 96 S238 117 270 44" />
            <path d="M170 96 L238 166" />
          </svg>
        </div>
        <dl class="landing-terminal__meters">
          <div><dt>ALERTA</dt><dd>03/10</dd></div>
          <div><dt>TRAZA</dt><dd>02/08</dd></div>
          <div><dt>SHELL</dt><dd>09/10</dd></div>
        </dl>
      </div>
    </section>

    <section class="landing-section" id="que-es" aria-labelledby="landing-about-title">
      <div class="landing-section__header">
        <p class="eyebrow">Qué es</p>
        <h2 id="landing-about-title">Tu barrio se convierte en mapa de intrusión</h2>
      </div>
      <div class="landing-feature-grid">
        <article>
          <strong>Runs tácticas</strong>
          <span>Cada objetivo se juega como una red de nodos: lee rutas, rompe defensas, ocúltate y extrae datos antes de salir.</span>
        </article>
        <article>
          <strong>Mundo real</strong>
          <span>El scanner local busca lugares cercanos y los convierte en hosts ficticios con dificultad, recompensa y personalidad propias.</span>
        </article>
        <article>
          <strong>Deck persistente</strong>
          <span>El cred ganado mejora memoria, atributos, programas y bookmarks para encadenar objetivos.</span>
        </article>
        <article>
          <strong>Sin permisos para probar</strong>
          <span>La primera run arranca con sandbox local; el salto al mundo real ocurre solo cuando decides activar ubicación.</span>
        </article>
      </div>
    </section>
  </main>`;
}
