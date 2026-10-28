# Published artwork links — InkPoem

InkPoem can publish an **immutable, public, read-only image snapshot** at `https://inkpoem.com/s/<12-char-id>`. These are not shareable editor state, collaborative documents or private drafts. Publication costs no AI credits.

## User journey

1. Finish an artwork in the editor.
2. Open **Export / Share** (mobile or desktop), then **Publish shareable link**.
3. Read the public-content warning and confirm publication.
4. InkPoem renders the exact work using the existing canvas exporter, creates a 1200×630 JPEG social card and uploads both images through a bounded multipart request.
5. The Worker saves the two images in a private R2 bucket and the metadata in D1. The returned 12-character random ID forms `/s/:id`; the secret revocation token is only returned to the creating browser.
6. Viewers can open the link without signing in, see the read-only image, download it, share the link and follow a link back to InkPoem.
7. The creator can remove the share from the same browser. The revocation secret is kept in localStorage on that device; clearing site data loses revocation access.

Sharing is deliberately separate from the existing **Share image** (native file share), **Copy image**, **Download**, and social-platform exports. Existing workflows remain intact. Once published, the snapshot is immutable even if the editor state changes. New publication creates a new link.

## Persistence and routes

- `shared_artworks` D1 table: opaque ID, title, author, image key and MIME, card key, SHA-256 revocation token hash, creation time, nullable revocation time.
- `ARTWORKS` R2 binding (private): `shares/<id>/artwork.png|jpg`, `shares/<id>/card.jpg`.
- `POST /api/shares`: anonymous multipart `artwork` (PNG/JPEG), `card` (JPEG), `title`, `author`; 201 returns ID, absolute link, creator-only deletion token.
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
- Anonymous publishing requires working localStorage for the browser-held revocation capability; browsers that block storage must allow site data before publishing.
- Published images can be downloaded and redistributed by visitors; revocation cannot remove third-party copies or cached social previews. Cache-Control is `no-store` for app-served public pages and images.
- R2 writes happen before D1 insert. On failure, the Worker best-effort cleans up uploaded R2 objects; unreachable orphans may require maintenance if R2 deletion also fails.
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
- `npm run test:e2e` (desktop and mobile export UI)
- Anonymous create succeeds with a 12-char ID and returns an unguessable management capability.
- Deep-link `/s/:id` works in private browsing; it never invokes Clerk.
- Browser and network crawlers receive title/description/canonical and unique OG image **in server HTML**.
- PNG and JPEG artwork display; thumbnail is a 1200×630 JPEG and is not broken.
- Wrong/absent revocation token cannot remove an artwork.
- Revoking instantly fails new D1-gated page, API and asset requests; missing ID is actual 404, not SPA soft-404.
- Malformed, cross-origin, oversized and rate-limited publish requests fail clearly.
- Native **Share image** and **Copy image** remain unchanged.
