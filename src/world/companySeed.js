export function normalizeSeedText(value) {
  return (value ?? 'unknown')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalizeCompany(company) {
  return [
    company.provider,
    normalizeSeedText(company.providerId),
    normalizeSeedText(company.name),
    normalizeSeedText(company.category),
    company.lat.toFixed(5),
    company.lon.toFixed(5),
  ].join('|');
}

export async function hashCompany(company) {
  const canonical = canonicalizeCompany(company);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const seedHex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return {
    canonical,
    seedHex,
    seedId: seedHex.slice(0, 12),
  };
}
