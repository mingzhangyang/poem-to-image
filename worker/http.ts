export class PayloadTooLargeError extends Error {
  constructor(public readonly limitBytes: number) {
    super(`Request body exceeds the ${limitBytes}-byte limit.`);
  }
}

export class InvalidRequestBodyError extends Error {
  constructor(message = 'Request body must be valid JSON.') {
    super(message);
  }
}

export const REQUEST_BODY_LIMITS = {
  aiGeneration: 16 * 1024,
  checkout: 8 * 1024,
  template: 40 * 1024,
  stripeWebhook: 256 * 1024,
} as const;

const HTML_CSP = "base-uri 'self'; frame-ancestors 'none'; object-src 'none'";

export function applySecurityHeaders(
  response: Response,
  { noStore = false }: { noStore?: boolean } = {},
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  if (noStore) headers.set('Cache-Control', 'no-store');

  const contentType = headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('text/html')) {
    headers.set('Content-Security-Policy', HTML_CSP);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function jsonResponse(data: unknown, status = 200): Response {
  return applySecurityHeaders(Response.json(data, { status }), { noStore: true });
}

export function methodNotAllowed(allowed: readonly string[]): Response {
  const response = jsonResponse({ error: 'Method not allowed.' }, 405);
  response.headers.set('Allow', allowed.join(', '));
  return response;
}

export function bodyErrorResponse(error: unknown): Response | null {
  if (error instanceof PayloadTooLargeError) {
    return jsonResponse(
      { error: 'Payload too large.', code: 'PAYLOAD_TOO_LARGE', limitBytes: error.limitBytes },
      413,
    );
  }
  if (error instanceof InvalidRequestBodyError) {
    return jsonResponse({ error: error.message, code: 'INVALID_BODY' }, 400);
  }
  return null;
}

function declaredContentLength(request: Request): number | null {
  const raw = request.headers.get('content-length');
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function readBoundedText(request: Request, limitBytes: number): Promise<string> {
  const contentLength = declaredContentLength(request);
  if (contentLength !== null && contentLength > limitBytes) {
    throw new PayloadTooLargeError(limitBytes);
  }

  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > limitBytes) {
        await reader.cancel('Payload too large.');
        throw new PayloadTooLargeError(limitBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new InvalidRequestBodyError('Request body must be valid UTF-8.');
  }
}

export async function readJsonBody(request: Request, limitBytes: number): Promise<unknown> {
  const raw = await readBoundedText(request, limitBytes);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new InvalidRequestBodyError();
  }
}
