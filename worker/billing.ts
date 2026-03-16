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
  { id: 'starter_24', name: 'Starter', credits: 24, priceCents: 199, currency: 'usd' },
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
  let body: { packageId?: string };
  try {
    body = (await request.json()) as { packageId?: string };
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }

  const pkg = packageById(body.packageId ?? '');
  if (!pkg) return json({ error: 'Invalid package ID.' }, 400);

  await ensureUser(db, userId, email);

  const stripeBody = new URLSearchParams({
    'payment_method_types[]': 'card',
    'line_items[0][price_data][currency]': pkg.currency,
    'line_items[0][price_data][product_data][name]': `${pkg.name} — ${pkg.credits} Credits`,
    'line_items[0][price_data][unit_amount]': String(pkg.priceCents),
    'line_items[0][quantity]': '1',
    mode: 'payment',
    success_url: `${appOrigin}/?billing=success`,
    cancel_url: `${appOrigin}/?billing=cancel`,
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

async function verifyStripeWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    // Parse t= and v1= from Stripe-Signature header
    const parts: Record<string, string> = {};
    for (const part of signature.split(',')) {
      const [k, v] = part.split('=');
      if (k && v) parts[k] = v;
    }

    const timestamp = parts['t'];
    const expectedSig = parts['v1'];
    if (!timestamp || !expectedSig) return false;

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

    return computedHex === expectedSig;
  } catch {
    return false;
  }
}
