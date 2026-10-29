# InkPoem public, read-only artwork links

Users may publish an immutable rendered snapshot at `https://inkpoem.com/s/<id>`. Publication is anonymous and does not spend AI credits, upload the editor project or make an editable document public.

## Reader and creator flow

1. Finish a poem, open Export / Share, select **Publish shareable link** and confirm the public-content warning.
2. InkPoem renders the artwork and a 1200×630 JPEG preview. **Before any upload**, the browser generates a random 12-character share ID and 256-bit deletion capability, and verifies both can be stored in localStorage along with the exact rendered snapshot fingerprint.
3. The Worker validates the multipart request and coordinates a D1 publication reservation followed by private R2 object uploads. A conditional D1 update publishes only one immutable snapshot per ID.
4. The resulting `/s/:id` page is read-only, unauthenticated, downloadable and shareable; OG/Twitter metadata is inserted into server-delivered HTML.
5. Creators can revoke a link from the original browser or use a securely backed-up deletion key on another device. The key **must never be included in the public URL**.

The existing **Share image**, **Copy image**, **Download** and social-platform export actions remain separate and unchanged.

## Failure-safe publication protocol

The browser stores the share ID, removal capability and content fingerprint in `inkpoem.share.pending.v1` and the owner key in `inkpoem.share.owner.<id>` *before* issuing POST. It keeps these credentials until the publish outcome is confirmed or a server-confirmed cancellation occurs.

- `POST /api/shares`: multipart `id`, `deleteToken`, `artwork`, `card`, `title`, `author`. Missing/invalid payloads are rejected. The Worker inserts a reserved D1 row before writing R2. First successful publish returns 201; an identical retry returns 200. A different fingerprint or owner token for an existing ID returns a 409 without overwriting the work.
- Each concurrent attempt uploads to distinct random R2 paths, and the D1 conditional update atomically selects one winner. **Every attempt is recorded in `shared_artwork_upload_attempts` before its first R2 write.** Successful attempts remove their tracking row; failed losing/cancelled attempts delete both R2 keys and only then remove the row. Cleanup failures remain durable for the existing hourly maintenance cron. Reconciliation waits at least 60 minutes and checks whether D1 references either key before deleting, so published snapshots cannot be accidentally removed. A pending share is never publicly visible.
- Network errors, unreadable responses, 429s and other ambiguous retry failures **never erase stored creator credentials**. The dialog displays a protected recovery state: retry the same unchanged snapshot, cancel the previous ID, or securely back up the key before closing.
- When an uncertain pending publication blocks publishing edited artwork, the creator can cancel the old ID before attempting a new share. Cancelling a request that never reached the Worker is valid and idempotent; the Worker inserts a **revocation tombstone** into D1 if necessary. Thus even an older request arriving afterward cannot reserve or publish that ID. A cancellation in the middle of R2 upload wins over the final conditional D1 update.
- `DELETE /api/shares/:id`: requires the private `X-Share-Delete-Token`. The Worker hashes the token, atomically revokes an existing reservation or published row, or records a tombstone when the ID was not seen previously; repeats using the same capability are accepted. The browser clears the matching pending record and owner key only after an acknowledged cancellation.
- `GET /api/shares/:id`: public metadata only for fully published, not-revoked work. `GET /s/:id`: server-delivered HTML with escaped OG/Twitter/JSON-LD metadata and true 404/noindex for absent, pending or revoked IDs.
- `GET|HEAD /s/:id/image.png|jpg`, `/s/:id/card.jpg`: private R2 reads gated by the published D1 record.

Revocation immediately disables public reads and erases stored title/author. D1 retains an ID tombstone and the SHA-256 key hash so delayed publish requests and repeated deletes are handled safely. The hourly maintenance cron retries both canonical revoked-artwork deletion and abandoned upload-attempt cleanup; the two work queues are indexed and processed in bounded batches.

## Production incident checklist: publish remains uncertain, share URL returns 404

The application can persist a browser-side share ID and removal key **before any
server-side write**. Reusing that ID on retry is only evidence that browser
idempotency works, **not evidence that the artwork reached R2 or D1**.
An `Artwork unavailable` HTML response is the Worker's 404 for a share
without a fully published D1 row. A failed DELETE is separately actionable:
it should succeed even if no prior POST reached the Worker.

1. **After deploying the readiness fix**, check the read-only endpoint:
   ```sh
   curl -i https://inkpoem.com/api/health/sharing
   ```
   HTTP 200 with `{"ready":true}` confirms the live Worker can query
   the `shared_artworks` and `shared_artwork_upload_attempts` tables
   (including `published_at`) and access the private R2 bucket. HTTP
   503 with `SHARE_DB_UNAVAILABLE`, `SHARE_SCHEMA_UNAVAILABLE` or
   `SHARE_STORAGE_UNAVAILABLE` directs the next check. This is a
   **readiness probe, not a successful publish test**.
2. Confirm the production bindings and the numbered migration:
   ```sh
   npx wrangler r2 bucket list
   npx wrangler d1 migrations list DB --remote --config wrangler.jsonc
   # Only if migration 0005 is not yet applied:
   npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc
   ```
   The R2 bucket should be `inkpoem-shared-artworks`, bound as
   `ARTWORKS`. Database `poem-to-image` should be bound as `DB`.
   Do not recreate an existing bucket/database or reapply already-run
   migrations by hand.
3. Investigate the failed share ID without using a removal token:
   ```sh
   npx wrangler d1 execute DB --remote --config wrangler.jsonc --command="SELECT id, published_at, revoked_at, image_key IS NOT NULL AS has_image, card_key IS NOT NULL AS has_card FROM shared_artworks WHERE id = 'IuNUygyu6ULo';"
   curl -i https://inkpoem.com/api/shares/IuNUygyu6ULo
   curl -i https://inkpoem.com/s/IuNUygyu6ULo
   ```
   No row means the Worker never durably reserved that ID (or it is
   querying a different database). A row with `published_at IS NULL`
   means the publish did not finalize. `revoked_at IS NOT NULL` means
   cancellation succeeded. If a published row exists but the public
   page is unavailable, inspect the Worker route/deployment and read
   the canonical R2 objects using their private keys; do not make the
   bucket publicly readable.
4. If readiness passes but both POST and DELETE still fail, inspect
   **only response metadata** in the browser Network panel: status,
   content type, `X-Request-ID` and `CF-Ray`. A JSON `403 Invalid origin`
   with `X-Request-ID` is a Worker origin check; a challenge/HTML
   response without the Worker header may instead indicate a Cloudflare
   security/WAF rule. Check Cloudflare Security Events before changing
   application code or repeating destructive actions. For a 500 with
   `X-Request-ID`, correlate that ID with Worker logs; for a 502
   `PUBLISH_UNCERTAIN`, investigate R2 writes and D1 finalization.
   **Do not copy request headers or multipart request bodies** because
   they contain the private deletion key. If contacting support, redact
   them completely.
5. After fixing the production deployment, publish one disposable
   **new** artwork, open the share URL anonymously, confirm both the
   artwork image and social card return 200, then revoke it. Recheck
   the page, API and image paths return 404. Do not mark the feature
   ready merely because the preflight responds 200.

Client-facing errors now distinguish `NETWORK_ERROR`, HTTP response
codes and malformed responses while preserving the original pending ID
and revocation key. On ambiguous failures the browser first attempts a
read-only GET + both R2 HEADs before claiming that an upload completed.

**Never** include the private deletion token in bug reports, URLs, GET
requests, screenshots or terminal commands. Keep it in the original
browser or a secure local backup until server-confirmed revocation.
Do not repeatedly press Publish against an unhealthy deployment:
the original browser pending state can be retried after recovery.

## Privacy and abuse controls

- Random ID entropy: 72 bits; private revocation key: 256 bits; only a hash is saved in D1.
- Artwork max 6 MiB; social card max 1.5 MiB; total request max 9 MiB. PNG IHDR and JPEG SOF marker dimensions are validated (maximum 4096 pixels per axis); malformed, unsupported or truncated JPEG headers are rejected instead of relying solely on a three-byte signature.
- Publication is rate-limited per hashed `CF-Connecting-IP` to five attempts per hour and 20 per day. Do not bypass these limits in production.
- Normal cross-origin browser requests are rejected; localhost Vite proxy is explicitly supported for development. Private R2 buckets do not need a public custom domain.
- The creator can lose browser-held revocation access by clearing site data unless they kept a separate private backup. Public images downloaded by others and third-party cached social previews cannot be recalled.
- No arbitrary editor drafts, templates, original uploaded assets or AI requests are sent by the share endpoint. Publish is an explicit user action.

## Production-only deployment — no staging environment

This project does **not** require a staging Worker, staging D1 database or separate staging R2 bucket for this feature. Leave the repository's pre-existing staging example unrelated to the feature unchanged.

### Local and CI verification

```sh
npm ci
npx wrangler d1 migrations apply DB --local --config wrangler.jsonc
npm run verify
npm run test:e2e
npm run deploy:dry-run
```

Check the Worker runtime tests for reservation/cancellation races, idempotent retries, malformed and oversized JPEG/PNG uploads, durable orphan R2 cleanup retries, revocation, OG and public 404s. The frontend unit suite compares `schema.sql` table columns against the complete numbered migrations. Browser tests cover desktop and mobile publishing, lost responses, failed local storage, pending cleanup and viewer recovery.

### One-time production resources

Using the Cloudflare account that deploys InkPoem:

```sh
npx wrangler r2 bucket create inkpoem-shared-artworks
npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc
```

`wrangler.jsonc` binds the private R2 bucket as `ARTWORKS` and the existing D1 database as `DB`. Apply the `0005_shared_artworks.sql` migration **before** deploying Worker code. Confirm these bindings and migration in the Cloudflare dashboard. Provisioning has **not** been performed from GitHub.

### Controlled production launch and rollback

1. Verify all CI jobs pass and review the migration. Create the production R2 bucket and apply remote D1 migration. Then deploy using the repository's existing production release process (not as part of a PR fix).
2. Open InkPoem and explicitly publish a disposable non-sensitive sample. Validate its URL in a private browser, server HTML OG image and title, image MIME, and download.
3. Revoke that sample; confirm the public API, page and images return 404, the HTML has `noindex`, and neither title nor author remains in D1. Test idempotent cancellation of an unused ID locally; do not simulate deliberately broken uploads against production.
4. If the share feature is unhealthy, **roll back the Worker code to the prior release while leaving the additive D1 migration and private R2 bucket intact**. Do not delete R2 objects or revert the database schema during an emergency rollback; preserve existing user content and deletion capabilities. Fix and redeploy only after diagnosis.

A missing binding, unapplied migration or failed production smoke check blocks declaring the feature launched.
