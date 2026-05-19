import { createHash } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { resolveNearbyTargets, validationError } from './src/targetSearch.js';

const GEOAPIFY_API_KEY = defineSecret('GEOAPIFY_API_KEY');
const app = initializeApp();
const databaseId = process.env.FIRESTORE_DATABASE_ID || 'shadowhack';
const db = getFirestore(app, databaseId);

const RATE_LIMIT_PER_DAY = 20;
const RATE_LIMIT_COLLECTION = 'scanRateLimits';

export const getNearbyTargets = onRequest({
  region: 'europe-southwest1',
  maxInstances: 4,
  secrets: [GEOAPIFY_API_KEY],
}, async (req, res) => {
  if (!applyCors(req, res)) return;
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    await enforceRateLimit(req);
    const result = await resolveNearbyTargets({
      db,
      fetchImpl: fetch,
      geoapifyApiKey: secretValue(GEOAPIFY_API_KEY) || process.env.GEOAPIFY_API_KEY || '',
      input: req.body ?? {},
    });
    res.status(200).json(result);
  } catch (error) {
    if (error?.code === validationError.code) {
      res.status(400).json({ error: 'invalid_request', message: error.message });
      return;
    }
    if (error?.code === 'rate_limited') {
      res.status(429).json({ error: 'rate_limited', message: 'Scanner backend rate limit reached.' });
      return;
    }
    console.error('getNearbyTargets failed', error);
    res.status(500).json({ error: 'targets_unavailable' });
  }
});

function secretValue(secret) {
  try {
    return secret.value();
  } catch {
    return '';
  }
}

function applyCors(req, res) {
  const origin = req.get('origin');
  if (!origin) return true;
  if (!allowedOrigins().has(origin)) {
    res.status(403).json({ error: 'origin_not_allowed' });
    return false;
  }
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return true;
}

function allowedOrigins() {
  const configured = (process.env.SHADOWHACK_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([
    'http://localhost:4174',
    'http://127.0.0.1:4174',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...configured,
  ]);
}

async function enforceRateLimit(req) {
  const day = new Date().toISOString().slice(0, 10);
  const fingerprint = hashRateLimitFingerprint(day, requestIp(req), req.get('user-agent') ?? '');
  const ref = db.collection(RATE_LIMIT_COLLECTION).doc(fingerprint);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.exists ? snapshot.data().count : 0);
    if (count >= RATE_LIMIT_PER_DAY) {
      const error = new Error('Rate limited');
      error.code = 'rate_limited';
      throw error;
    }
    transaction.set(ref, {
      count: count + 1,
      day,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      updatedAt: new Date(),
    }, { merge: true });
  });
}

function requestIp(req) {
  const forwarded = req.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0].trim() || req.ip || 'unknown';
}

function hashRateLimitFingerprint(day, ip, userAgent) {
  return createHash('sha256')
    .update(`${day}|${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 32);
}
