const profiles = {
  retail: { archetype: 'retail', label: 'Comercio', mapSize: [8, 11], security: 2, dataBias: 3, palette: '#33ffcc' },
  food: { archetype: 'food', label: 'Host hostelero', mapSize: [7, 10], security: 1, dataBias: 2, palette: '#f8d66d' },
  finance: { archetype: 'finance', label: 'Nodo financiero', mapSize: [12, 16], security: 5, dataBias: 5, palette: '#ff3d6e' },
  medical: { archetype: 'medical', label: 'Archivo clínico', mapSize: [10, 14], security: 4, dataBias: 5, palette: '#7aa2ff' },
  industrial: { archetype: 'industrial', label: 'Control industrial', mapSize: [10, 15], security: 4, dataBias: 3, palette: '#ff9f43' },
  government: { archetype: 'government', label: 'Registro cívico', mapSize: [13, 17], security: 5, dataBias: 4, palette: '#b084ff' },
  security: { archetype: 'security', label: 'Malla de seguridad', mapSize: [12, 16], security: 5, dataBias: 2, palette: '#ff3df2' },
  tech: { archetype: 'tech', label: 'Laboratorio de datos', mapSize: [11, 15], security: 4, dataBias: 5, palette: '#33ff66' },
  unknown: { archetype: 'unknown', label: 'Host opaco', mapSize: [8, 13], security: 3, dataBias: 3, palette: '#33ffcc' },
};

export function classifyCompany(company) {
  const haystack = `${company.category ?? ''} ${company.name}`.toLowerCase();

  if (/bank|finance|atm|credit|banco|caja|financ/.test(haystack)) return profiles.finance;
  if (/clinic|hospital|health|pharmacy|medical|clinica|salud|farmacia/.test(haystack)) return profiles.medical;
  if (/police|court|townhall|government|public|ayuntamiento|juzgado|comisaria/.test(haystack)) return profiles.government;
  if (/security|alarm|locksmith|seguridad|alarma/.test(haystack)) return profiles.security;
  if (/software|computer|telecom|data|tech|informatica|electronica/.test(haystack)) return profiles.tech;
  if (/factory|warehouse|industrial|logistics|fabrica|almacen|taller/.test(haystack)) return profiles.industrial;
  if (/restaurant|cafe|bar|bakery|food|comida|cafeteria|panaderia/.test(haystack)) return profiles.food;
  if (/shop|store|retail|market|tienda|supermercado|comercio/.test(haystack)) return profiles.retail;

  return profiles.unknown;
}
