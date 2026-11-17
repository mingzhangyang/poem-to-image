# Postcards — SVG classics and original WebP collector's series

The gallery now has two genuinely different visual offerings:

- **Poetic Postcards / 诗意明信片 (SVG):** The existing three vector
  templates (`postcard-vintage-travel`, `postcard-poetry-minimal`,
  `postcard-botanical`) remain unchanged, including their original SVG
  preview URLs and draft-compatible background URLs.
- **Premium Postcards / 精品明信片 (WebP):** Four distinct original
  image-generated backgrounds — not copies of the SVG designs.

| ID | English name | Composition |
| --- | --- | --- |
| `postcard-premium-europe` | European Travel Postcard | Old maps, postmarks, Mediterranean waterfront |
| `postcard-premium-botanical` | Botanical Watercolor Postcard | Watercolor wildflowers and textured paper |
| `postcard-premium-letter-collage` | Epistolary Collage Postcard | Antique stationery layers, brass clips and wax seal |
| `postcard-premium-seaside` | Seaside Holiday Postcard | Coastal light, olive leaves, beach linen and shell |

## Design invariants

- Four authentic image-generated **960 × 1200 WebP** backgrounds, each with a
  smaller **360 × 450 content-hashed WebP** gallery thumbnail.
- Artwork intentionally leaves the center blank. The poem, title, author,
  and notes remain fully editable overlays; they are never baked into image.
- Uses existing gallery, typography, save/draft restore, and PNG/JPEG/WebP
  exporter paths with no new service, API calls, or image-generation credits.
- `backgroundSize: stretch` retains the corners on portrait cards; wide
  landscape card sizes may distort the images rather than crop them.
- Avoid extra Chinese stamp over preprinted postal elements (`showStamp: false`).
- A dedicated premium category is localized in all eight supported languages;
  CJK vertical and Latin horizontal verse layouts reuse existing presets.
- Remove the redundant SVG-to-WebP copies proposed in PR #38; keep the
  original vector files and SVG defaults for legacy drafts and consistency.

## Local-only verification

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit` (premium classification, 8 locales, WebP signatures,
  dimensions, content-hashed previews, unique backgrounds, SVG preservation)
- `npx playwright test tests/e2e/premium-postcards.spec.ts tests/e2e/postcard-templates.spec.ts`
  (gallery image loading, selected background persistence, editable poem and PNG export)
- Manually preview a short and long verse in Chinese/English, portrait/landscape,
  and compare editor/export appearance before merging.

This phase adds *one-sided artwork templates*, not printed cards, mailing
addresses, postage purchases, or fulfillment.
