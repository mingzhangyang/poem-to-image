# Poetic postcard templates

Three one-sided postcard **artwork** presets, not a two-sided address/mailing
editor or a physical-print fulfillment flow.

| ID | Visual direction | Ink |
| --- | --- | --- |
| `postcard-vintage-travel` | Worn ivory paper, abstract stamp/postmark, distant coastline at the foot | Warm charcoal |
| `postcard-poetry-minimal` | Fine postal rules, quiet ivory whitespace, understated emblem | Graphite |
| `postcard-botanical` | Watercolor botanical corners with small stamp engraving | Dark sage |

## Design invariants

- All three use small, self-authored, same-origin SVG assets without scripts,
  external image/font imports, or baked poem text. Poem/title/author/notes remain
  editor layers and stay editable in every supported locale.
- Background SVG and gallery preview have distinct URLs, sharing the same source
  artwork. The preview shows the existing **live localized poem sample**.
- The SVG canvas is 960 x 1200; `backgroundSize: stretch` preserves its postal
  borders and corner details on any supported canvas preset, at the cost of
  distortion on very wide aspect ratios.
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
