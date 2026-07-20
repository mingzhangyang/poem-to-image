import {
  createPendingStripeOrder,
  ensureUser,
  fulfillStripeOrder,
  getBalance,
  getStripeOrderBySessionId,
  getTransactionHistory,
  markStripeOrderNeedsReview,
  markStripeOrderPaymentConfirmed,
  recordBillingReview,
  type Order,
  type StripeFulfillmentResult,
} from './db';
import {
  bodyErrorResponse,
  jsonResponse,
  readBoundedText,
  readJsonBody,
  REQUEST_BODY_LIMITS,
} from './http';
import { logError, logInfo } from './observability';

export interface BillingPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
}

export const PACKAGES: readonly BillingPackage[] = [
  { id: 'starter_20', name: 'Starter', credits: 20, priceCents: 199, currency: 'usd' },
  { id: 'pro_54', name: 'Pro', credits: 54, priceCents: 499, currency: 'usd' },
  { id: 'plus_112', name: 'Plus', credits: 112, priceCents: 999, currency: 'usd' },
];

interface StripeCheckoutApiResponse {
  id?: string;
  url?: string;
  error?: { message?: string };
  payment_status?: string;
  status?: string;
  customer_email?: string | null;
  payment_intent?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string>;
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: StripeCheckoutSession };
}

export interface StripeCheckoutSession {
  id: string;
  customer_email?: string | null;
  payment_intent?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string | null;
  metadata?: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringsRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter((entry): entry is [string, string] => (
    typeof entry[1] === 'string'
  ));
  return Object.fromEntries(entries);
}

function checkoutSessionFrom(value: unknown): StripeCheckoutSession | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  return {
    id: value.id,
    customer_email: typeof value.customer_email === 'string' || value.customer_email === null
      ? value.customer_email
      : undefined,
    payment_intent: typeof value.payment_intent === 'string' || value.payment_intent === null
      ? value.payment_intent
      : undefined,
    amount_total: typeof value.amount_total === 'number' || value.amount_total === null
      ? value.amount_total
      : undefined,
    currency: typeof value.currency === 'string' || value.currency === null
      ? value.currency
      : undefined,
    payment_status: typeof value.payment_status === 'string' || value.payment_status === null
      ? value.payment_status
      : undefined,
    metadata: stringsRecord(value.metadata),
  };
}

function stripeEventFrom(value: unknown): StripeEvent | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') return null;
  if (!isRecord(value.data)) return null;
  const session = checkoutSessionFrom(value.data.object);
  if (!session) return null;
  return { id: value.id, type: value.type, data: { object: session } };
}

function packageById(packageId: string): BillingPackage | undefined {
  return PACKAGES.find((pkg) => pkg.id === packageId);
}

function normalizeReturnPath(returnPath?: string): string {
  if (!returnPath || !returnPath.startsWith('/') || returnPath.startsWith('//')) return '/';
  try {
    const url = new URL(returnPath, 'https://app.local');
    if (url.origin !== 'https://app.local') return '/';
    return `${url.pathname}${url.search}`;
  } catch {
    return '/';
  }
}

function checkoutBodyFrom(value: unknown): { packageId: string; returnPath?: string } | null {
  if (!isRecord(value) || typeof value.packageId !== 'string') return null;
  if (value.returnPath !== undefined && typeof value.returnPath !== 'string') return null;
  return { packageId: value.packageId, returnPath: value.returnPath };
}

export async function handleGetBalance(
  db: D1Database,
  userId: string,
  email: string,
): Promise<Response> {
  await ensureUser(db, userId, email);
  return jsonResponse({ userId, balance: await getBalance(db, userId) });
}

export async function handleGetPackages(): Promise<Response> {
  return jsonResponse({ packages: PACKAGES });
}

export async function handleCreateCheckoutSession(
  request: Request,
  db: D1Database,
  userId: string,
  email: string,
  stripeSecretKey: string,
  appOrigin: string,
): Promise<Response> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(request, REQUEST_BODY_LIMITS.checkout);
  } catch (error) {
    return bodyErrorResponse(error) ?? jsonResponse({ error: 'Invalid checkout request.' }, 400);
  }

  const body = checkoutBodyFrom(parsed);
  if (!body) return jsonResponse({ error: 'Invalid checkout request.' }, 400);
  const pkg = packageById(body.packageId);
  if (!pkg) return jsonResponse({ error: 'Invalid package ID.' }, 400);

  const returnPath = normalizeReturnPath(body.returnPath);
  const successUrl = new URL(returnPath, appOrigin);
  successUrl.searchParams.set('billing', 'success');
  successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  const cancelUrl = new URL(returnPath, appOrigin);
  cancelUrl.searchParams.set('billing', 'cancel');

  await ensureUser(db, userId, email);
  const stripeBody = new URLSearchParams({
    'payment_method_types[]': 'card',
    'line_items[0][price_data][currency]': pkg.currency,
    'line_items[0][price_data][product_data][name]': `${pkg.name} — ${pkg.credits} Credits`,
    'line_items[0][price_data][unit_amount]': String(pkg.priceCents),
    'line_items[0][quantity]': '1',
    mode: 'payment',
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
    'metadata[userId]': userId,
    'metadata[packageId]': pkg.id,
  });
  if (email) stripeBody.set('customer_email', email);

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: stripeBody.toString(),
  });

  let session: StripeCheckoutApiResponse;
  try {
    session = (await stripeResponse.json()) as StripeCheckoutApiResponse;
  } catch {
    return jsonResponse({ error: 'Stripe returned an invalid response.' }, 502);
  }

  if (!stripeResponse.ok || !session.id || !session.url) {
    return jsonResponse({ error: session.error?.message || 'Failed to create checkout session.' }, 502);
  }

  try {
    await createPendingStripeOrder(db, {
      userId,
      stripeSessionId: session.id,
      packageId: pkg.id,
      amountPaidCents: pkg.priceCents,
      currency: pkg.currency,
      creditsGranted: pkg.credits,
    });
  } catch (error) {
    logError('billing.checkout_order_persist_failed', error, { stripeSessionId: session.id });
    return jsonResponse(
      { error: 'Checkout could not be recorded. No checkout link was issued.', code: 'ORDER_PERSIST_FAILED' },
      503,
    );
  }

  return jsonResponse({ checkoutUrl: session.url });
}

function validationFailure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export function validateFulfillmentSession(
  order: Order,
  session: StripeCheckoutSession,
): { ok: true } | { ok: false; error: string } {
  if (session.id !== order.stripe_session_id) return validationFailure('Stripe session ID mismatch.');
  if (session.metadata?.userId !== order.user_id) return validationFailure('Stripe session user mismatch.');
  if (session.metadata?.packageId !== order.package_id) return validationFailure('Stripe package snapshot mismatch.');
  if (session.amount_total !== order.amount_paid_cents) return validationFailure('Stripe amount snapshot mismatch.');
  if ((session.currency ?? '').toLowerCase() !== order.currency.toLowerCase()) {
    return validationFailure('Stripe currency snapshot mismatch.');
  }
  return { ok: true };
}

async function persistReview(
  db: D1Database,
  eventId: string,
  eventType: string,
  sessionId: string | null,
  order: Order | null,
  reason: string,
): Promise<void> {
  if (order) await markStripeOrderNeedsReview(db, order.id, reason);
  await recordBillingReview(db, eventId, sessionId, eventType, reason);
  logError('billing.fulfillment_needs_review', new Error(reason), {
    stripeEventId: eventId,
    stripeSessionId: sessionId,
    orderStatus: order?.status,
    reason,
  });
}

type ReviewFulfillmentResult = Extract<
  StripeFulfillmentResult,
  { status: 'needs_review' | 'missing_order' }
>;

function reviewResponse(result: ReviewFulfillmentResult): Response {
  return jsonResponse({
    received: true,
    fulfilled: false,
    status: 'needs_review',
    reason: result.reason,
  }, 202);
}

export async function handleStripeWebhook(
  request: Request,
  db: D1Database,
  stripeWebhookSecret: string,
): Promise<Response> {
  let rawBody: string;
  try {
    rawBody = await readBoundedText(request, REQUEST_BODY_LIMITS.stripeWebhook);
  } catch (error) {
    return bodyErrorResponse(error) ?? jsonResponse({ error: 'Invalid webhook body.' }, 400);
  }

  const signature = request.headers.get('stripe-signature') ?? '';
  if (!await verifyStripeWebhookSignature(rawBody, signature, stripeWebhookSecret)) {
    return jsonResponse({ error: 'Invalid webhook signature.' }, 400);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonResponse({ error: 'Invalid JSON.' }, 400);
  }

  const event = stripeEventFrom(parsed);
  if (!event) return jsonResponse({ error: 'Invalid Stripe event.' }, 400);
  if (event.type !== 'checkout.session.completed') {
    return jsonResponse({ received: true, status: 'ignored' });
  }

  const session = event.data.object;
  if (session.payment_status !== 'paid') {
    return jsonResponse({ received: true, status: 'pending_payment' });
  }

  try {
    const order = await getStripeOrderBySessionId(db, session.id);
    if (!order) {
      const reason = 'Paid Stripe session has no persisted pending order.';
      await persistReview(db, event.id, event.type, session.id, null, reason);
      return reviewResponse({ status: 'missing_order', order: null, reason });
    }

    const validation = validateFulfillmentSession(order, session);
    if (!validation.ok) {
      await persistReview(db, event.id, event.type, session.id, order, validation.error);
      return reviewResponse({ status: 'needs_review', order, reason: validation.error });
    }

    await markStripeOrderPaymentConfirmed(db, order.id, session.payment_intent ?? null);
    const result = await fulfillStripeOrder(db, session.id, session.payment_intent ?? null);
    if (result.status === 'needs_review' || result.status === 'missing_order') {
      await persistReview(db, event.id, event.type, session.id, result.order, result.reason);
      return reviewResponse(result);
    }

    logInfo('billing.fulfillment_succeeded', {
      stripeEventId: event.id,
      stripeSessionId: session.id,
      result: result.status,
      creditsGranted: result.order.credits_granted,
    });
    return jsonResponse({ received: true, fulfilled: true, status: result.status });
  } catch (error) {
    logError('billing.webhook_processing_failed', error, {
      stripeEventId: event.id,
      stripeSessionId: session.id,
    });
    return jsonResponse({ error: 'Webhook processing failed. Stripe should retry.' }, 503);
  }
}

export async function handleGetCheckoutStatus(
  request: Request,
  db: D1Database,
  userId: string,
  email: string,
  stripeSecretKey: string,
): Promise<Response> {
  const sessionId = new URL(request.url).searchParams.get('session_id') ?? '';
  if (!sessionId) return jsonResponse({ error: 'Missing session_id.' }, 400);

  await ensureUser(db, userId, email);
  const stripeResponse = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
  );

  let payload: unknown;
  try {
    payload = await stripeResponse.json();
  } catch {
    return jsonResponse({ error: 'Stripe returned an invalid response.' }, 502);
  }

  if (!stripeResponse.ok) {
    const errorMessage = isRecord(payload) && isRecord(payload.error)
      && typeof payload.error.message === 'string'
      ? payload.error.message
      : 'Failed to fetch checkout session.';
    return jsonResponse({ error: errorMessage }, 502);
  }

  const session = checkoutSessionFrom(payload);
  if (!session) return jsonResponse({ error: 'Stripe returned an invalid checkout session.' }, 502);
  if (session.metadata?.userId !== userId) {
    return jsonResponse({ error: 'Checkout session does not belong to the current user.' }, 403);
  }

  const order = await getStripeOrderBySessionId(db, session.id);
  if (!order) {
    const reason = 'Checkout session is not linked to a persisted order.';
    await recordBillingReview(db, `status:${session.id}`, session.id, 'checkout.status', reason);
    return jsonResponse({ fulfilled: false, status: 'needs_review', reason, balance: await getBalance(db, userId) });
  }

  if (session.payment_status !== 'paid') {
    return jsonResponse({
      fulfilled: false,
      status: order.status,
      paymentStatus: session.payment_status ?? 'unknown',
      balance: await getBalance(db, userId),
    });
  }

  const validation = validateFulfillmentSession(order, session);
  if (!validation.ok) {
    await persistReview(db, `status:${session.id}`, 'checkout.status', session.id, order, validation.error);
    return jsonResponse({
      fulfilled: false,
      status: 'needs_review',
      reason: validation.error,
      balance: await getBalance(db, userId),
    });
  }

  try {
    await markStripeOrderPaymentConfirmed(db, order.id, session.payment_intent ?? null);
    const result = await fulfillStripeOrder(db, session.id, session.payment_intent ?? null);
    if (result.status === 'needs_review' || result.status === 'missing_order') {
      await persistReview(db, `status:${session.id}`, 'checkout.status', session.id, result.order, result.reason);
      return jsonResponse({
        fulfilled: false,
        status: 'needs_review',
        reason: result.reason,
        balance: await getBalance(db, userId),
      });
    }
    return jsonResponse({
      fulfilled: true,
      status: 'completed',
      paymentStatus: session.payment_status,
      balance: result.balance,
    });
  } catch (error) {
    logError('billing.checkout_status_fulfillment_failed', error, { stripeSessionId: session.id });
    return jsonResponse({ error: 'Fulfillment is pending retry.', status: 'pending' }, 503);
  }
}

export async function handleGetHistory(
  db: D1Database,
  userId: string,
  email: string,
): Promise<Response> {
  await ensureUser(db, userId, email);
  return jsonResponse({ items: await getTransactionHistory(db, userId, 30) });
}

async function verifyStripeWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    let timestamp = '';
    const expectedSignatures: string[] = [];
    for (const part of signature.split(',')) {
      const separator = part.indexOf('=');
      if (separator < 1) continue;
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (key === 't') timestamp = value;
      if (key === 'v1' && value) expectedSignatures.push(value);
    }

    const timestampNumber = Number(timestamp);
    if (!Number.isFinite(timestampNumber) || expectedSignatures.length === 0) return false;
    if (Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signedPayload = new TextEncoder().encode(`${timestamp}.${payload}`);
    for (const candidate of expectedSignatures) {
      if (!/^[a-fA-F0-9]{64}$/.test(candidate)) continue;
      const candidateBytes = new Uint8Array(32);
      for (let index = 0; index < candidateBytes.length; index += 1) {
        candidateBytes[index] = Number.parseInt(candidate.slice(index * 2, index * 2 + 2), 16);
      }
      if (await crypto.subtle.verify('HMAC', key, candidateBytes, signedPayload)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
