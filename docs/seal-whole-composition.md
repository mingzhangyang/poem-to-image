# Batch 2 - Optical whole-seal composition

Scope: poem-to-image now offers an opt-in, whole-impression, measured-glyph
layout engine for text seals. It reuses the existing Canvas impression
layer and does not include per-character editing or locking.

## Data and compatibility

StampConfig.compositionMode is optional. Missing or legacy values retain
the already-shipped fixed-cell layout. Existing saved drafts and templates
are not migrated. New traditional text seals and newly selected traditional
gallery presets opt into whole with 70% compactness; modern calligraphy
and graphic seals are unaffected. All fields use the existing undo, history
and persistence path. Changing a selected name-seal text away from exactly
three characters exits the name layout atomically.

## User-facing controls

- Classic: original fixed cells, preserved for comparison and old drafts.
- Whole-seal: measures every glyph using Canvas text metrics, picks the
  highest-ranked right-to-left column partition, and proposes distinct
  alternatives A/B/C where at least three candidates exist.
- Three-character name: explicitly select right-one, left-two for a seal
  whose first character is the surname. Never infer name intent.
- Compactness 0-100: tunes gaps and painted-ink fill without selecting
  another partition. Existing text size/stroke controls continue working.

## Measured geometry

For one to eight graphemes, the solver measures ink bounds once per
stamp composition, uses the same baseline and font as the Canvas painter,
and searches at most eight candidate partitions with 28 bisection steps
each. A bounded optical normalization balances differently sized glyphs,
but the scaling within each glyph remains uniform in X and Y.
Placed ink rectangles include stroke thickness and are tested against the
actual inset face: square, rounded brush, circle, oval or rectangle.
Composition is deterministic and independent of viewport and export DPR.

The live preview and 1x/2x/3x exports both call drawStampImpression.
The preview repaint key includes mode, candidate and compactness.
Baiwen carving and natural ink textures are unchanged.

Limits: measured Canvas ink rectangles are a conservative substitute for
outlines, not exact glyph-path intersection or authentic carving research.
Glyph-by-glyph editing/locking and exact-outline avoidance are later work.

## Local-only verification

Run npm ci, npm run typecheck, npm run lint and npm run test:unit.
For a full build, first sync licensed fonts with npm run fonts:sync and
then run npm run build. No CI or deployment is requested by this batch.
Browser checks: all six shapes, one to eight glyphs, A/B/C alternatives,
manual name layout, round/oval clipping, stroke slider, both朱白 modes,
1x/2x/3x parity, old saved drafts and mobile pinch gestures.
