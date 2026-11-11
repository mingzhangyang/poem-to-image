# InkPoem · Phase 4A: Chinese seal shapes & measured layout

Baseline: `main@2386b269` (PRs #21–#26 merged; no open PR/issues when work began).

## Scope

- Three opt-in non-square forms: vertical rectangle, horizontal rectangle and vertical oval.
- `stamp.shapeRatio` is optional and represents short/long side ratio (0.45–0.90;
  absent defaults to 0.68). `size` remains the longest side; existing square,
  round and brush stamps ignore `shapeRatio` and keep the exact old geometry.
- 1–8 Unicode grapheme clusters. New forms use real horizontal/vertical slot
  dimensions and glyph-metric fitting with **uniform scaling**. Traditional
  1–4 glyph layouts of existing forms are unchanged.
- Vertical rectangle: one right-to-left column for up to six glyphs, then two
  columns. Horizontal rectangle: up to four single-glyph columns, then paired
  columns. Oval: up to four vertically stacked glyphs, then two columns.
- The oval fits the visible glyph ink, including any added stroke, into the
  actual ellipse rather than clipping a corner of a rectangular glyph cell.
- New rectangles use small carved-looking corner radii (3.5% of the short
  side). The natural ink sampler follows their real perimeter or the oval
  curve and retains the persisted texture seed.
- **Same Canvas compositor** is used for CSS preview and 1×/2×/3× export.
  Width and height are allocated independently with a common capped scale.

## Compatibility invariants

1. Existing drafts and built-in templates keep their original `style`,
   `mode`, text, size, positions, seeds and visual paths. Their square preview
   and export allocation still uses the same maximum 2048 px backing.
2. New fields are optional in `StampConfig`, editor snapshots, history,
   template saves, and persisted drafts; no storage or Worker migration.
3. A shape change preserves text, stamp position, opacity and ink identity;
   it does not reset the seal or apply a destructive preset.
4. Historical 1–4 glyph square/circle/brush measured layout is retained; the
   modern >4 glyph case uses measured cells instead of overlapping characters.
5. No new font dependencies, figure assets, watermark, image generation, or
   Phase 4B/4C work is included.

## Local-only validation checklist

Run with Node 24 and full installed dependencies (never dispatch GitHub Actions):

```sh
npm ci
npm run cf:typegen
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run verify:build
npm run test:e2e
```

Visual checks: all six forms at ratio 45/60/90%, 1/2/3/4/5/6/7/8 Han
characters, Zhu/Bai/modern modes, natural/classic impressions,
0/25/50/75/100 weathering, outline/filled ink, rotated stamps, iPhone Safari
at high DPR, preview→PNG/JPEG/WebP export fidelity, and transparent/photo/paper
backgrounds. Confirm no font stretching; check 3- and 4-character seals,
round/oval stroke clipping, very small stamps and fonts missing Han glyphs.
Check 2048px cap with oversized restored drafts, undo/redo, persistence,
locale switching and legacy saved stamps.

The GitHub connector cannot clone/run the full dependency graph in this
environment; code and tests are committed for independent local validation.
No claim of successful Node, Chromium or Safari test execution is made.
