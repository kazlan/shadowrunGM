import { mkdir, writeFile } from 'node:fs/promises';

const palette = {
  bg: '#050716',
  cyan: '#33ffcc',
  magenta: '#ff3df2',
  red: '#ff3d6e',
  yellow: '#f8d66d',
  blue: '#7aa2ff',
  orange: '#ff9f43',
  purple: '#b084ff',
  green: '#33ff66',
};

const backgrounds = {
  default: [palette.cyan, palette.magenta],
  retail: [palette.cyan, palette.yellow],
  food: [palette.yellow, palette.cyan],
  finance: [palette.red, palette.cyan],
  medical: [palette.blue, palette.cyan],
  industrial: [palette.orange, palette.cyan],
  government: [palette.purple, palette.cyan],
  security: [palette.magenta, palette.red],
  tech: [palette.green, palette.magenta],
  unknown: [palette.cyan, palette.blue],
};

const programs = {
  scan: ['circle', palette.cyan],
  spike: ['triangle', palette.red],
  ghost: ['ghost', palette.magenta],
  shield: ['shield', palette.blue],
  extract: ['extract', palette.yellow],
};

const defenses = {
  watcher: ['eye', palette.yellow],
  piercer: ['triangle', palette.red],
  tracer: ['target', palette.purple],
  locker: ['hex', palette.blue],
  crasher: ['crash', palette.orange],
};

await mkdir('public/assets/backgrounds', { recursive: true });
await mkdir('public/assets/logos', { recursive: true });
await mkdir('public/assets/programs', { recursive: true });
await mkdir('public/assets/defenses', { recursive: true });
await mkdir('public/assets/characters', { recursive: true });
await mkdir('public/assets/ui', { recursive: true });

for (const [name, colors] of Object.entries(backgrounds)) {
  await writeFile(`public/assets/backgrounds/bg-${name}.svg`, backgroundSvg(name, colors));
}

await writeFile('public/assets/logos/logo-shadowhack.svg', logoSvg());
await writeFile('public/assets/logos/splash-shadowhack.svg', splashSvg());
await writeFile('public/assets/characters/decker-placeholder.svg', characterSvg());
await writeFile('public/assets/ui/overlay-scanlines.svg', scanlineOverlaySvg());

for (const [name, [shape, color]] of Object.entries(programs)) {
  await writeFile(`public/assets/programs/program-${name}.svg`, iconSvg(name.toUpperCase(), shape, color));
}

for (const [name, [shape, color]] of Object.entries(defenses)) {
  await writeFile(`public/assets/defenses/ice-${name}.svg`, iconSvg(name.toUpperCase(), shape, color));
}

function backgroundSvg(name, [primary, secondary]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" role="img" aria-label="shadowHack ${name} background placeholder">
  <defs>
    <radialGradient id="g" cx="50%" cy="20%" r="80%">
      <stop offset="0" stop-color="${primary}" stop-opacity="0.28"/>
      <stop offset="0.45" stop-color="${secondary}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${palette.bg}" stop-opacity="1"/>
    </radialGradient>
    <pattern id="grid" width="90" height="90" patternUnits="userSpaceOnUse">
      <path d="M90 0H0V90" fill="none" stroke="${primary}" stroke-opacity="0.13" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="1080" height="1920" fill="${palette.bg}"/>
  <rect width="1080" height="1920" fill="url(#g)"/>
  <rect width="1080" height="1920" fill="url(#grid)" opacity="0.75"/>
  ${nodeNetwork(primary, secondary)}
  <text x="80" y="170" fill="${primary}" fill-opacity="0.7" font-family="monospace" font-size="54" letter-spacing="8">${name.toUpperCase()}</text>
  <text x="80" y="238" fill="#d7fff6" fill-opacity="0.35" font-family="monospace" font-size="28" letter-spacing="4">PLACEHOLDER // DROP FINAL ART HERE</text>
</svg>
`;
}

function nodeNetwork(primary, secondary) {
  const points = [
    [160, 420], [420, 330], [750, 460], [910, 760], [650, 940],
    [280, 820], [160, 1180], [470, 1320], [820, 1220], [930, 1540], [540, 1660], [210, 1500],
  ];
  const lines = points.slice(1).map((point, index) => `<line x1="${points[index][0]}" y1="${points[index][1]}" x2="${point[0]}" y2="${point[1]}" stroke="${secondary}" stroke-opacity="0.26" stroke-width="6"/>`).join('\n  ');
  const circles = points.map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="${index % 3 === 0 ? 28 : 18}" fill="${palette.bg}" stroke="${primary}" stroke-opacity="0.72" stroke-width="6"/>`).join('\n  ');
  return `<g opacity="0.95">${lines}\n  ${circles}</g>`;
}

function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="shadowHack logo placeholder">
  <rect width="1024" height="1024" rx="210" fill="${palette.bg}"/>
  <path d="M512 116 820 300v424L512 908 204 724V300z" fill="none" stroke="${palette.cyan}" stroke-width="34"/>
  <path d="M512 246v160M512 618v160M279 381l142 82M603 561l142 82M745 381l-142 82M421 561l-142 82" stroke="${palette.magenta}" stroke-width="30" stroke-linecap="round"/>
  <circle cx="512" cy="512" r="104" fill="${palette.cyan}" fill-opacity="0.18" stroke="${palette.cyan}" stroke-width="28"/>
  <text x="512" y="548" text-anchor="middle" fill="#d7fff6" font-family="monospace" font-weight="700" font-size="72">SH</text>
</svg>
`;
}

function splashSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" role="img" aria-label="shadowHack splash placeholder">
  <rect width="1080" height="1920" fill="${palette.bg}"/>
  <circle cx="540" cy="820" r="250" fill="${palette.cyan}" fill-opacity="0.08" stroke="${palette.cyan}" stroke-width="10"/>
  <path d="M540 430 850 610v420l-310 180-310-180V610z" fill="none" stroke="${palette.cyan}" stroke-width="18"/>
  <text x="540" y="1380" text-anchor="middle" fill="${palette.cyan}" font-family="monospace" font-size="78" letter-spacing="10">shadowHack</text>
  <text x="540" y="1450" text-anchor="middle" fill="${palette.magenta}" fill-opacity="0.72" font-family="monospace" font-size="28" letter-spacing="5">SPLASH PLACEHOLDER</text>
</svg>
`;
}

function characterSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 1024" role="img" aria-label="decker character placeholder">
  <rect width="768" height="1024" fill="none"/>
  <circle cx="384" cy="260" r="118" fill="${palette.bg}" stroke="${palette.cyan}" stroke-width="12"/>
  <path d="M220 900c20-220 70-360 164-360s144 140 164 360" fill="${palette.cyan}" fill-opacity="0.12" stroke="${palette.cyan}" stroke-width="12"/>
  <path d="M270 260h228" stroke="${palette.magenta}" stroke-width="18" stroke-linecap="round"/>
  <text x="384" y="970" text-anchor="middle" fill="${palette.cyan}" font-family="monospace" font-size="34">DECKER PLACEHOLDER</text>
</svg>
`;
}

function scanlineOverlaySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="scanlines overlay placeholder">
  <rect width="64" height="64" fill="none"/>
  <path d="M0 4h64M0 12h64M0 20h64M0 28h64M0 36h64M0 44h64M0 52h64M0 60h64" stroke="${palette.cyan}" stroke-opacity="0.22"/>
</svg>
`;
}

function iconSvg(label, shape, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${label} placeholder icon">
  <rect width="256" height="256" rx="48" fill="${palette.bg}" fill-opacity="0.92"/>
  ${shapeMarkup(shape, color)}
  <text x="128" y="222" text-anchor="middle" fill="${color}" font-family="monospace" font-size="24" letter-spacing="2">${label.slice(0, 6)}</text>
</svg>
`;
}

function shapeMarkup(shape, color) {
  if (shape === 'circle') return `<circle cx="128" cy="104" r="52" fill="none" stroke="${color}" stroke-width="14"/><path d="m164 140 42 42" stroke="${color}" stroke-width="14" stroke-linecap="round"/>`;
  if (shape === 'triangle') return `<path d="M128 38 206 170H50z" fill="none" stroke="${color}" stroke-width="14" stroke-linejoin="round"/>`;
  if (shape === 'ghost') return `<path d="M72 178V92a56 56 0 0 1 112 0v86l-28-18-28 18-28-18z" fill="none" stroke="${color}" stroke-width="14" stroke-linejoin="round"/>`;
  if (shape === 'shield') return `<path d="M128 38 198 66v62c0 52-28 82-70 104-42-22-70-52-70-104V66z" fill="none" stroke="${color}" stroke-width="14" stroke-linejoin="round"/>`;
  if (shape === 'extract') return `<path d="M64 78h88v44h40l-64 64-64-64h40V78z" fill="none" stroke="${color}" stroke-width="14" stroke-linejoin="round"/>`;
  if (shape === 'eye') return `<path d="M34 118s36-58 94-58 94 58 94 58-36 58-94 58-94-58-94-58z" fill="none" stroke="${color}" stroke-width="12"/><circle cx="128" cy="118" r="28" fill="none" stroke="${color}" stroke-width="12"/>`;
  if (shape === 'target') return `<circle cx="128" cy="112" r="72" fill="none" stroke="${color}" stroke-width="10"/><circle cx="128" cy="112" r="38" fill="none" stroke="${color}" stroke-width="10"/><path d="M128 24v34M128 166v34M40 112h34M182 112h34" stroke="${color}" stroke-width="10" stroke-linecap="round"/>`;
  if (shape === 'hex') return `<path d="M128 36 202 78v84l-74 42-74-42V78z" fill="none" stroke="${color}" stroke-width="14" stroke-linejoin="round"/>`;
  if (shape === 'crash') return `<path d="m70 54 116 116M186 54 70 170" stroke="${color}" stroke-width="16" stroke-linecap="round"/><path d="M128 28v42M128 154v42" stroke="${color}" stroke-width="10" stroke-linecap="round"/>`;
  return `<circle cx="128" cy="112" r="60" fill="none" stroke="${color}" stroke-width="14"/>`;
}
