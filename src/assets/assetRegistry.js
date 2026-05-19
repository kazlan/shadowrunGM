const BASE = '/assets';
const runnerAvatarPaths = Object.fromEntries(
  Array.from({ length: 36 }, (_, index) => {
    const id = String(index + 1).padStart(2, '0');
    return [`runner${id}`, `${BASE}/avatars/avatar-runner-${id}.png`];
  }),
);

export const assetPaths = {
  logo: `${BASE}/logos/logo-shadowhack.svg`,
  splash: `${BASE}/logos/splash-shadowhack.svg`,
  backgrounds: {
    tronTest: `${BASE}/backgrounds/tron_1.png`,
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
  defensePng: {
    watcher: `${BASE}/defenses-png/ice-watcher.png`,
    piercer: `${BASE}/defenses-png/ice-piercer.png`,
    tracer: `${BASE}/defenses-png/ice-tracer.png`,
    locker: `${BASE}/defenses-png/ice-locker.png`,
    crasher: `${BASE}/defenses-png/ice-crasher.png`,
  },
  nodes: {
    entry: `${BASE}/nodes-png/node-entry.png`,
    firewall: `${BASE}/nodes-png/node-firewall.png`,
    data: `${BASE}/nodes-png/node-data.png`,
    camera: `${BASE}/nodes-png/node-camera.png`,
    database: `${BASE}/nodes-png/node-database.png`,
    core: `${BASE}/nodes-png/node-core.png`,
    exit: `${BASE}/nodes-png/node-exit.png`,
  },
  avatars: {
    ...runnerAvatarPaths,
  },
  stats: {
    pulse: `${BASE}/stats/stat-pulse.svg`,
    veil: `${BASE}/stats/stat-veil.svg`,
    lens: `${BASE}/stats/stat-lens.svg`,
    shell: `${BASE}/stats/stat-shell.svg`,
  },
};

export function getHostBackground(archetype) {
  return assetPaths.backgrounds.tronTest ?? assetPaths.backgrounds[archetype] ?? assetPaths.backgrounds.default;
}
