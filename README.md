<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your Cloudflare Worker app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/402ae06f-03f6-4751-bd05-b7bac59351c7

## Run Locally

**Prerequisites:** Node.js and a Cloudflare account with Wrangler access.


1. Install dependencies:
   `npm install`
2. Authenticate Wrangler:
   `npx wrangler login`
3. Create a local Worker env file from the example:
   `.dev.vars`
4. Add the AI keys you want to use to `.dev.vars`:
   `GEMINI_API_KEY=your_key_here`
   `OPENAI_API_KEY=your_key_here`
5. Run the Worker API in one terminal:
   `npm run dev:worker`
6. Run the Vite frontend in another terminal:
   `npm run dev`

The Vite dev server proxies `/api/*` requests to the local Worker on port `8787`.

## Deploy

1. Set the production secrets you need:
   `npx wrangler secret put GEMINI_API_KEY`
   `npx wrangler secret put OPENAI_API_KEY`
2. Deploy the Worker and static assets:
   `npm run deploy`

## Architecture

- The React app is built with Vite into `dist`.
- A Cloudflare Worker serves the static assets and exposes `/api/ai-background`.
- Gemini and OpenAI image generation both run only inside the Worker, so API keys are no longer shipped to the browser.
