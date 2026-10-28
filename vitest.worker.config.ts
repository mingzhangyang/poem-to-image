import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'worker/migrations'));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            CLERK_SECRET_KEY: 'test_clerk_secret',
            CLERK_JWT_ISSUER: 'https://clerk.test',
            CLERK_ALLOWED_AUTHORIZED_PARTIES: 'https://inkpoem.test',
            STRIPE_SECRET_KEY: 'test_stripe_secret',
            STRIPE_WEBHOOK_SECRET: 'test_webhook_secret',
          },
          serviceBindings: {
            ASSETS: async (request: Request) => {
              const path = new URL(request.url).pathname;
              if (path === '/index.html') return Response.redirect(new URL('/', request.url), 307);
              if (path !== '/') return new Response('Asset not found', { status: 404 });
              return new Response(
                '<!doctype html><html><head><title>InkPoem test</title>'
                + '<meta property="og:image" content="/preview.png" />'
                + '<link rel="canonical" href="https://inkpoem.test/" />'
                + '</head><body><div id="root"></div></body></html>',
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
              );
            },
          },
        },
      }),
    ],
    test: {
      include: ['tests/worker-runtime/**/*.test.ts'],
      setupFiles: ['./tests/worker-runtime/apply-migrations.ts'],
      testTimeout: 15_000,
      // One runtime process is more reliable on constrained CI runners. The
      // concurrency invariants are still exercised inside their individual tests.
      fileParallelism: false,
    },
  };
});
