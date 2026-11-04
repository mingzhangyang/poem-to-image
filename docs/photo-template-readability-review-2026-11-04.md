# Photo template readability: phase-one source audit (2026-11-04)

This is a **source-based audit**, not a completed desktop/mobile visual test.

| Preset | Brightness | Text ink | Existing shadow |
|---|---:|---|---|
| Mountain Mist | 87% | dark #172117 | light #f8fafc, blur 10 |
| Ocean Dawn | 90% | dark #082f49 | white #ffffff, blur 8 |
| City Night | 86% | light #e2e8f0 | warm #f59e0b, blur 12 |
| Ink Pine Mist | 78% | light #f8fafc | dark #111827, blur 10 |

These safeguards are already present in src/templates/definitions.ts. The background
controls allow brightness/blur changes even after applying built-in image templates.
Preview (src/components/preview/BackgroundLayer.tsx) and Canvas export
(src/export/background.ts) both use a uniform 10% dark image overlay.
The Canvas exporter also uses the configured text shadows.

No blanket bottom-gradient overlay is introduced in this stage: poems can be
vertical and center-aligned; light gradients could obscure dark poem ink.

## Manual visual verification still required

- Apply all four photo presets to a short poem, 16–24 Chinese lines in vertical
  layout, and 20–30 English lines in horizontal layout; distinguish overlap,
  clipping, and low contrast.
- Review desktop and narrow mobile compositions, both light and dark areas of
  the photos, and the exported PNG/JPEG beside the editor preview.
- If text becomes unreadable, tune the affected preset's existing brightness,
  ink and shadow first. Consider a text-localized scrim only after testing
  that rendering remains consistent in CSS and Canvas.

A structural regression test protects the existing photo-template safeguards,
but does not claim that pixel-level visual quality has been measured.
