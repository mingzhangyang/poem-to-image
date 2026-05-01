import { getAuthenticatedUser, type AuthUser, type AuthValidationOptions } from './auth';
import type { D1Database } from './db';
import { ensureUser, getBalance, reserveGeneration, finalizeGenerationSuccess, finalizeGenerationFailure, listUserTemplates, createUserTemplate, deleteUserTemplate, renameUserTemplate } from './db';
import {
  handleGetBalance,
  handleGetPackages,
  handleCreateCheckoutSession,
  handleGetCheckoutStatus,
  handleStripeWebhook,
  handleGetHistory,
} from './billing';
import { generateWithGemini, generateWithOpenAi, normalizeProvider, CREDIT_COST } from './ai';

export interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_ISSUER?: string;
  CLERK_JWT_AUDIENCE?: string;
  CLERK_ALLOWED_AUTHORIZED_PARTIES?: string;
  CLERK_ALLOWED_TOKEN_USES?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  DB?: D1Database;
  ASSETS: {
    fetch(input: Request | string, init?: RequestInit): Promise<Response>;
  };
}

const MAX_AI_PROMPT_LENGTH = 500;
const HTML_CSP = "base-uri 'self'; frame-ancestors 'none'; object-src 'none'";

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try { return await fn(); } catch (err) { lastError = err; }
  }
  throw lastError;
}

function applySecurityHeaders(response: Response, { noStore = false }: { noStore?: boolean } = {}): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  if (noStore) {
    headers.set('Cache-Control', 'no-store');
  }

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

function json(data: unknown, status = 200): Response {
  return applySecurityHeaders(Response.json(data, { status }), { noStore: true });
}

function badRequest(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function unauthorized(): Response {
  return json({ error: 'Authentication required.', code: 'UNAUTHORIZED' }, 401);
}

function getAppOrigin(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function parseCsvEnv(raw?: string): string[] | undefined {
  if (!raw) return undefined;
  const items = raw.split(',').map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function hasRequiredAuthConfig(env: Env): boolean {
  const allowedAuthorizedParties = parseCsvEnv(env.CLERK_ALLOWED_AUTHORIZED_PARTIES);
  return !!(env.CLERK_SECRET_KEY && env.CLERK_JWT_ISSUER && env.CLERK_JWT_AUDIENCE && allowedAuthorizedParties?.length);
}

function parseTemplateData(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore malformed template payloads and fall back to metadata-only result
  }
  return {};
}

function getAuthValidationOptions(env: Env): AuthValidationOptions {
  return {
    expectedIssuer: env.CLERK_JWT_ISSUER,
    expectedAudience: env.CLERK_JWT_AUDIENCE,
    allowedAuthorizedParties: parseCsvEnv(env.CLERK_ALLOWED_AUTHORIZED_PARTIES),
    allowedTokenUses: parseCsvEnv(env.CLERK_ALLOWED_TOKEN_USES),
  };
}

async function getAuthenticatedRequestUser(request: Request, env: Env): Promise<AuthUser | null> {
  if (!hasRequiredAuthConfig(env)) return null;
  return getAuthenticatedUser(request, env.CLERK_SECRET_KEY as string, getAuthValidationOptions(env));
}

interface GenerateImageRequest {
  prompt?: string;
  aspectRatio?: string;
  provider?: string;
  requestId?: string;
}

async function handleGenerateAiBackground(request: Request, env: Env): Promise<Response> {
  // Fail closed: AI generation must not be reachable without auth + billing state.
  if (!hasRequiredAuthConfig(env) || !env.DB) {
    return json({ error: 'AI generation is not configured.' }, 503);
  }

  const db = env.DB;
  const user = await getAuthenticatedRequestUser(request, env);
  if (!user) return unauthorized();

  const userId = user.userId;
  const email = user.email;
  await ensureUser(db, userId, email);

  let payload: GenerateImageRequest;
  try {
    payload = (await request.json()) as GenerateImageRequest;
  } catch {
    return badRequest('Request body must be valid JSON.');
  }

  if (!payload.prompt?.trim()) return badRequest('Prompt is required.');
  if (payload.prompt.trim().length > MAX_AI_PROMPT_LENGTH) {
    return badRequest(`Prompt must be ${MAX_AI_PROMPT_LENGTH} characters or fewer.`);
  }

  const prompt = payload.prompt.trim();
  const aspectRatio = payload.aspectRatio || '1:1';
  const provider = normalizeProvider(payload.provider);
  const costCredits = CREDIT_COST[provider];

  if (provider === 'openai' && !env.OPENAI_API_KEY) {
    return badRequest('Missing OPENAI_API_KEY Worker secret.', 500);
  }
  if (provider === 'gemini' && !env.GEMINI_API_KEY) {
    return badRequest('Missing GEMINI_API_KEY Worker secret.', 500);
  }

  const balance = await getBalance(db, userId);
  if (balance < costCredits) {
    return json(
      {
        error: 'Insufficient credits.',
        code: 'INSUFFICIENT_CREDITS',
        balance,
        required: costCredits,
      },
      402,
    );
  }

  let requestId = '';
  let transactionId = '';

  try {
    const reserved = await reserveGeneration(db, userId, provider, prompt.length, costCredits);
    requestId = reserved.requestId;
    transactionId = reserved.transactionId;
  } catch (error) {
    if (error instanceof Error && error.message === 'Insufficient credits.') {
      const latestBalance = await getBalance(db, userId);
      return json(
        {
          error: 'Insufficient credits.',
          code: 'INSUFFICIENT_CREDITS',
          balance: latestBalance,
          required: costCredits,
        },
        402,
      );
    }

    return badRequest('Failed to reserve credits.', 502);
  }

  // Call the AI provider
  try {
    let result: { imageDataUrl: string };

    if (provider === 'openai') {
      result = await generateWithOpenAi(prompt, aspectRatio, env.OPENAI_API_KEY as string);
    } else {
      result = await generateWithGemini(prompt, aspectRatio, env.GEMINI_API_KEY as string);
    }

    // Finalize: deduct credits
    const newBalance = await finalizeGenerationSuccess(db, userId, requestId, transactionId);

    return json({
      imageDataUrl: result.imageDataUrl,
      creditsCharged: costCredits,
      balance: newBalance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate AI background.';

    // Mark as failed (no credit deduction). Retry once on transient DB failure.
    try {
      await withRetry(() => finalizeGenerationFailure(db, userId, requestId, transactionId, costCredits, message));
    } catch {
      return badRequest(
        'Failed to generate AI background and failed to restore reserved credits. Please retry later.',
        502,
      );
    }

    return badRequest(message, 502);
  }
}

const MAX_TEMPLATE_NAME_LENGTH = 100;
const MAX_TEMPLATE_DATA_BYTES = 32_000; // ~32 KB per template

async function handleGetTemplates(request: Request, env: Env): Promise<Response> {
  if (!hasRequiredAuthConfig(env) || !env.DB) return json({ error: 'Not configured.' }, 503);
  const user = await getAuthenticatedRequestUser(request, env);
  if (!user) return unauthorized();
  await ensureUser(env.DB, user.userId, user.email);
  const rows = await listUserTemplates(env.DB, user.userId);
  const templates = rows.map((r) => ({
    ...parseTemplateData(r.data),
    id: r.id,
    name: r.name,
    createdAt: new Date(r.created_at).getTime(),
  }));
  return json({ templates });
}

async function handleCreateTemplate(request: Request, env: Env): Promise<Response> {
  if (!hasRequiredAuthConfig(env) || !env.DB) return json({ error: 'Not configured.' }, 503);
  const user = await getAuthenticatedRequestUser(request, env);
  if (!user) return unauthorized();

  let payload: { name?: string; [key: string]: unknown };
  try {
    payload = (await request.json()) as { name?: string; [key: string]: unknown };
  } catch {
    return badRequest('Request body must be valid JSON.');
  }

  const name = (payload.name ?? '').toString().trim().slice(0, MAX_TEMPLATE_NAME_LENGTH) || 'Custom Template';
  const { name: _n, ...rest } = payload;
  const dataStr = JSON.stringify(rest);
  const dataBytes = new TextEncoder().encode(dataStr).byteLength;

  if (dataBytes > MAX_TEMPLATE_DATA_BYTES) {
    return badRequest('Template data too large.');
  }

  try {
    await ensureUser(env.DB, user.userId, user.email);
    const row = await createUserTemplate(env.DB, user.userId, name, dataStr);
    return json({ ...rest, id: row.id, name: row.name, createdAt: new Date(row.created_at).getTime() }, 201);
  } catch (err) {
    if (err instanceof Error && err.message === 'Template limit reached.') {
      return badRequest('Template limit reached.', 400);
    }
    return badRequest('Failed to save template.', 502);
  }
}

async function handleDeleteTemplate(templateId: string, request: Request, env: Env): Promise<Response> {
  if (!hasRequiredAuthConfig(env) || !env.DB) return json({ error: 'Not configured.' }, 503);
  const user = await getAuthenticatedRequestUser(request, env);
  if (!user) return unauthorized();
  await ensureUser(env.DB, user.userId, user.email);
  const deleted = await deleteUserTemplate(env.DB, user.userId, templateId);
  if (!deleted) return json({ error: 'Not found.' }, 404);
  return json({ success: true });
}

async function handleRenameTemplate(templateId: string, request: Request, env: Env): Promise<Response> {
  if (!hasRequiredAuthConfig(env) || !env.DB) return json({ error: 'Not configured.' }, 503);
  const user = await getAuthenticatedRequestUser(request, env);
  if (!user) return unauthorized();

  let payload: { name?: string };
  try {
    payload = (await request.json()) as { name?: string };
  } catch {
    return badRequest('Request body must be valid JSON.');
  }

  const name = (payload.name ?? '').toString().trim().slice(0, MAX_TEMPLATE_NAME_LENGTH);
  if (!name) return badRequest('Name is required.');

  await ensureUser(env.DB, user.userId, user.email);
  const updated = await renameUserTemplate(env.DB, user.userId, templateId, name);
  if (!updated) return json({ error: 'Not found.' }, 404);
  return json({ success: true, name });
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  if (!hasRequiredAuthConfig(env) || !env.DB) {
    return json({ error: 'Auth not configured.' }, 503);
  }

  const user = await getAuthenticatedRequestUser(request, env);
  if (!user) return unauthorized();

  await ensureUser(env.DB, user.userId, user.email);
  const balance = await getBalance(env.DB, user.userId);

  return json({ userId: user.userId, email: user.email, balance });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // ── AI generation ──────────────────────────────────────────────────
    if (pathname === '/api/ai-background') {
      if (request.method !== 'POST') return badRequest('Method not allowed.', 405);
      return handleGenerateAiBackground(request, env);
    }

    // ── Custom templates ─────────────────────────────────────────────────
    if (pathname === '/api/templates') {
      if (request.method === 'GET') return handleGetTemplates(request, env);
      if (request.method === 'POST') return handleCreateTemplate(request, env);
      return badRequest('Method not allowed.', 405);
    }

    if (pathname.startsWith('/api/templates/')) {
      const templateId = pathname.slice('/api/templates/'.length);
      if (!templateId) return badRequest('Template ID required.', 400);
      if (request.method === 'DELETE') return handleDeleteTemplate(templateId, request, env);
      if (request.method === 'PATCH') return handleRenameTemplate(templateId, request, env);
      return badRequest('Method not allowed.', 405);
    }

    // ── Auth ────────────────────────────────────────────────────────────
    if (pathname === '/api/me') {
      if (request.method !== 'GET') return badRequest('Method not allowed.', 405);
      return handleMe(request, env);
    }

    // ── Billing ─────────────────────────────────────────────────────────
    if (pathname === '/api/billing/balance') {
      if (request.method !== 'GET') return badRequest('Method not allowed.', 405);
      if (!hasRequiredAuthConfig(env) || !env.DB) return json({ error: 'Billing not configured.' }, 503);
      const user = await getAuthenticatedRequestUser(request, env);
      if (!user) return unauthorized();
      return handleGetBalance(env.DB, user.userId, user.email);
    }

    if (pathname === '/api/billing/packages') {
      if (request.method !== 'GET') return badRequest('Method not allowed.', 405);
      return handleGetPackages();
    }

    if (pathname === '/api/billing/checkout-session') {
      if (request.method !== 'POST') return badRequest('Method not allowed.', 405);
      if (!hasRequiredAuthConfig(env) || !env.DB || !env.STRIPE_SECRET_KEY) {
        return json({ error: 'Billing not configured.' }, 503);
      }
      const user = await getAuthenticatedRequestUser(request, env);
      if (!user) return unauthorized();
      return handleCreateCheckoutSession(
        request,
        env.DB,
        user.userId,
        user.email,
        env.STRIPE_SECRET_KEY,
        getAppOrigin(request),
      );
    }

    if (pathname === '/api/billing/checkout-status') {
      if (request.method !== 'GET') return badRequest('Method not allowed.', 405);
      if (!hasRequiredAuthConfig(env) || !env.DB || !env.STRIPE_SECRET_KEY) {
        return json({ error: 'Billing not configured.' }, 503);
      }
      const user = await getAuthenticatedRequestUser(request, env);
      if (!user) return unauthorized();
      return handleGetCheckoutStatus(request, env.DB, user.userId, user.email, env.STRIPE_SECRET_KEY);
    }

    if (pathname === '/api/billing/webhook/stripe') {
      if (request.method !== 'POST') return badRequest('Method not allowed.', 405);
      if (!env.DB || !env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Webhook not configured.' }, 503);
      return handleStripeWebhook(request, env.DB, env.STRIPE_WEBHOOK_SECRET);
    }

    if (pathname === '/api/billing/history') {
      if (request.method !== 'GET') return badRequest('Method not allowed.', 405);
      if (!hasRequiredAuthConfig(env) || !env.DB) return json({ error: 'Billing not configured.' }, 503);
      const user = await getAuthenticatedRequestUser(request, env);
      if (!user) return unauthorized();
      return handleGetHistory(env.DB, user.userId, user.email);
    }

    // ── Static assets ────────────────────────────────────────────────────
    const assetResponse = await env.ASSETS.fetch(request);
    return applySecurityHeaders(assetResponse);
  },
} satisfies { fetch(request: Request, env: Env): Promise<Response> };
