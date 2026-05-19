import { assetPaths } from '../assets/assetRegistry.js';

export function renderLandingPage() {
  return `<main class="landing-shell">
    <div class="landing-scanline" aria-hidden="true"></div>
    <section class="landing-hero" aria-labelledby="landing-title">
      <div class="landing-hero__scene" aria-hidden="true">
        <svg viewBox="0 0 1200 720" focusable="false">
          <path class="landing-route landing-route--main" d="M116 514 C236 374 365 332 484 378 S684 504 826 319 1022 206 1112 164" />
          <path class="landing-route" d="M285 459 C396 538 536 552 642 461 S790 314 940 396" />
          <path class="landing-route" d="M390 262 C512 226 605 260 688 342" />
        </svg>
        <i class="landing-ping landing-ping--cafe"><b>Café Kitsune</b><span>host food · B</span></i>
        <i class="landing-ping landing-ping--clinic"><b>Clínica Norte</b><span>bio-data · A</span></i>
        <i class="landing-ping landing-ping--bank"><b>Banco Delta</b><span>vault · AA</span></i>
        <i class="landing-ping landing-ping--repair"><b>Dataforge Repair</b><span>tech node · B</span></i>
      </div>
      <div class="landing-hero__copy">
        <img class="landing-hero__logo" src="${assetPaths.logo}" alt="" />
        <p class="eyebrow">Juego en el mundo real · PWA móvil</p>
        <h1 id="landing-title">shadowHack</h1>
        <p class="landing-hero__lead">Tu ciudad se convierte en una red de hosts que puedes infiltrarte desde el móvil.</p>
        <p class="landing-hero__text">Activa el scanner, elige un lugar cercano y shadowHack lo transforma en un sistema ficticio con nodos, defensas, paydata, alerta, traza y recompensa.</p>
        <div class="landing-hero__actions">
          <a class="landing-cta landing-cta--primary" href="/play">Jugar demo</a>
          <a class="landing-cta" href="#como-funciona">Ver cómo funciona</a>
        </div>
        <p class="landing-privacy">Puedes probar sin permisos con objetivos demo. Cuando activas el scanner local, tu ubicación solo sirve para encontrar objetivos reales cercanos.</p>
        <dl class="landing-hero__signals" aria-label="Contenido actual del prototipo">
          <div><dt>5</dt><dd>programas tácticos</dd></div>
          <div><dt>7</dt><dd>eventos de nodo</dd></div>
          <div><dt>3</dt><dd>relojes de presión</dd></div>
        </dl>
      </div>
    </section>

    <section class="landing-section landing-live" id="como-funciona" aria-labelledby="landing-live-title">
      <div class="landing-section__header">
        <p class="eyebrow">Cómo se juega</p>
        <h2 id="landing-live-title">Del negocio de la esquina al núcleo del host</h2>
      </div>
      <div class="landing-live__grid">
        <div class="landing-terminal landing-terminal--scanner" aria-label="Scanner de objetivos">
          <div class="landing-terminal__bar">
            <span>scanner://nearby</span>
            <b>mundo real</b>
          </div>
          <ol class="landing-target-list">
            <li><strong>Café Kitsune</strong><span>food · tier B · 420m</span></li>
            <li><strong>Clínica Norte</strong><span>medical · tier A · 610m</span></li>
            <li><strong>Dataforge Repair</strong><span>tech · tier B · 780m</span></li>
          </ol>
        </div>
        <div class="landing-terminal landing-terminal--run" aria-label="Run de ejemplo">
        <div class="landing-terminal__bar">
            <span>run://payload</span>
            <b>turno 06</b>
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
      </div>
    </section>

    <section class="landing-section" id="que-es" aria-labelledby="landing-about-title">
      <div class="landing-section__header">
        <p class="eyebrow">Contenido actual</p>
        <h2 id="landing-about-title">Ya hay un bucle jugable completo</h2>
      </div>
      <div class="landing-feature-grid">
        <article>
          <strong>Scanner local</strong>
          <span>Busca lugares cercanos, usa fallback demo si hace falta y convierte cada objetivo en un host ficticio.</span>
        </article>
        <article>
          <strong>Hosts deterministas</strong>
          <span>La misma empresa normalizada genera el mismo mapa, defensas, dificultad y recompensa de juego.</span>
        </article>
        <article>
          <strong>Eventos de nodo</strong>
          <span>Archivos, puertas, cámaras, señuelos, trampas, núcleo y salida piden respuestas tácticas distintas.</span>
        </article>
        <article>
          <strong>Programas v1</strong>
          <span>Scan, Spike, Ghost, Shield y Extract resuelven la run sin menús pesados ni reglas prestadas.</span>
        </article>
        <article>
          <strong>Deck persistente</strong>
          <span>Ganas cred para mejorar Pulse, Veil, Lens, Shell, memoria, programas y capacidad de bookmarks.</span>
        </article>
        <article>
          <strong>Bookmarks</strong>
          <span>Guardar un host permite usarlo como proxy remoto y saltar de un punto real a otro en futuras runs.</span>
        </article>
        <article>
          <strong>Presión clara</strong>
          <span>Alerta, traza e integridad sustituyen contabilidad pesada por tensión visible en cada decisión.</span>
        </article>
        <article>
          <strong>Privacidad por defecto</strong>
          <span>La ubicación sirve para descubrir objetivos cercanos, no para crear un historial sensible.</span>
        </article>
      </div>
    </section>

    <section class="landing-section landing-play" aria-labelledby="landing-play-title">
      <div>
        <p class="eyebrow">Listo para probar</p>
        <h2 id="landing-play-title">Primero sandbox. Luego tu calle.</h2>
      </div>
      <a class="landing-cta landing-cta--primary" href="/play">Entrar al deck</a>
    </section>
  </main>`;
}
