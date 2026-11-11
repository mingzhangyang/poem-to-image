# InkPoem · Phase 4B — Original graphic and landscape seals

**Baseline:** confirmed PR #27 merged at 2026-11-11 23:45:58Z,
then based directly on `main@b10c638` (no open PRs/issues).
This batch extends traditional seal art and does not add the Phase 4C
categorised seal gallery, multiple stamp layers, image uploads or new fonts.

## Eight hand-authored vector engravings

| ID | Design | Visual motif |
| --- | --- | --- |
| dragon | Dragon | S-shaped dragon, snout, horns, scales, claws, two cloud curls |
| phoenix | Phoenix | Bird head, sweeping wings, fanned tail feathers |
| plum | Plum blossom | Branches and five-petal blossoms |
| bamboo | Bamboo | Jointed stalks and carved tapered leaves |
| pine | Pine | Twisted trunk, needle branch crowns, rock base |
| landscape | Mountain and water | Peaks, solitary pine, water ripples, quiet horizon |
| lotus | Lotus | Symmetric pointed petals, stem, water ripples |
| clouds | Auspicious clouds | Scroll curls and layered cloud bands |

These paths are original hand-authored Canvas instructions kept in
`src/sealMotifs.ts`. No externally hosted SVGs, fonts, stock illustrations,
AI-generated pictures or unlicensed image resources are required.

## Data model and compatibility

- `StampConfig.motifId?: SealMotifId` is an *optional* field.
- Missing or `undefined` motif ID means the exact pre-4B text renderer.
- Switching motifs keeps stored `stamp.text`, font family, position, size,
  rotation, opacity, weathering, texture seed and other art settings intact.
- The "text seal" control clears `motifId` without deleting saved text.
- Applying the existing four **text** presets clears `motifId` by design.
- Unknown IDs are safely rejected when hydrating a draft; the Canvas renderer
  independently falls back to text drawing if passed an unknown ID.
- No IndexedDB schema, Worker API, shared-artwork protocol, or migration change.

## Compositing

`drawStampImpression` remains the sole preview/export compositor.

1. It creates an isolated ink-only bitmap.
2. `drawStampBody` dispatches *only* for a valid `motifId`, otherwise uses
   unchanged lettering and historical impression paths.
3. The motif frame uses the stamp's actual square/circle/rectangular/oval path.
4. In Zhu Wen, vector paths are red pigment on transparent paper.
   In Bai Wen, they remove deposited pigment from a solid red face.
5. Font size/stroke controls are irrelevant in motif mode and are hidden.
   Motif output never requests a seal font before preview/export.
6. Natural or classic weathering is applied **after** the vector ink body,
   using the existing seeded engine; no background is baked or sampled.
7. The existing shared preview/export renderer handles 1×/2×/3×, DPR,
   2048px caps, opacity, paper textures and other decorations.

Only a simple nine-option content picker is added in Phase 4B. The full
categorized visual seal gallery is reserved for Phase 4C.

## Required local tests (not GitHub CI)

When a complete Node 24 checkout and browser are available:

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

Inspect in desktop Chromium and real iPhone Safari:

1. All eight motifs, multiple palettes, square/circle/brush and 4A's
   vertical rectangle, horizontal rectangle and oval.
2. Zhu Wen, Bai Wen, natural/classic weathering (0/25/50/75/100), fresh
   texture seeds, background paper/photo/transparent surfaces.
3. At 1×, 2×, 3× output, ensure crisp outlines, consistent clipping,
   no opacity bleeding or unintended font loading. Pixel snapshots should
   be deterministic for identical settings.
4. Change text, select a graphic, switch modes and shapes, save/reload,
   Undo/Redo, then switch to text. The previous text should reappear.
5. Saved legacy artwork without `motifId` should stay unchanged, including
   its original stamp text, layout, weathering and high-DPI exports.
6. Draft imports with an invalid motif ID should fail validation clearly;
   corrupt external input must not create missing-image or broken-font output.
7. All 8 UI locales and mobile touch target selection.

**Verification limit:** GitHub connector access supports code review and
committing, not repository cloning or running Node/build/real-browser tests.
Authored unit/E2E coverage must not be mistaken for executed tests. Do not
claim iPhone Safari verification. This PR uses one `[skip ci]` commit and
does not dispatch GitHub Actions.
