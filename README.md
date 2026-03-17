# InkPoem

Turn poems into AI-generated images. Built with React + Vite, deployed on Cloudflare Workers with a D1-backed credit billing system.

## Features

- AI image generation via Gemini and OpenAI
- Clerk authentication
- Stripe credit purchases
- Cloudflare D1 database for user credits and transaction history
- PWA support

## Credit Costs

| Model | Credits | Approx. API Cost |
|---|---|---|
| Gemini (NanoBanana 2) | 2 credits | ~$0.067 |
| OpenAI (gpt-image-1 medium) | 1 credit | ~$0.042 |

## Credit Packages

| Package | Credits | Price |
|---|---|---|
| Starter | 20 | $1.99 |
| Pro | 54 | $4.99 |
| Plus | 112 | $9.99 |

## Run Locally

**Prerequisites:** Node.js and a Cloudflare account with Wrangler access.

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
   STRIPE_SECRET_KEY=your_key_here
   STRIPE_WEBHOOK_SECRET=your_key_here
   ```
5. Create a `.env` file for the frontend:
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
4. Copy the `database_id` into `wrangler.toml`.
5. Run the database migration:
   ```
   wrangler d1 execute poem-to-image --file=worker/schema.sql
   ```
6. Set Worker secrets:
   ```
   npx wrangler secret put CLERK_SECRET_KEY
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put OPENAI_API_KEY
   ```
7. Set the Stripe webhook endpoint to:
   ```
   https://<your-worker-domain>/api/billing/webhook/stripe
   ```

### Deploy

```
npm run deploy
```

## Architecture

- React app built with Vite into `dist/`.
- A Cloudflare Worker serves static assets and exposes `/api/*` routes.
- API keys and billing logic run only inside the Worker — never shipped to the browser.
- Auth: Clerk JWT verified in the Worker via JWKS.
- Payments: Stripe Checkout with HMAC-SHA256 webhook verification (Web Crypto API).
- Database: Cloudflare D1 (5 tables: `users`, `credit_accounts`, `orders`, `credit_transactions`, `generation_requests`).
