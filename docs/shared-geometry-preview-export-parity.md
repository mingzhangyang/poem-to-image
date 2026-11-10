# Phase 4 — Shared Geometry & Preview/Export Parity

## Baseline and scope

Built only after PRs #16 (draft/asset safety), #17 (template/AI async
ownership), and #18 (shared document + commands) were merged into main.

Goal: **one source of truth for placement mathematics** across the DOM preview,
accessible keyboard interactions, and Canvas export, with no intentional visual
or product-feature changes.

This is **not** a new renderer. `textLayout.ts`, `poemContent.ts`, border
utilities, `signatureRendering.ts` and the existing Canvas exporter already
share most underlying geometry and should remain the foundation.

## What is unified

`src/positioningRect.ts` now owns small pure operations for:

- Interior positioning rectangle under transformed/zoomed DOM frames. Border
  widths are converted from layout CSS pixels to the same visual-coordinate
  space as `getBoundingClientRect()` before subtraction.
- Element-size-aware drag bounds, percentage-based pointer delta, keyboard
  nudge (1% normal / 3% Shift) and strict edge clamping.
- Read-back of measured DOM center/top-left after dragging or resizing.
- Horizontal resize and Alt+arrow width adjustment for poem and custom text.
- Canvas center pixel translation and top-left origin, including persisted
  `exportLeft`/`exportTop` when the preview measured them.

Five overlay types now use the same movement and keyboard math: **poem body,
custom text, Logo, signature, stamp**. The poem/custom-text pair additionally
share the resize math. Canvas export uses the same positioning functions for
poem, custom text, Logo, signature and stamp.

**Important parity fix:** Dragging a poem stores a measured `exportLeft` and
`exportTop` so Canvas can align the text precisely. After a later keyboard
move, keyboard resize, or position/width change from another UI control,
those measured anchors are no longer valid and must be cleared. Without that,
the preview moves but Canvas exports the poem at the older location.
`mergePositionUpdate` applies this invariant at the shared decoration
state boundary, retaining newly measured anchors when supplied together
with a new position. The keyboard handlers also clear their transient copy.
Existing stored documents are not migrated; their anchors remain respected
until the next user adjustment.

## Font timing

Preview and export already share `createStructuredPoemLayout` and
`createTextLayout`. The preview previously computed the layout in fallback
font metrics, while Canvas export waited for the selected actual glyphs.

`useFontLayoutRevision` requests the selected font face and actual text glyphs
using the existing `ensureFontReady` helper. Once loading resolves it bumps a
local measurement revision so **poem and custom-text layout** is recomputed
using loaded-font metrics. The stamp canvas repaints after its face and glyphs
are ready. Signature font readiness is already handled by its own loader and
preview repaint logic; no duplicate loader is added.

A failed/offline font load leaves a legible fallback preview. No new font
bundles, font sizes or design system changes are introduced.

## Parity limits and regression risk

- React DOM and Canvas can differ at subpixel antialiasing. This PR targets
  **geometry and font readiness**, not cross-browser pixel-identical raster
  outputs. No pixel-perfect result is asserted without browser visual QA.
- CSS zoom is accounted for in drag rectangles, but non-uniform arbitrary
  element rotation is not a newly supported drag coordinate system.
- Existing `exportLeft`/`exportTop` in previous drafts remain compatible.
- Pointer cancellation follows the current overlay behavior; a future phase
  could centralize event-listener management as a separate behavior change.
- This PR does not modify scene state, undo/revision safety, cloud sync, D1,
  share publishing, app navigation, or image export format.
- Existing Playwright configuration runs Chromium desktop and mobile.
  iPhone Safari requires independent manual validation unless WebKit project
  support is separately configured.

## Local-only verification

Do not start GitHub Actions, and do not stack PRs. Use the single
`[skip ci]` commit on top of the merged latest main.

```sh
npm ci
npm run typecheck
npm run lint
npm run test:unit
npx playwright test tests/e2e/preview-geometry.spec.ts
npx playwright test tests/e2e/editor-smoke.spec.ts
npx playwright test tests/e2e/editor-draft-safety.spec.ts
npx playwright test tests/e2e/shared-editor-commands.spec.ts
npx playwright test tests/e2e/background-presets.spec.ts
npm run build
```

Manual acceptance (desktop Chrome + iPhone Safari):

1. At fit, 50%, 100%, 150%, and 200% preview zoom, drag poem and Logo.
   The percentage position should respond proportionally to drag distance,
   with neither jumps nor excessive clamping. Repeat with a 6px inset border.
2. Select poem, custom text, Logo, signature and stamp; use arrow keys and
   Shift+arrows. Verify standard nudge 1% and accelerated nudge 3%, matching
   clamping at all canvas edges.
3. Drag the poem, then nudge it via keyboard. Export: the text must appear at
   the new position, not at its earlier `exportLeft` coordinate.
4. Resize poem and custom-text boxes from either edge and with Alt+arrows.
   Check that preview bounding boxes and exported wrapping remain equivalent.
5. Apply all important writing modes (horizontal, vertical-rl), decorative
   borders, text shadows, signatures, stamps, multi-column poem, and
   multi-line custom text. Compare preview geometry and exported PNG at
   1x/2x/3x, allowing only expected antialias differences.
6. Simulate delayed font loading in DevTools, select a new CJK family,
   then wait for its glyphs to load. Preview text wrapping and positions must
   settle to match export; quickly changing fonts must not let an obsolete
   load repaint the latest composition.
7. Save/reload and Undo/Redo after drag/resize. Verify positioned assets and
   the same normalized coordinates are preserved; ensure no drafts are lost.
8. Test pointer-cancel, touch drag, and viewport resizing on iPhone Safari.

Unit tests: `tests/frontend/positioning-geometry.test.ts`.
Browser regression: `tests/e2e/preview-geometry.spec.ts`.

**Verification status when drafted:** Reviewed and edited through GitHub
connector. The local container cannot resolve github.com, so tests and build
cannot be executed from the available environment; mark this PR Draft until
the above checks pass locally.
