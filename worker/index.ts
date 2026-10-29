import { getAuthenticatedUser, type AuthUser, type AuthValidationOptions } from './auth';
import { DuplicateGenerationRequestError, InsufficientCreditsError, consumeRateLimit, ensureUser, getBalance, reserveGeneration, finalizeGenerationSuccess, finalizeGenerationFailure, listUserTemplates, createUserTemplate, deleteUserTemplate, renameUserTemplate } from './db';
import {
  handleGetBalance,
  handleGetPackages,
  handleCreateCheckoutSession,
  handleGetCheckoutStatus,
  handleStripeWebhook,
  handleGetHistory,
} from './billing';
import { generateWithGemini, generateWithOpenAi, normalizeProvider, CREDIT_COST } from './ai';
import { applySecurityHeaders, bodyErrorResponse, jsonResponse, methodNotAllowed, readJsonBody, REQUEST_BODY_LIMITS } from './http';
import { logError, logInfo, requestIdFor, withRequestId } from './observability';
import type { WorkerEnv } from './env';
import { runOperationalChecks } from './maintenance';
import { publishShare, getShareApi, deleteShare, getShareImage, getShareHtml, getShareReadiness, verifyShareForRecovery } from './shares';

const MAX_AI_PROMPT_LENGTH = 500;
const MAX_REQUEST_ID_LENGTH = 80;

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try { return await fn(); } catch (err) { lastError = err; }
  }
  throw lastError;
}

function json(data: unknown, status = 200): Response {
  return jsonResponse(data, status);
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

function hasRequiredAuthConfig(env: WorkerEnv): boolean {
  const allowedAuthorizedParties = parseCsvEnv(env.CLERK_ALLOWED_AUTHORIZED_PARTIES);
  return !!(env.CLERK_SECRET_KEY && env.CLERK_JWT_ISSUER && allowedAuthorizedParties?.length);
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

function normalizeRequestId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_REQUEST_ID_LENGTH) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

function getAuthValidationOptions(env: WorkerEnv): AuthValidationOptions {
  return {
    expectedIssuer: env.CLERK_JWT_ISSUER,
    expectedAudience: env.CLERK_JWT_AUDIENCE,
    allowedAuthorizedParties: parseCsvEnv(env.CLERK_ALLOWED_AUTHORIZED_PARTIES),
  };
}

async function getAuthenticatedRequestUser(request: Request, env: WorkerEnv): Promise<AuthUser | null> {
  const secretKey = env.CLERK_SECRET_KEY;
  if (!secretKey || !hasRequiredAuthConfig(env)) return null;
  return getAuthenticatedUser(request, secretKey, getAuthValidationOptions(env));
}

async function enforceRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<Response | null> {
  const result = await consumeRateLimit(db, key, limit, windowSeconds);
  if (result.allowed) return null;
  const response = json({ error: 'Too many requests.', code: 'RATE_LIMITED' }, 429);
  response.headers.set('Retry-After', String(result.retryAfterSeconds));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  return response;
}

interface GenerateImageRequest {
  prompt?: string;
  aspectRatio?: string;
  provider?: string;
  requestId?: string;
}

async function handleGenerateAiBackground(request: Request, env: WorkerEnv): Promise<Response> {
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
  const rateLimitResponse = await enforceRateLimit(db, `ai:${userId}`, 10, 60);
  if (rateLimitResponse) return rateLimitResponse;

  let parsed: unknown;
  try {
    parsed = await readJsonBody(request, REQUEST_BODY_LIMITS.aiGeneration);
  } catch (error) {
    return bodyErrorResponse(error) ?? badRequest('Request body must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return badRequest('Invalid request body.');
  const payload = parsed as GenerateImageRequest;

  if (!payload.prompt?.trim()) return badRequest('Prompt is required.');
  if (payload.prompt.trim().length > MAX_AI_PROMPT_LENGTH) {
    return badRequest(`Prompt must be ${MAX_AI_PROMPT_LENGTH} characters or fewer.`);
  }

  const prompt = payload.prompt.trim();
  const clientRequestId = normalizeRequestId(payload.requestId);
  if (!clientRequestId) return badRequest('Valid requestId is required.');

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
    const reserved = await reserveGeneration(db, userId, clientRequestId, provider, prompt.length, costCredits);
    requestId = reserved.requestId;
    transactionId = reserved.transactionId;
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
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

    if (error instanceof DuplicateGenerationRequestError) {
      const latestBalance = await getBalance(db, userId);
      return json(
        {
          error: 'Generation request has already been submitted.',
          code: 'DUPLICATE_REQUEST',
          status: error.requestStatus,
          balance: latestBalance,
        },
        409,
      );
    }

    return badRequest('Failed to reserve credits.', 502);
  }

  // Call the AI provider
  try {
    let result: { imageDataUrl: string };

    const startedAt = Date.now();
    if (provider === 'openai') {
      result = await generateWithOpenAi(prompt, aspectRatio, env.OPENAI_API_KEY!);
    } else {
      result = await generateWithGemini(prompt, aspectRatio, env.GEMINI_API_KEY!);
    }

    // Finalize the ledger records; credits were deducted by the reservation.
    const newBalance = await finalizeGenerationSuccess(db, userId, requestId, transactionId);

    logInfo('ai.generation_succeeded', {
      requestId,
      provider,
      latencyMs: Date.now() - startedAt,
      creditsCharged: costCredits,
    });

    return json({
      imageDataUrl: result.imageDataUrl,
      requestId,
      creditsCharged: costCredits,
      balance: newBalance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate AI background.';

    logError('ai.generation_failed', error, { requestId, provider });

    // Mark as failed (no credit deduction). Retry once on transient DB failure.
    try {
      await withRetry(() => finalizeGenerationFailure(db, userId, requestId, transactionId, message));
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

async function handleGetTemplates(request: Request, env: WorkerEnv): Promise<Response> {
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

async function handleCreateTemplate(request: Request, env: WorkerEnv): Promise<Response> {
  if (!hasRequiredAuthConfig(env) || !env.DB) return json({ error: 'Not configured.' }, 503);
  const user = await getAuthenticatedRequestUser(request, env);
  if (!user) return unauthorized();

  const rateLimitResponse = await enforceRateLimit(env.DB, `template:${user.userId}`, 30, 60);
  if (rateLimitResponse) return rateLimitResponse;

  let parsed: unknown;
  try {
    parsed = await readJsonBody(request, REQUEST_BODY_LIMITS.template);
  } catch (error) {
    return bodyErrorResponse(error) ?? badRequest('Request body must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return badRequest('Invalid template body.');
  const payload = parsed as { name?: unknown; [key: string]: unknown };

  const name = (typeof payload.name === 'string' ? payload.name : '')
    .trim()
    .slice(0, MAX_TEMPLATE_NAME_LENGTH) || 'Custom Template';
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

async function handleDeleteTemplate(templateId: string, request: Request, env: WorkerEnv): Promise<Response> {
  if (!hasRequiredAuthConfig(env) || !env.DB) return json({ error: 'Not configured.' }, 503);
  const user = await getAuthenticatedRequestUser(request, env);
  if (!user) return unauthorized();
  const rateLimitResponse = await enforceRateLimit(env.DB, `template:${user.userId}`, 30, 60);
  if (rateLimitResponse) return rateLimitResponse;
  await ensureUser(env.DB, user.userId, user.email);
  const deleted = await deleteUserTemplate(env.DB, user.userId, templateId);
  if (!deleted) return json({ error: 'Not found.' }, 404);
  return json({ success: true });
}

async function handleRenameTemplate(templateId: string, request: Request, env: WorkerEnv): Promise<Response> {
  if (!hasRequiredAuthConfig(env) || !env.DB) return json({ error: 'Not configured.' }, 503);
  const user = await getAuthenticatedRequestUser(request, env);
  if (!user) return unauthorized();

  const rateLimitResponse = await enforceRateLimit(env.DB, `template:${user.userId}`, 30, 60);
  if (rateLimitResponse) return rateLimitResponse;

  let parsed: unknown;
  try {
    parsed = await readJsonBody(request, REQUEST_BODY_LIMITS.checkout);
  } catch (error) {
    return bodyErrorResponse(error) ?? badRequest('Request body must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return badRequest('Invalid rename body.');
  const payload = parsed as { name?: unknown };

  const name = typeof payload.name === 'string'
    ? payload.name.trim().slice(0, MAX_TEMPLATE_NAME_LENGTH)
    : '';
  if (!name) return badRequest('Name is required.');

  await ensureUser(env.DB, user.userId, user.email);
  const updated = await renameUserTemplate(env.DB, user.userId, templateId, name);
  if (!updated) return json({ error: 'Not found.' }, 404);
  return json({ success: true, name });
}

async function handleMe(request: Request, env: WorkerEnv): Promise<Response> {
  if (!hasRequiredAuthConfig(env) || !env.DB) {
    return json({ error: 'Auth not configured.' }, 503);
  }

  const user = await getAuthenticatedRequestUser(request, env);
  if (!user) return unauthorized();

  await ensureUser(env.DB, user.userId, user.email);
  const balance = await getBalance(env.DB, user.userId);

  return json({ userId: user.userId, email: user.email, balance });
}

async function routeRequest(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // ── Public, immutable artwork shares ─────────────────────────────────
    if (pathname === '/api/health/sharing') return getShareReadiness(request, env);
    if (pathname === '/api/shares') return publishShare(request, env);
    const shareRecovery = /^\/api\/shares\/([A-Za-z0-9_-]+)\/verify$/.exec(pathname);
    if (shareRecovery) return verifyShareForRecovery(request, env, shareRecovery[1]);
    const shareApi = /^\/api\/shares\/([A-Za-z0-9_-]+)$/.exec(pathname);
    if (shareApi) {
      if (request.method === 'GET') return getShareApi(request, env, shareApi[1]);
      if (request.method === 'DELETE') return deleteShare(request, env, shareApi[1]);
      return methodNotAllowed(['GET', 'DELETE']);
    }
    const shareImage = /^\/s\/([A-Za-z0-9_-]+)\/(image\.(?:png|jpg)|card\.jpg)$/.exec(pathname);
    if (shareImage) return getShareImage(request, env, shareImage[1], shareImage[2] === 'card.jpg' ? 'card' : 'image');
    const sharePage = /^\/s\/([A-Za-z0-9_-]+)$/.exec(pathname);
    if (sharePage) return getShareHtml(request, env, sharePage[1]);
    if (pathname.startsWith('/s/')) return getShareHtml(request, env, '');

    // ── AI generation ──────────────────────────────────────────────────
    if (pathname === '/api/ai-background') {
      if (request.method !== 'POST') return methodNotAllowed(['POST']);
      return handleGenerateAiBackground(request, env);
    }

    // ── Custom templates ─────────────────────────────────────────────────
    if (pathname === '/api/templates') {
      if (request.method === 'GET') return handleGetTemplates(request, env);
      if (request.method === 'POST') return handleCreateTemplate(request, env);
      return methodNotAllowed(['GET', 'POST']);
    }

    if (pathname.startsWith('/api/templates/')) {
      const templateId = pathname.slice('/api/templates/'.length);
      if (!templateId) return badRequest('Template ID required.', 400);
      if (request.method === 'DELETE') return handleDeleteTemplate(templateId, request, env);
      if (request.method === 'PATCH') return handleRenameTemplate(templateId, request, env);
      return methodNotAllowed(['DELETE', 'PATCH']);
    }

    // ── Auth ────────────────────────────────────────────────────────────
    if (pathname === '/api/me') {
      if (request.method !== 'GET') return methodNotAllowed(['GET']);
      return handleMe(request, env);
    }

    // ── Billing ─────────────────────────────────────────────────────────
    if (pathname === '/api/billing/balance') {
      if (request.method !== 'GET') return methodNotAllowed(['GET']);
      if (!hasRequiredAuthConfig(env) || !env.DB) return json({ error: 'Billing not configured.' }, 503);
      const user = await getAuthenticatedRequestUser(request, env);
      if (!user) return unauthorized();
      return handleGetBalance(env.DB, user.userId, user.email);
    }

    if (pathname === '/api/billing/packages') {
      if (request.method !== 'GET') return methodNotAllowed(['GET']);
      return handleGetPackages();
    }

    if (pathname === '/api/billing/checkout-session') {
      if (request.method !== 'POST') return methodNotAllowed(['POST']);
      if (!hasRequiredAuthConfig(env) || !env.DB || !env.STRIPE_SECRET_KEY) {
        return json({ error: 'Billing not configured.' }, 503);
      }
      const user = await getAuthenticatedRequestUser(request, env);
      if (!user) return unauthorized();
      const rateLimitResponse = await enforceRateLimit(env.DB, `checkout:${user.userId}`, 5, 300);
      if (rateLimitResponse) return rateLimitResponse;
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
      if (request.method !== 'GET') return methodNotAllowed(['GET']);
      if (!hasRequiredAuthConfig(env) || !env.DB || !env.STRIPE_SECRET_KEY) {
        return json({ error: 'Billing not configured.' }, 503);
      }
      const user = await getAuthenticatedRequestUser(request, env);
      if (!user) return unauthorized();
      return handleGetCheckoutStatus(request, env.DB, user.userId, user.email, env.STRIPE_SECRET_KEY);
    }

    if (pathname === '/api/billing/webhook/stripe') {
      if (request.method !== 'POST') return methodNotAllowed(['POST']);
      if (!env.DB || !env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Webhook not configured.' }, 503);
      return handleStripeWebhook(request, env.DB, env.STRIPE_WEBHOOK_SECRET);
    }

    if (pathname === '/api/billing/history') {
      if (request.method !== 'GET') return methodNotAllowed(['GET']);
      if (!hasRequiredAuthConfig(env) || !env.DB) return json({ error: 'Billing not configured.' }, 503);
      const user = await getAuthenticatedRequestUser(request, env);
      if (!user) return unauthorized();
      return handleGetHistory(env.DB, user.userId, user.email);
    }

    if (pathname.startsWith('/api/')) {
      return json({ error: 'API route not found.', code: 'NOT_FOUND' }, 404);
    }

    // ── Static assets ────────────────────────────────────────────────────
    const assetResponse = await env.ASSETS.fetch(request);
    return applySecurityHeaders(assetResponse);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const requestId = requestIdFor(request);
    const startedAt = Date.now();
    const pathname = new URL(request.url).pathname;

    try {
      const response = await routeRequest(request, env);
      if (pathname.startsWith('/api/')) {
        logInfo('api.request_completed', {
          requestId,
          method: request.method,
          path: pathname,
          status: response.status,
          latencyMs: Date.now() - startedAt,
        });
      }
      return withRequestId(response, requestId);
    } catch (error) {
      logError('api.request_failed', error, {
        requestId,
        method: request.method,
        path: pathname,
        latencyMs: Date.now() - startedAt,
      });
      return withRequestId(json({ error: 'Internal server error.' }, 500), requestId);
    }
  },
  scheduled(_controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): void {
    ctx.waitUntil(runOperationalChecks(env));
  },
} satisfies ExportedHandler<WorkerEnv>;
