export interface AuthUser {
  userId: string;
  email: string;
}

interface JwkKey {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

// In-memory JWKS cache per Worker instance lifetime
let cachedKeys: JwkKey[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchJwks(clerkSecretKey: string): Promise<JwkKey[]> {
  const now = Date.now();
  if (cachedKeys && now - cacheTime < CACHE_TTL_MS) {
    return cachedKeys;
  }

  const response = await fetch('https://api.clerk.com/v1/jwks', {
    headers: { Authorization: `Bearer ${clerkSecretKey}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch JWKS from Clerk');
  }

  const data = (await response.json()) as { keys: JwkKey[] };
  cachedKeys = data.keys;
  cacheTime = now;
  return cachedKeys;
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function base64urlDecode(base64url: string): string {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  return atob(pad ? base64 + '='.repeat(4 - pad) : base64);
}

export async function getAuthenticatedUser(request: Request, clerkSecretKey: string): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const header = JSON.parse(base64urlDecode(headerB64)) as { kid?: string };
    const payload = JSON.parse(base64urlDecode(payloadB64)) as {
      sub: string;
      exp?: number;
      email?: string;
    };

    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    if (!header.kid) return null;

    const keys = await fetchJwks(clerkSecretKey);
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = base64urlToUint8Array(signatureB64);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sig, data);

    if (!valid) return null;

    return { userId: payload.sub, email: payload.email ?? '' };
  } catch {
    return null;
  }
}
