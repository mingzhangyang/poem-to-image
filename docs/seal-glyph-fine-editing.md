# Phase 3 — per-glyph fine editing, bounds and locking

This batch extends the **existing** `WholeSealComposition` engine from PR #35.
There is no new Canvas, SVG overlay, freehand drawing surface or second
preview/export pipeline. Its scope is limited to **traditional text seals**
whose `compositionMode` is `whole` or `name`. Other stamp modes, motifs,
historical fixed-cell layouts and all poem-body typography are unaffected.

## UI and semantics

The Decorations panel adds a collapsible "per-character refinement" section.
Users select one of the 1–8 user-perceived characters (grapheme boundaries,
never UTF-16 offsets). Each character has four controls:

| Parameter | Range | Meaning |
| --- | --- | --- |
| Horizontal offset | -20% … +20% | % of complete ink-face width |
| Vertical offset | -20% … +20% | % of complete ink-face height |
| Glyph width | 70% … 130% | manual scale relative to automatic fit |
| Glyph height | 70% … 130% | manual scale relative to automatic fit |

The lock button stores a **parameter lock** for that character. Locked
parameters cannot be changed by the per-glyph sliders or reset controls
until the user explicitly unlocks them. They remain attached to the
selected character *index and Unicode text*, but are **relative** to
the whole-seal solution: changing A/B/C, compactness, font, face shape
or overall glyph size may still reflow the locked character. We do not
promise absolute position locking across global composition changes.

Reset current returns an unlocked glyph to its automatic fit. Reset
unlocked keeps all locked edits. On text editing, the editor preserves
only the common-prefix edits and drops adjusted character instances
after the first changed grapheme; it never transfers a lock between
two occurrences of the same Chinese character.

## Geometry and rendering

`src/sealGlyphEditing.ts` owns pure, immutable command-style operations
and strict validation. The new optional `StampConfig.glyphEdits` array
is absent from existing saved works. The engine first computes the
**original whole-seal layout**, including candidate ranking, then applies
each edited glyph on top. Locked edits have first collision priority.

Each requested adjustment is checked against the same conservative
round/square/brush/oval/rect-vertical/rect-horizontal boundaries used
by the whole-seal engine. Both axes reserve stroke-inclusive measured
ink boxes. If a move or stretch would collide with another character
or cross the frame, a bounded bisection interpolates toward the
unchanged automatic fit. No requested edit causes text overlap or ink
clipping according to the measured bounding-box model.

The shared Canvas painter handles opt-in anisotropic glyph scales,
with corresponding stroke-width compensation. Live stamp repaint keys
include `glyphEdits`; export already calls the same
`drawStampImpression` function. Absence/empty array causes no extra
scale changes and retains old 1×/2×/3× command streams.

## Persistence, undo, templates and safety

The existing document snapshot stores optional edits and thus
participates in undo/redo, IndexedDB and export. Draft hydration
validates bounds, data types and unique indices and rejects malformed
stored arrays. Template language switching does not overwrite manual
glyph edits; text changes reconcile prior edits atomically.

No font files, binary assets, runtime dependencies, server/API changes
or CI workflows are introduced. There is no external clipboard work.

## Local verification

The repository should be tested on an environment with GitHub and
dependencies available (this execution environment cannot resolve
github.com for cloning):

```sh
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run fonts:sync
npm run build
```

Additional manual acceptance: 1–8 glyphs across six face shapes,
CNS/clerical/jinwen/fallback faces, Zhu/Bai modes, 4% stroke, font
loading and missing-glyph export protection, three-character surname
configuration, locked and unlocked adjustments, duplicate characters,
Chinese IME text updates, restoring a draft, changing the UI language,
A/B/C and tightness reflow, iPhone Safari pointer interactions, and
preview versus 1×/2×/3× export.

**Limits:** The engine still uses Canvas measured ink rectangles,
not exact font vector outlines. Per-glyph edits are numeric, not
direct drag handles; pointer-based editing and true-outline collision
may be separate future improvements. A parameter lock does not freeze
absolute position under changed whole-seal settings.
