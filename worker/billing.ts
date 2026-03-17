import type { D1Database } from './db';
import {
  ensureUser,
  getBalance,
  fulfillStripeOrder,
  getTransactionHistory,
} from './db';

export interface BillingPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
}

export const PACKAGES: BillingPackage[] = [
  { id: 'starter_20', name: 'Starter', credits: 20, priceCents: 199, currency: 'usd' },
  { id: 'pro_54', name: 'Pro', credits: 54, priceCents: 499, currency: 'usd' },
  { id: 'plus_112', name: 'Plus', credits: 112, priceCents: 999, currency: 'usd' },
];

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function packageById(packageId: string): BillingPackage | undefined {
  return PACKAGES.find((p) => p.id === packageId);
}

interface StripeCheckoutResponse {
  id: string;
  url: string;
  error?: { message?: string };
}

export async function handleGetBalance(
  db: D1Database,
  userId: string,
  email: string,
): Promise<Response> {
  await ensureUser(db, userId, email);
  const balance = await getBalance(db, userId);
  return json({ userId, balance });
}

export async function handleGetPackages(): Promise<Response> {
  return json({ packages: PACKAGES });
}

export async function handleCreateCheckoutSession(
  request: Request,
  db: D1Database,
  userId: string,
  email: string,
  stripeSecretKey: string,
  appOrigin: string,
): Promise<Response> {
  let body: { packageId?: string; returnPath?: string };
  try {
    body = (await request.json()) as { packageId?: string; returnPath?: string };
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }

  const pkg = packageById(body.packageId ?? '');
  if (!pkg) return json({ error: 'Invalid package ID.' }, 400);

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
    customer_email: email,
    'metadata[userId]': userId,
    'metadata[packageId]': pkg.id,
    'metadata[creditsGranted]': String(pkg.credits),
  });

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: stripeBody.toString(),
  });

  const session = (await stripeResponse.json()) as StripeCheckoutResponse;

  if (!stripeResponse.ok) {
    return json({ error: session.error?.message || 'Failed to create checkout session.' }, 502);
  }

  return json({ checkoutUrl: session.url });
}

export async function handleStripeWebhook(
  request: Request,
  db: D1Database,
  stripeWebhookSecret: string,
): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';

  const isValid = await verifyStripeWebhookSignature(rawBody, signature, stripeWebhookSecret);
  if (!isValid) {
    return json({ error: 'Invalid webhook signature.' }, 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as StripeCheckoutSession;
    const userId = session.metadata?.userId;
    const packageId = session.metadata?.packageId;
    const creditsGranted = parseInt(session.metadata?.creditsGranted ?? '0', 10);
    const email = session.customer_email ?? '';

    if (userId && packageId && creditsGranted > 0) {
      await ensureUser(db, userId, email);
      await fulfillStripeOrder(
        db,
        userId,
        session.id,
        session.payment_intent ?? null,
        packageId,
        session.amount_total ?? 0,
        creditsGranted,
      );
    }
  }

  return json({ received: true });
}

export async function handleGetCheckoutStatus(
  request: Request,
  db: D1Database,
  userId: string,
  email: string,
  stripeSecretKey: string,
): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id') ?? '';

  if (!sessionId) {
    return json({ error: 'Missing session_id.' }, 400);
  }

  await ensureUser(db, userId, email);

  const stripeResponse = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    },
  );

  const session = (await stripeResponse.json()) as StripeCheckoutResponse & StripeCheckoutSession & {
    payment_status?: string;
    status?: string;
  };

  if (!stripeResponse.ok) {
    return json({ error: session.error?.message || 'Failed to fetch checkout session.' }, 502);
  }

  if (session.metadata?.userId !== userId) {
    return json({ error: 'Checkout session does not belong to the current user.' }, 403);
  }

  const isPaid = session.payment_status === 'paid';
  if (isPaid) {
    const creditsGranted = parseInt(session.metadata?.creditsGranted ?? '0', 10);
    const packageId = session.metadata?.packageId ?? '';

    if (packageId && creditsGranted > 0) {
      await fulfillStripeOrder(
        db,
        userId,
        session.id,
        session.payment_intent ?? null,
        packageId,
        session.amount_total ?? 0,
        creditsGranted,
      );
    }
  }

  const balance = await getBalance(db, userId);
  return json({ fulfilled: isPaid, paymentStatus: session.payment_status ?? 'unknown', balance });
}

export async function handleGetHistory(
  db: D1Database,
  userId: string,
  email: string,
): Promise<Response> {
  await ensureUser(db, userId, email);
  const items = await getTransactionHistory(db, userId, 30);
  return json({ items });
}

// --- Stripe webhook signature verification via Web Crypto (HMAC-SHA256) ---

interface StripeEvent {
  type: string;
  data: { object: unknown };
}

interface StripeCheckoutSession {
  id: string;
  customer_email?: string | null;
  payment_intent?: string | null;
  amount_total?: number | null;
  metadata?: Record<string, string>;
}

function normalizeReturnPath(returnPath?: string): string {
  if (!returnPath || !returnPath.startsWith('/') || returnPath.startsWith('//')) {
    return '/';
  }

  try {
    const url = new URL(returnPath, 'https://app.local');
    if (url.origin !== 'https://app.local') {
      return '/';
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return '/';
  }
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
      const [rawKey, rawValue] = part.split('=');
      const key = rawKey?.trim();
      const value = rawValue?.trim();

      if (!key || !value) {
        continue;
      }

      if (key === 't') {
        timestamp = value;
      }

      if (key === 'v1') {
        expectedSignatures.push(value);
      }
    }

    if (!timestamp || expectedSignatures.length === 0) return false;

    // Reject if timestamp is > 5 minutes old
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const keyData = new TextEncoder().encode(secret);
    const messageData = new TextEncoder().encode(signedPayload);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const computed = await crypto.subtle.sign('HMAC', key, messageData);
    const computedHex = Array.from(new Uint8Array(computed))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return expectedSignatures.some((expectedSignature) => expectedSignature === computedHex);
  } catch {
    return false;
  }
}
