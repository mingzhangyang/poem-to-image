# InkPoem · Natural Seal Impression (Phase 3)

Phase 1 introduced shared high-DPI Canvas preview/export. Phase 2 introduced
optional Zhu Wen / Bai Wen typography and licensed seal-script sources.
Phase 3 improves *ink deposition*, not the font, document model or editor command
architecture.

## Two compatible styles

- Saved stamps without a textureStyle field **retain the exact original dot-based
  weathering algorithm**. Explicit textureStyle: "classic" is identical.
- New default stamps and the three traditional presets can opt into
  textureStyle: "natural". The modern-calligraphy preset selects classic.
- Both styles still use drawStampBody → drawStampImpression, with **one** Canvas
  drawing core shared by preview and all export resolutions.
- textureSeed is an optional unsigned 32-bit number persisted in StampConfig
  through the existing editor snapshot, undo history and draft saves.
  Existing saved stamps do not need a migration. No storage protocol changed.

## Independent texture identity

A natural texture is specified only by a seed, with geometry in **unit seal
coordinates 0..1**. The placement is mapped to current pixels after font and
shape composition. The seed is *not* derived from size, font, rotation, opacity,
ink color, mode or weathering. The new-stamp creator and style/preset controls
persist a seed; changing those parameters does not change the impression
identity. "New impression" advances the seed deterministically and is undoable.

For malformed imported natural stamps with no seed, a deterministic text-only
hash provides a compatible fallback. If text itself changes on such a malformed
stamp the fallback identity changes; controls explicitly persist the seed before
editing.

## Ink / paper interaction

The plan is pure and bounded:
- 22 translucent, irregular elliptical pigment variations;
- 16 perimeter-based uneven edge bites, following circle or quadrilateral shape;
- 10 thin broken-ink cracks;
- 64 subtly bent paper-fiber bleed/void marks.

All paths are deterministic and use Canvas destination-out with **partial
alpha**, removing some ink without painting a fake paper color. Underlying paper
textures and photos remain visible through each loss of ink. Intensity
progressively reveals a prefix of the same plan; it does not regenerate the
plan, change mark centers or shift an existing defect. A plan is immutable to
consumers and cached by seed, up to 24 entries. The maximum number of marks is
112, regardless of stamp size, zoom, export DPR or display device.

This is a procedural 2D visual approximation, **not** a fluid simulation, a
per-pixel physical paper/ink interaction or a guarantee of authentic
hand-printed artifacts. Those claims would require real references and manual
visual comparisons.

## Performance and equivalence

- Canvas allocation and the glyph/shadow compositing are unchanged from Phase 1
  (max 2048 backing pixels per side).
- StampOverlay now skips repaint when only **position, rotation or opacity**
  changes. Those transforms and alpha are applied on the CSS wrapper without
  changing the inner Canvas ink bitmap. Font-ready, size, style, text, color,
  weathering, seed, texture style or DPR still invalidate the paint.
- Both preview and export call drawStampBody; there is no second texture engine.
- Geometry/feature generation is pure; no Math.random(), Date.now(), fetching,
  external noise images or DOM state is used for the impression seed.

## Manual acceptance checklist — no GitHub Actions dispatch

With Node.js 24 in a complete local checkout:

    npm ci
    npm run cf:typegen
    npm run typecheck
    npm run lint
    npm run test:unit
    npm run build
    npm run test:worker
    npm run verify:build
    npm run test:e2e

On desktop/mobile Chromium and real iPhone Safari: inspect classic saved seals,
new natural Zhu Wen / Bai Wen seals, square/round/hand-carved outlines, 1–4
characters, CJK and supplementary-plane characters; sample the difference
between 0/25/50/75/100% wear at 1x/2x/3x export and Retina preview. Check ink
and paper contrast, weathering's direction, edge clipping, seed consistency
after color/size/opacity/rotation changes, template language switching,
Undo/Redo, draft recovery, PNG/JPEG/WebP and shared artwork import.

The new Playwright suite includes deterministic pixel comparisons for 18
Zhu/Bai Wen × stamp style × 1x/2x/3x combinations, as well as restoration,
Undo/Redo and a broad browser render-time guard. Isolated command-budget
tests cover 0..100 intensity and giant restored stamp sizes.

**Verification status at Draft creation:** these are authored checks, not a
claim that npm, Chromium or iPhone Safari were run. The connector environment
could not clone the repository due unavailable GitHub DNS, so real browser and
font-loaded outputs remain pending.
