const BASE = '/assets';

export const assetPaths = {
  logo: `${BASE}/logos/logo-shadowhack.svg`,
  splash: `${BASE}/logos/splash-shadowhack.svg`,
  backgrounds: {
    default: `${BASE}/backgrounds/bg-default.svg`,
    retail: `${BASE}/backgrounds/bg-retail.svg`,
    food: `${BASE}/backgrounds/bg-food.svg`,
    finance: `${BASE}/backgrounds/bg-finance.svg`,
    medical: `${BASE}/backgrounds/bg-medical.svg`,
    industrial: `${BASE}/backgrounds/bg-industrial.svg`,
    government: `${BASE}/backgrounds/bg-government.svg`,
    security: `${BASE}/backgrounds/bg-security.svg`,
    tech: `${BASE}/backgrounds/bg-tech.svg`,
    unknown: `${BASE}/backgrounds/bg-unknown.svg`,
  },
  programs: {
    scan: `${BASE}/programs/program-scan.svg`,
    spike: `${BASE}/programs/program-spike.svg`,
    ghost: `${BASE}/programs/program-ghost.svg`,
    shield: `${BASE}/programs/program-shield.svg`,
    extract: `${BASE}/programs/program-extract.svg`,
  },
  defenses: {
    watcher: `${BASE}/defenses/ice-watcher.svg`,
    piercer: `${BASE}/defenses/ice-piercer.svg`,
    tracer: `${BASE}/defenses/ice-tracer.svg`,
    locker: `${BASE}/defenses/ice-locker.svg`,
    crasher: `${BASE}/defenses/ice-crasher.svg`,
  },
};

export function getHostBackground(archetype) {
  return assetPaths.backgrounds[archetype] ?? assetPaths.backgrounds.default;
}
