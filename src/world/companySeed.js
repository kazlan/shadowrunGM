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
  const bytes = encodeText(canonical);
  const seedHex = await digestSeedHex(bytes);

  return {
    canonical,
    seedHex,
    seedId: seedHex.slice(0, 12),
  };
}

function encodeText(value) {
  if (globalThis.TextEncoder) return new TextEncoder().encode(value);

  const encoded = encodeURIComponent(value);
  const bytes = [];

  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }

  return Uint8Array.from(bytes);
}

async function digestSeedHex(bytes) {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return bytesToHex(new Uint8Array(digest));
  }

  return fallbackDigestSeedHex(bytes);
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fallbackDigestSeedHex(bytes) {
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5];

  return seeds
    .map((seed, seedIndex) => {
      let hash = seed;
      for (let index = 0; index < bytes.length; index += 1) {
        hash ^= bytes[index] + seedIndex;
        hash = Math.imul(hash, 0x01000193);
        hash ^= hash >>> 13;
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    })
    .join('');
}
