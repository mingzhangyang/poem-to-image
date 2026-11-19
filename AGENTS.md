# Agent guide

Instructions for AI coding agents working in this repository. Keep this file
current when a rule here changes.

## Verify before committing

- Run `npm run verify` before committing. It regenerates Worker types, then
  runs typecheck, lint, unit and Worker tests, the build and
  `verify:build`. Commits tagged `[skip ci]` skip CI, so a local `verify` is
  the only check they get.
- After changing `wrangler.jsonc` (bindings, R2 buckets, D1 databases), run
  `npm run cf:typegen` and commit the regenerated `worker-configuration.d.ts`.

## Template images

### Where they live

- Template backgrounds are in `public/template-backgrounds/` and gallery
  thumbnails in `public/template-previews/`. They ship as Workers static
  assets.
- Keep them same-origin. Backgrounds are drawn into a canvas and exported
  with `toBlob`; a cross-origin image without CORS taints the canvas and
  breaks export. Do not move them to R2 or another host without first
  agreeing the plan with the maintainer (see "Moving to R2" below).

### Formats

- Raster backgrounds and previews are WebP. Postcard-style templates may use
  self-contained SVGs (no scripts, `foreignObject`, text or external URLs).
- Commit only the optimized WebP. Do not commit source PNGs or other
  originals next to it.

### Preview budgets

- Budgets are defined once in `scripts/asset-budgets.mjs` and enforced by
  both `scripts/verify-build.mjs` and
  `tests/frontend/template-preview-assets.test.ts`:
  - each preview at most 100 KiB;
  - previews average at most 20 KiB.
- There is no total budget: previews are lazy-loaded, so the total grows
  with the gallery without reflecting what a visitor downloads.
- If a new preview pushes the average over budget, compress it (WebP
  quality around 72 at the existing 360–480 px widths looks the same at
  thumbnail size). Change a budget only in `scripts/asset-budgets.mjs`, and
  only with the maintainer's agreement.

### Preview file names

- Preview files are named `<template-id>.<hash>.<ext>` and
  `/template-previews/*` is served with `Cache-Control: immutable`, so
  browsers never refetch a name they have seen.
- For new or changed previews, use the first 8 hex characters of the file's
  SHA-256 as `<hash>`. Some older postcard previews carry hashes that do not
  match their bytes; leave them unless the file itself changes.
- Whenever a preview's bytes change, rename it with its new hash and update
  every reference. Never overwrite a file under an existing hashed name.

### Removing or renaming a background

- Saved drafts (IndexedDB/localStorage) and custom templates store the
  background URL. Deleting or renaming a background that has shipped breaks
  them, and the SPA fallback serves `index.html` instead of a 404.
- Before removing or renaming one, map the old path to its replacement in
  `migrateLegacyTemplateBackground` (`src/backgroundImageSource.ts`) and
  cover it with a test.

### Before deleting any asset

- Some paths are built with template literals, e.g.
  `` `/template-previews/${id}.${previewHash}.webp` `` in
  `src/templates/premium-postcards.ts`, so grepping for the file name misses
  them. Check how each template module builds its paths, and run the unit
  tests, before treating a file as unused.

### Moving to R2

Static assets are the right home at the current scale. Revisit R2 when any
of these holds: the template set reaches several hundred images or the git
history grows to hundreds of MB; templates must be published without a
deploy; or templates come from users or AI generation. If moving:

- use a dedicated bucket, not `inkpoem-shared-artworks` (`ARTWORKS`);
- keep images same-origin by serving them through the Worker (add the path
  to `run_worker_first`), or configure CORS and `crossOrigin = 'anonymous'`
  together;
- keep content-hashed names with immutable caching;
- check in CI that every referenced image exists in the bucket.
