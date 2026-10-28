# Published artwork links — InkPoem

InkPoem can publish an **immutable, public, read-only image snapshot** at `https://inkpoem.com/s/<12-char-id>`. These are not shareable editor state, collaborative documents or private drafts. Publication costs no AI credits.

## User journey

1. Finish an artwork in the editor.
2. Open **Export / Share** (mobile or desktop), then **Publish shareable link**.
3. Read the public-content warning and confirm publication.
4. InkPoem renders the exact work using the existing canvas exporter, creates a 1200×630 JPEG social card and uploads both images through a bounded multipart request.
5. After rendering but **before making any network request**, the browser generates a random 12-character ID and 256-bit revocation token and saves both with a fingerprint of the snapshot in localStorage. It passes both credentials to the Worker, which stores immutable R2 images and D1 metadata. The token is stored as a hash in D1; the public `/s/:id` URL never includes it.
6. Viewers can open the link without signing in, see the read-only image, download it, share the link and follow a link back to InkPoem.
7. The creator can remove the share using its revocation key, either on the publishing browser or by securely pasting a backed-up key into the read-only viewer. If credential storage fails **before** upload, publishing is blocked. If the upload response is lost after the Worker commits, the browser retains the pre-stored ID/token and the dialog shows an uncertain state with an idempotent retry, removal control, and backup option. It never generates a second ID for the same pending snapshot. Never include the key in a shared link.

Sharing is deliberately separate from the existing **Share image** (native file share), **Copy image**, **Download**, and social-platform exports. Existing workflows remain intact. Once published, the snapshot is immutable even if the editor state changes. New publication creates a new link.

## Persistence and routes

- `shared_artworks` D1 table: opaque ID, title, author, image key and MIME, card key, SHA-256 revocation token hash, immutable content fingerprint, creation time, nullable revocation time. A partial index on pending cleanup tombstones allows bounded hourly cleanup.
- `ARTWORKS` R2 binding (private): `shares/<id>/artwork.png|jpg`, `shares/<id>/card.jpg`.
- `POST /api/shares`: anonymous multipart `id` (client-generated 12-character random string), `deleteToken` (256-bit private hex key), `artwork` (PNG/JPEG), `card` (JPEG), `title`, `author`. New creation returns 201; identical retries return 200 with the same ID and token. A repeated ID with a different token or artwork fingerprint returns 409. Credentials must be saved locally **before** uploading; a lost POST response does not lose the ability to revoke.
- `GET /api/shares/:id`: public metadata, never exposes deletion token/hash.
- `DELETE /api/shares/:id`: creator-held `X-Share-Delete-Token` capability; disables D1 visibility and clears title, author and hashed deletion secret before removing R2 objects; nonmatching token returns 404.
- `GET /s/:id`: server-rendered HTML shell with escaped title, description, canonical, OG/Twitter tags (1200×630 social card), JSON-LD. Invalid or revoked ID is an actual 404 with `noindex`.
- `GET|HEAD /s/:id/image.png|jpg` and `/s/:id/card.jpg`: gated through active D1 record and returned with image MIME, `nosniff` and `no-store`. R2 objects are not made publicly accessible.

The viewer is a separate React route and is deliberately outside the Clerk provider; guests do not load the editor or need authentication.

## Abuse controls and limitations

- 72 bits of randomly generated ID entropy; 256-bit random revocation capability, stored as SHA-256 hash in D1.
- No direct arbitrary R2 key is accepted from the request.
- Image size limits: artwork 6 MiB, JPEG card 1.5 MB, total request 9 MiB. PNG signature and IHDR size checks; JPEG signature check; maximum allowed PNG width/height 4096. `Content-Type` and actual file signature must agree.
- At most 5 publication attempts/hour and 20/day per `CF-Connecting-IP`, with a hashed bucket identifier. This is a baseline, not a bot-proof CAPTCHA; evaluate Turnstile if real abuse appears.
- Origin checks defend against ordinary cross-origin browser submissions and removal calls; curl/no-Origin publishing remains supported. Local Vite development also permits loopback-to-loopback origin forwarding (ports 3000/8787); production never permits unrelated origins.
- Anonymous publishing stores and verifies the complete deletion key and pending publication metadata in localStorage **before** sending the multipart request. A lost/invalid response is an uncertain publication, not a confirmed failure; the dialog retains the key and provides idempotent retry or revocation. If the canvas differs from a pending publication, it refuses to overwrite the pending credentials. Never include a private key in a share URL or native share payload.
- Published images can be downloaded and redistributed by visitors; revocation cannot remove third-party copies or cached social previews. Cache-Control is `no-store` for app-served public pages and images.
- Concurrent publication attempts write to separate random R2 prefixes. D1's primary key elects the single canonical winner; losing attempts clean their own unreferenced objects, and identical retries return the existing result without mutating published content. If D1 commit outcome cannot be checked, assets are conservatively retained rather than deleting potentially published files. Separate orphan-object maintenance can reclaim stranded objects from rare infrastructure failures.
- Revocation clears public metadata and disables access immediately, then deletes R2 assets. Failed deletions are retried by the existing hourly maintenance cron in bounded batches; `assets_deleted_at` tracks completion.
- Publishing does not upload edit history, templates, arbitrary localStorage or original unrendered user-upload files.

## One-time Cloudflare provisioning (before merge/deployment)

From the Cloudflare account hosting the Worker:

```sh
npx wrangler r2 bucket create inkpoem-shared-artworks
npx wrangler r2 bucket create inkpoem-shared-artworks-staging
```

Provision staging D1 and credentials according to [operations runbook](operations-runbook.md). The repository's existing `wrangler.jsonc` now has an `ARTWORKS` R2 binding to `inkpoem-shared-artworks`; `wrangler.staging.example.jsonc` points to a separate staging R2 bucket. Keep buckets private; no custom public R2 domain is needed.

For local development, initialize local D1 before opening the Vite editor:

```sh
npx wrangler d1 migrations apply DB --local --config wrangler.jsonc
```

After both resources exist, apply the new numbered D1 migration **before deploying Worker code**:

```sh
npx wrangler d1 migrations apply DB --remote --config wrangler.staging.jsonc
npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc
```

Only deploy to production after CI is green, staging proves full publish/view/OG/revoke and both R2 + migration are provisioned. A missing binding/config causes shares to return 503 and should block release.

## Acceptance gates

- `npm run verify` (typecheck, lint, unit tests, worker runtime tests, build)
- `npm run test:e2e` (desktop and mobile export UI, including dropped responses and transient viewer errors)
- Anonymous create succeeds with a 12-char ID and returns an unguessable management capability.
- Deep-link `/s/:id` works in private browsing; it never invokes Clerk.
- Browser and network crawlers receive title/description/canonical and unique OG image **in server HTML**. Cloudflare `assets.run_worker_first: ["/s/*"]` in production and staging routes share pages through the Worker before SPA fallback; the Worker fetches `/` (not `/index.html`, which redirects on Cloudflare).
- PNG and JPEG artwork display; thumbnail is a 1200×630 JPEG and is not broken.
- Wrong/absent revocation token cannot remove an artwork. A creator holding a backed-up private token can revoke from a different browser, including when localStorage was lost.
- Revoking instantly fails new D1-gated page, API and asset requests; missing ID is actual 404, not SPA soft-404.
- Malformed, cross-origin, oversized and rate-limited publish requests fail clearly.
- If the browser rejects saving the owner or pending publication credentials, it sends **no POST**. If POST succeeds but its response is lost, retry uses the same ID/key, returning 200 without duplicate publication. An uncertain result keeps the key visible, with retry/revoke and an explicit backup acknowledgment gate.
- JSON-LD serializes literal dollar sequences (`$$`, `$&`, `$'`) and HTML metacharacters without corrupting structured data.
- Native **Share image** and **Copy image** remain unchanged.
