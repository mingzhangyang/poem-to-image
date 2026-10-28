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
- Each concurrent attempt uploads to distinct random R2 paths, and the D1 conditional update atomically selects one winner. Losing attempts clean their own uploads. A pending row is not exposed by public GET/HTML/image routes.
- Network errors, unreadable responses, 429s and other ambiguous retry failures **never erase stored creator credentials**. The dialog displays a protected recovery state: retry the same unchanged snapshot, cancel the previous ID, or securely back up the key before closing.
- When an uncertain pending publication blocks publishing edited artwork, the creator can cancel the old ID before attempting a new share. Cancelling a request that never reached the Worker is valid and idempotent; the Worker inserts a **revocation tombstone** into D1 if necessary. Thus even an older request arriving afterward cannot reserve or publish that ID. A cancellation in the middle of R2 upload wins over the final conditional D1 update.
- `DELETE /api/shares/:id`: requires the private `X-Share-Delete-Token`. The Worker hashes the token, atomically revokes an existing reservation or published row, or records a tombstone when the ID was not seen previously; repeats using the same capability are accepted. The browser clears the matching pending record and owner key only after an acknowledged cancellation.
- `GET /api/shares/:id`: public metadata only for fully published, not-revoked work. `GET /s/:id`: server-delivered HTML with escaped OG/Twitter/JSON-LD metadata and true 404/noindex for absent, pending or revoked IDs.
- `GET|HEAD /s/:id/image.png|jpg`, `/s/:id/card.jpg`: private R2 reads gated by the published D1 record.

Revocation immediately disables public reads and erases stored title/author. D1 retains an ID tombstone and the SHA-256 key hash so delayed publish requests and repeated deletes are handled safely. R2 cleanup is retried by the existing hourly maintenance task if an object deletion fails; a partial index bounds this query.

## Privacy and abuse controls

- Random ID entropy: 72 bits; private revocation key: 256 bits; only a hash is saved in D1.
- Artwork max 6 MiB; social card max 1.5 MiB; total request max 9 MiB. Image MIME signatures and basic dimensions are checked.
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

Check the Worker runtime tests for reservation/cancellation races, idempotent retries, malformed payloads, revocation, OG and public 404s. Check browser tests on desktop and mobile for normal publishing, lost responses, failed local storage, pending cleanup and viewer recovery.

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
