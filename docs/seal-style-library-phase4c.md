# InkPoem · Phase 4C — Chinese Seal Style Library

Baseline: PR #28 was merged on November 11, 2026 (US Eastern); latest `main@0a21017` was checked before the batch. Phase 4A introduced independent stamp geometries and 1–8 glyph layouts, and Phase 4B introduced eight hand-authored vector motifs. This batch curates those existing capabilities, not a new rendering stack.

## What this batch adds

- A **real Canvas-previewed Chinese seal style library** with 10 choices covering eight usages: name (two Zhu/Bai variants), literati, studio, auspicious phrase, collector, graphic, landscape, blessing and modern calligraphy.
- Selectable **All / Text / Graphic** filters; a selected card reflects actual persisted artistic settings. After manual changes to ink, fonts or shape ratio, mismatching cards no longer claim to be selected.
- The 10-card view **folds after choosing a style**, bringing text/shape/ink editing back into view. A compact header reopens it and shows the current matched style; the explicit sample-text action remains available even when folded. The detailed eight-motif picker stays accessible below the essential text/shape controls.
- Design thumbnails use **the exact shared `drawStampImpression` compositor**: small preview artwork, no separate approximation/image pipeline. They never request extra fonts or graphic assets. A font-ready event can refresh a thumbnail if the editor itself loaded that face.
- The existing eight-motif picker and legacy four preset labels remain available for backwards compatibility and accessibility; the four presets now appear as cards in the curated library instead of a separate redundant button grid.
- Optional **Use sample text**: each text-design card may show a *preview-only* traditional phrase. Selecting a design never overwrites the user's own text; only explicitly pressing the button applies the sample.
- **Fine-tune** expands/collapses font, glyph sizing/stroke, rotation and opacity, while the main size, mode, shape, ink color and impression controls remain accessible. Default expanded preserves existing editor workflows and tests.
- All eight supported UI locales have newly translated design names, filter controls, sample action and advanced settings.

## Style definitions (not new persistable categories)

| Category | Style IDs | Underlying feature |
| --- | --- | --- |
| Name | `name-vermilion`, `name-white` | Traditional square Zhu Wen/Bai Wen |
| Literati | `literati` | Brush-shaped vermilion |
| Studio | `studio` | Vertical rectangle, single-column lettering |
| Auspicious | `auspicious` | Oval with white carving |
| Collector | `collector` | Wide rectangle with white carving |
| Graphic | `graphic` | Round dragon motif |
| Landscape | `landscape` | Square mountain/water motif |
| Blessing | `blessing` | Brush-shaped white carving |
| Modern | `modern` | Round modern calligraphy |

The gallery is intentionally a **view of `StampConfig`**, not another mutable layer. No `designId` is saved: selection is always derived from the persisted style fields, so manual edits, Undo/Redo, reloads and shared exports have one source of truth.

## Compatibility and safety

- Gallery activation may set visual defaults (shape, ratio, color, font, mode, texture, rotation), but must *never* change existing `stamp.text`, positionX/Y, size, opacity or textureSeed. Applying an example is a distinct user action.
- Existing `StampConfig`, drafts, templates, export APIs, font assets, natural impressions and saved artwork data are unchanged. No D1, Worker, IndexedDB schema or migration change.
- Phase 4B motifs remain directly selectable and retain their original text/font behind the motif. Existing language-switch template and cold-restored motif font safety tests remain relevant.
- The gallery never triggers `ensureFontLoaded`/`ensureFontReady` itself, especially for a cold-restored graphic-only seal. Letter samples use available Canvas font fallback if a seal face is not installed.
- All gallery previews are Canvas miniatures of the same source vector/ink rules, not extracted screenshots or external photos.

## Required local acceptance (Node 24; do not start GitHub CI)

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

Visual review on desktop Chromium and iPhone Safari:
1. The 10 cards and filter totals 10/8/2; verify each miniature is visibly inked. No layout overflow or blocked controls at small widths.
2. Apply each gallery style with existing Chinese text: check text and position never change; preview/edit/export geometry and ink remain consistent.
3. Click **Use sample text** only for a text design and ensure a distinct Undo history item restores the previous wording.
4. Adjust ink, motif, ratio or font; the selected-card indicator must clear rather than report an exact preset. Verify return to text after selecting a graphic.
5. Check expand/collapse of fine-tuning controls; basic size/mode/shape/color/texture always accessible; keyboard focus and accessible pressed states.
6. Reload with a gallery style and with a motif after changing languages; confirm no lost saved text/font or unintended template restyling.
7. Check historical text seals and Phase 4A/4B shapes/motifs with original paper, clear, photo and custom backgrounds, 1×/2×/3× exports.
8. Cold-load a saved motif and confirm no unnecessary remote seal font request (see original PR #28 safeguard and E2E).
9. Review all eight locale strings, typography fallback in thumbnails, visual quality of studio and collector examples, and accessible button hit targets.

**Verification limit:** the GitHub connector can inspect and commit repository files, but this environment cannot clone the repository with its dependencies and run TypeScript/Playwright/Safari. Authored tests are not a passing test report. The PR is Draft until those checks are executed in a complete local checkout. The single PR commit uses `[skip ci]`; no workflow is triggered intentionally.
