import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('Worker HTTP boundaries', () => {
  it('adds no-store and security headers to public API responses', async () => {
    const response = await SELF.fetch('https://inkpoem.test/api/billing/packages');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('fails closed at the authentication boundary', async () => {
    const response = await SELF.fetch('https://inkpoem.test/api/me');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns 404 JSON for unknown API routes instead of the SPA shell', async () => {
    const response = await SELF.fetch('https://inkpoem.test/api/not-a-route');
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns an Allow header for unsupported methods', async () => {
    const response = await SELF.fetch('https://inkpoem.test/api/billing/packages', {
      method: 'POST',
    });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('bounds the unauthenticated Stripe webhook body', async () => {
    const response = await SELF.fetch('https://inkpoem.test/api/billing/webhook/stripe', {
      method: 'POST',
      body: 'x'.repeat(256 * 1024 + 1),
    });
    expect(response.status).toBe(413);
  });

  it('adds document security headers to Worker-served HTML', async () => {
    const response = await SELF.fetch('https://inkpoem.test/privacy');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });
});
