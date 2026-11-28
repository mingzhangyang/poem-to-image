# Production account incident — 2026-11-28

Reported around 17:00 UTC: account linking, gallery submission, account listing and template refresh fail; anonymous publishing works. Root cause remains unverified without production logs or an authenticated request.

In Cloudflare Workers Logs for poem-to-image, filter api.request_completed and api.request_failed around 16:50–17:20 UTC for GET /api/me/shares, POST /api/me/shares/claim, PUT /api/me/shares/:id/gallery, GET /api/templates and GET /api/me. Compare status and requestId. 401: verify Clerk production issuer, audience, authorized parties and secret/JWKS match; 503: inspect required bindings; 500: inspect D1 errors and migration status. Do not print secrets or JWTs. Run read-only migration listing (npx wrangler d1 migrations list poem-to-image --remote) and verify schema before applying any pending migration with backup and operator approval. Do not manually assign owner_user_id from a public share ID.

After recovery, in the originating browser sign in, open My shares, add local works to account and then explicitly request gallery listing for the permanent work. Confirm pending status; do not republish or clear local storage. The owner claim is guarded by the private removal key and cannot transfer another account's share.
