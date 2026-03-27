export interface AuthUser {
  userId: string;
  email: string;
}

export interface AuthValidationOptions {
  expectedIssuer?: string;
  expectedAudience?: string;
  allowedAuthorizedParties?: string[];
  allowedTokenUses?: string[];
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

function normalizeIssuer(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeAuthorizedParty(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function parseAudience(aud: string | string[] | undefined): string[] {
  if (!aud) return [];
  return Array.isArray(aud) ? aud : [aud];
}

function isValidTokenUse(tokenUse: string, allowedTokenUses: string[]): boolean {
  return allowedTokenUses.some((allowed) => allowed === tokenUse);
}

function isValidIssuer(issuer: string, expectedIssuer?: string): boolean {
  if (!expectedIssuer) return false;

  try {
    const parsed = new URL(issuer);
    if (parsed.protocol !== 'https:') return false;
  } catch {
    return false;
  }

  return normalizeIssuer(issuer) === normalizeIssuer(expectedIssuer);
}

function isValidAuthorizedParty(
  azp: string | undefined,
  allowedAuthorizedParties: string[],
): boolean {
  if (!azp || allowedAuthorizedParties.length === 0) {
    return false;
  }

  const normalizedAzp = normalizeAuthorizedParty(azp);

  return allowedAuthorizedParties
    .map((entry) => normalizeAuthorizedParty(entry))
    .some((entry) => entry === normalizedAzp);
}

function isValidAudience(
  aud: string | string[] | undefined,
  expectedAudience?: string,
): boolean {
  if (!expectedAudience) return false;

  const audiences = parseAudience(aud);
  if (audiences.length === 0) return false;
  return audiences.some((value) => value === expectedAudience);
}

interface JwtPayload {
  sub?: string;
  exp?: number;
  nbf?: number;
  email?: string;
  iss?: string;
  aud?: string | string[];
  azp?: string;
  token_use?: string;
}

export function validateAuthClaims(
  payload: JwtPayload,
  _request: Request,
  options: AuthValidationOptions = {},
  nowSeconds = Date.now() / 1000,
): boolean {
  if (typeof payload.exp !== 'number' || Number.isNaN(payload.exp) || payload.exp < nowSeconds) return false;
  if (payload.nbf && payload.nbf > nowSeconds) return false;
  if (!payload.sub) return false;
  if (!payload.iss || !isValidIssuer(payload.iss, options.expectedIssuer)) return false;
  if (!isValidAudience(payload.aud, options.expectedAudience)) return false;

  const allowedTokenUses = options.allowedTokenUses?.filter(Boolean) ?? ['session_token', 'access_token'];
  if (!payload.token_use || !isValidTokenUse(payload.token_use, allowedTokenUses)) return false;

  const allowedAuthorizedParties = options.allowedAuthorizedParties?.filter(Boolean) ?? [];
  if (!isValidAuthorizedParty(payload.azp, allowedAuthorizedParties)) return false;

  return true;
}

export async function getAuthenticatedUser(
  request: Request,
  clerkSecretKey: string,
  options: AuthValidationOptions = {},
): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const header = JSON.parse(base64urlDecode(headerB64)) as { kid?: string };
    const payload = JSON.parse(base64urlDecode(payloadB64)) as JwtPayload;
    if (!validateAuthClaims(payload, request, options)) return null;

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
