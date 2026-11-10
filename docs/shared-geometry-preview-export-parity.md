# Phase 4 — Shared Geometry & Preview/Export Parity

## Baseline and objectives

Based on PR #18's merged `main`, this phase extracts editor positioning
mathematics while keeping the existing drawing pipeline, saved schema,
individual overlay components and image-export APIs intact. The app already
shares `textLayout.ts` and `poemContent.ts` across preview and Canvas;
this is **not** a renderer rewrite.

## Shared geometry

`src/positioningRect.ts` is the single source for:

- Preview's content box extraction, including transform-scaled CSS borders.
  Pointer movement uses post-transform viewport pixels; no mixed CSS pixel
  units when zoomed.
- Drag bounds for rotated or scaled element boxes, arrow-key motion with
  Shift=3% and normal=1%, and pointer delta → percentage positions.
- Poem/custom-text side-resize widths, relative position, keyboard resize
  and DOM readback center/top-left metadata.
- Canvas image/logo/stamp/signature centers, and poem top-left origin.
  Renderers consume the same percent-to-content-rect projection.
- The original bounds, 60px mouse-resize minimum, 5–100% percentage width
  range and keyboard movement increments remain unchanged.

All five preview overlay types use the shared movement/nudge rules;
poem and custom text additionally use shared resize and DOM readback rules.
Canvas export's center positions and poem origin now call the same pure
coordinates. The background and vector drawing paths are untouched.

### Positioning metadata invariant

Poem/custom text may carry `exportLeft/exportTop` measured after a pointer
drag or resize to match the preview's top-left. After a **keyboard nudge or
keyboard width change**, these previously measured coordinates are cleared,
so Canvas uses the new percentage center. Without this, export can display
the *old* position despite the editor showing the new one. The persisted
scene shape stays backwards-compatible; no migration is necessary.

### Font readiness / preview parity

Canvas export already waits for the actual font stylesheet, selected
glyphs, and unicode-range font faces. Live preview previously calculated
layout before those fonts had loaded, then held fallback metrics until
another edit happened.

`useFontLayoutRevision(fontFamily, text)` now requests the same glyph
readiness and bumps a local layout revision after completion. Both
structured poem and custom text preview remeasure their shared layout
once ready. Pending loads are cancelled on font/text changes and on
unmount; offline font failures keep the current fallback preview rather
than erasing text. Exports keep their existing font failure behavior.

**Not claimed:** full pixel identity between HTML/CSS and Canvas text
engines across browsers (anti-aliasing and font metric differences remain).
The goal here is shared geometry, stable placement, and font-ready
measurements, with manual screenshot checks to catch visual drift.

## Regression coverage

- `tests/frontend/positioning-parity.test.ts` exercises drag bounds,
  zoom invariance, keyboard motion, both resize handles, preview readback
  versus Canvas origin, inset-border positioning, and scaled borders.
- `tests/frontend/render-canvas-export.test.ts` now checks that custom
  text and Logo placements use the same center within an inset border.
- `tests/e2e/preview-export-position-parity.spec.ts` checks zoomed
  pointer drag plus stored geometry, keyboard movements invalidating
  obsolete export anchors, and narrow viewport reload.
- Existing text layout, font-ready, export-canvas and editor draft tests
  are unchanged and should all be re-run.

## Local-only validation checklist

Do not trigger GitHub Actions; commit uses `[skip ci]`. Run locally:

```sh
npm ci
npm run typecheck
npm run lint
npm run test:unit
npx playwright test tests/e2e/preview-export-position-parity.spec.ts
npx playwright test tests/e2e/editor-smoke.spec.ts
npx playwright test tests/e2e/editor-draft-safety.spec.ts
npm run build
```

Manual desktop Chromium and iPhone Safari:

1. Zoom preview to 50%, 100%, 150%, 200%. Drag poem, custom text, logo,
   stamp and signature to each border; check no jump or premature clamp.
2. Repeat at canvas sizes 1080×1350, portrait and landscape. Hold Shift
   with arrow keys for fast nudge; test Alt+Left/Right resize and both drag
   handles for poem/custom text.
3. After dragging poem/custom text, nudge by keyboard, export PNG and inspect
   that the image reflects the **new** position, not the pre-nudge position.
4. Add one vertical Chinese text, a handwritten signature, a transparent
   background and an inset border; compare preview versus exported image.
5. Switch to an uncached locally bundled handwriting font and to a Google
   font. Confirm text reflows once the face loads; image export renders
   the same chosen face. Check offline fallback without crashes.
6. Refresh drafts, Undo/Redo repositioned layers, navigate away and back.
   Verify the Phase 1 asset lease and Phase 3 document snapshots still work.
7. Test mobile touch drag, double-tap/resize interactions, and the first
   pinch zoom. Distinguish DOM/UI simulation from *real Safari* testing.
8. Compare screenshots at matching canvas size; note unavoidable
   browser-specific font rasterization rather than claiming pixel equality.

### Deferred

Do not centralize DOM pointer event subscriptions, redesign the editor's
active-selection state, change zoom UX or force a full Canvas preview
rewrite. These are separate potential work items, only if tests indicate a
real benefit.

### Validation status at PR creation

The GitHub connector verified the merged baseline and inspected the
source. New tests have been authored and static edits checked; this
environment cannot clone the project for `npm` and Playwright execution.
Mark the PR Draft until these local tests pass and review findings are fixed.
