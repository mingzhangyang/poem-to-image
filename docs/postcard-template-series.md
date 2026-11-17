# Poetic postcard templates

Three one-sided postcard **artwork** presets, not a two-sided address/mailing
editor or a physical-print fulfillment flow.

| ID | Visual direction | Ink |
| --- | --- | --- |
| `postcard-vintage-travel` | Worn ivory paper, abstract stamp/postmark, distant coastline at the foot | Warm charcoal |
| `postcard-poetry-minimal` | Fine postal rules, quiet ivory whitespace, understated emblem | Graphite |
| `postcard-botanical` | Watercolor botanical corners with small stamp engraving | Dark sage |

## Design invariants

- All three retain their original self-authored, same-origin SVG masters
  without scripts, external imports, or baked poem text. Saved drafts referring
  to the original SVG URLs continue to work.
- Each SVG now also has a 960 x 1200 WebP background (under 13 KB) and a
  360 x 450 WebP gallery thumbnail (under 3 KB). New built-in selections use
  WebP by default, and the original SVG backgrounds and previews remain in
  the repository for compatibility and reuse.
- WebP thumbnails have content-hashed filenames for cache invalidation; the
  gallery still overlays a live, localized poem sample. Text/author/title/notes
  stay editable and are not baked into the background.
- The source canvas is 960 x 1200; backgroundSize: stretch keeps postal frames
  and corner details visible on different editor aspect ratios, at the cost of
  some distortion on very wide formats.
- The built-in stamp toggle is off to avoid confusing the illustrated postal
  stamp with the separate Chinese text seal tool.
- All eight locales include template names/descriptions and a dedicated
  Postcards gallery category and series label. Chinese/Japanese vertical poetry
  continues to use the existing illustrated typography presets.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit` (postcard asset/category/font/localization tests included)
- `npx playwright test tests/e2e/postcard-templates.spec.ts` to check the
  gallery, image decode, restore, and actual browser PNG export.
- Visually inspect short and long poems in English and Chinese on a mobile
  portrait canvas and a landscape canvas, and compare editor vs exported image.

The first version intentionally does not add postal addresses, a reverse side,
bleed/crop marks, paid printing, or postage purchasing.
