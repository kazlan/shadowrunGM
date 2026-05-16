const STORAGE_KEY = 'shadowhack.uiTheme.v1';

export const themeCatalog = [
  {
    key: 'black',
    label: 'Negro',
    description: 'Deck oscuro de alto contraste.',
    swatches: ['#050716', '#33ffcc', '#ff3df2'],
  },
  {
    key: 'amiga',
    label: 'Amiga 1200',
    description: 'Inspirado en paletas Workbench 3.1.',
    swatches: ['#7b8192', '#1d4ea3', '#ff8c2a'],
  },
  {
    key: 'next',
    label: 'NeXT',
    description: 'Estación sobria, gris y precisa.',
    swatches: ['#101010', '#d9d9d9', '#ff3b2f'],
  },
  {
    key: 'kali',
    label: 'Kali',
    description: 'Azules fríos y terminal ofensiva.',
    swatches: ['#07131f', '#00d4ff', '#2b6bff'],
  },
  {
    key: 'workbench-light',
    label: 'Workbench claro',
    description: 'Gris luminoso con acentos de escritorio clásico.',
    swatches: ['#e5e8f0', '#1f5fbf', '#ff8c2a'],
  },
  {
    key: 'solar-light',
    label: 'Solar claro',
    description: 'Tema claro de lectura con acentos cyberpunk suaves.',
    swatches: ['#f6f3e8', '#007a8a', '#c23b7a'],
  },
  {
    key: 'atari-light',
    label: 'Atari ST claro',
    description: 'Gris de escritorio con acentos azul ST.',
    swatches: ['#f2f2f2', '#0057c2', '#00a08a'],
  },
];

export function loadThemePreference() {
  try {
    if (!globalThis.localStorage) return themeCatalog[0].key;
    return normalizeThemeKey(localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    console.warn('Could not load UI theme', error);
    return themeCatalog[0].key;
  }
}

export function saveThemePreference(themeKey) {
  const normalized = normalizeThemeKey(themeKey);
  try {
    if (globalThis.localStorage) localStorage.setItem(STORAGE_KEY, normalized);
  } catch (error) {
    console.warn('Could not persist UI theme', error);
  }
  return normalized;
}

export function applyTheme(themeKey) {
  const normalized = normalizeThemeKey(themeKey);
  globalThis.document?.documentElement?.setAttribute('data-theme', normalized);
  return normalized;
}

export function normalizeThemeKey(themeKey) {
  const candidate = String(themeKey ?? '');
  return themeCatalog.some((theme) => theme.key === candidate) ? candidate : themeCatalog[0].key;
}
