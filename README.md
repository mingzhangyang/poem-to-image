# InkPoem

**解决AI生成图片的文字难题：精美图像，精准文字控制**

AI生成的图片虽然精美，但文字经常出错？InkPoem让您从诗歌创建美丽图像，同时提供完全可定制的背景、排版和AI艺术，确保文字完美无误。

Turn poems into AI-generated images with precise text control. Built with React + Vite, deployed on Cloudflare Workers with a D1-backed credit billing system.

## Features

- **Public read-only artwork links**: publish immutable snapshot URLs such as `inkpoem.com/s/<id>`, with social preview, viewer download and a browser-local **My Shares** history backed by IndexedDB for link retrieval, removal-key backup, status checks and revocation. Uses D1 + a private R2 bucket; see [share setup & rollout instructions](docs/shareable-artwork-links.md).
- AI image generation via Gemini and OpenAI
- Clerk authentication
- Stripe credit purchases
- Cloudflare D1 database for user credits and transaction history

## Credit Costs

| Model | Credits | Approx. API Cost |
|---|---|---|
| Gemini (NanoBanana 2) | 2 credits | ~$0.067 |
| OpenAI (gpt-image-2 medium) | 1 credit | Token-based: image output $30/1M tokens + text input $5/1M tokens |

## Credit Packages

| Package | Credits | Price |
|---|---|---|
| Starter | 20 | $1.99 |
| Pro | 54 | $4.99 |
| Plus | 112 | $9.99 |

## Run Locally

**Prerequisites:** Node.js 24 and a Cloudflare account with Wrangler access.

1. Install dependencies:
   ```
   npm install
   ```
2. Authenticate Wrangler:
   ```
   npx wrangler login
   ```
3. Create a local Worker env file:
   ```
   cp .dev.vars.example .dev.vars
   ```
4. Fill in `.dev.vars`:
   ```
   GEMINI_API_KEY=your_key_here
   OPENAI_API_KEY=your_key_here
   CLERK_SECRET_KEY=your_key_here
   CLERK_JWT_ISSUER=https://your-clerk-issuer
   CLERK_ALLOWED_AUTHORIZED_PARTIES=https://your-app-origin
   # Optional, only for a custom aud claim:
   CLERK_JWT_AUDIENCE=your-clerk-audience
   STRIPE_SECRET_KEY=your_key_here
   STRIPE_WEBHOOK_SECRET=your_key_here
   ```
5. Copy `.env.example` to `.env` for the frontend and set the public Clerk key:
   ```
   VITE_CLERK_PUBLISHABLE_KEY=your_publishable_key_here
   ```
6. Run the Worker API in one terminal:
   ```
   npm run dev:worker
   ```
7. Run the Vite frontend in another terminal:
   ```
   npm run dev
   ```

The Vite dev server proxies `/api/*` requests to the local Worker on port `8787`.

## Deploy

### First-time setup

1. Create a Clerk application and get your publishable key and secret key.
2. Create a Stripe account, get your secret key, and create products matching the package IDs in `worker/billing.ts`.
3. Create the D1 database:
   ```
   wrangler d1 create poem-to-image
   ```
4. Copy the `database_id` into `wrangler.jsonc`.
5. Apply the numbered database migrations:
   ```
   wrangler d1 migrations apply DB --remote --config wrangler.jsonc
   ```
6. Set Worker secrets:
   ```
   npx wrangler secret put CLERK_SECRET_KEY
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put OPENAI_API_KEY
   ```
7. Set Worker auth validation variables (must match your Clerk instance and frontend origins):
   ```
   # Wrangler vars or equivalent dashboard environment variables
   CLERK_JWT_ISSUER=https://your-clerk-issuer
   CLERK_ALLOWED_AUTHORIZED_PARTIES=https://your-app-origin
   # Optional, only if the session token has a custom aud claim:
   CLERK_JWT_AUDIENCE=your-clerk-audience
   ```
8. Set the Stripe webhook endpoint to:
   ```
   https://<your-worker-domain>/api/billing/webhook/stripe
   ```

### Deploy

```
npm run verify
npm run audit:production
npm run deploy:dry-run
npm run deploy
```

Production uses `wrangler.jsonc`. Staging must be created from `wrangler.staging.example.jsonc` with a separate D1 database plus Clerk/Stripe test credentials; the real `wrangler.staging.jsonc` is intentionally ignored. See [docs/operations-runbook.md](docs/operations-runbook.md) for migration, recovery, reconciliation, rollback, and refund procedures.

## Verification

```sh
npm run typecheck
npm run lint
npm run test:unit
npm run test:worker
npm run test:e2e
npm run build
```

Worker tests run inside the Cloudflare Workers runtime against a real local D1 binding. The CI workflow also runs a Wrangler deployment dry run and the production dependency audit gate.

## Architecture

- React app built with Vite into `dist/`.
- A Cloudflare Worker serves static assets and exposes `/api/*` routes.
- API keys and billing logic run only inside the Worker — never shipped to the browser.
- Auth: Clerk JWT verified in the Worker via JWKS.
- Payments: Stripe Checkout with HMAC-SHA256 webhook verification (Web Crypto API).
- Database: Cloudflare D1 with numbered migrations for users, credits, orders, generation requests, custom templates, reconciliation events, and rate-limit buckets.
- Operations: structured request/billing logs, a 15-minute reconciliation schedule, and read-only diagnostic queries in `worker/queries/`.
