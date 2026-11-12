# InkPoem · Phase 4B — Original graphic and landscape seals

**Baseline:** confirmed PR #27 merged at 2026-11-11 23:45:58Z,
then based directly on `main@b10c638` (no open PRs/issues).
This batch extends traditional seal art and does not add the Phase 4C
categorised seal gallery, multiple stamp layers, image uploads or new fonts.

## Eight hand-authored vector engravings

The motifs are drawn in the language of carved Han pictorial seals (肖形印),
not line illustration: solid masses and bold tapered strokes, with details
carved back out of the ink. Strokes never go below 1.4 motif units, so the
designs stay legible at the 60–80px sizes seals are actually placed at.

| ID | Design | Visual motif |
| --- | --- | --- |
| dragon | Dragon | Coiled dragon around a flaming pearl; raised head with antlers and open jaw, three clawed legs |
| phoenix | Phoenix | Crested bird, raised wing with carved flight feathers, three tail plumes ending in eye-spots |
| plum | Plum blossom | Tapered gnarled branches, solid five-petal blossoms with carved hearts, buds |
| bamboo | Bamboo | Two stalks with carved nodes, broad drooping leaves in 个 clusters |
| pine | Pine | Twisted trunk on a rock, fan-shaped needle crowns with carved needles |
| landscape | Mountain and water | Sun, layered peaks with carved texture strokes, water, a lone sailing boat |
| lotus | Lotus | Cupped flower with carved petal separations, bud, veined leaf, ripples |
| clouds | Auspicious clouds | Ruyi cloud heads (paired outward scrolls) on flowing ribbons |

### Carved marks

A mark can be flagged `carve`. `drawSealMotif(ctx, id, { carved, inkColor })`
inverts it against the seal mode, so one design reads correctly both ways:

| Mark | Zhu Wen (red design) | Bai Wen (design carved from red face) |
| --- | --- | --- |
| ink | deposits ink (`source-over`) | removes ink (`destination-out`) |
| carve | removes ink (`destination-out`) | restores ink (`source-over`) |

The motif fills the face up to a narrow channel inside the rim; curved faces
(round/oval) fit the motif's round silhouette (radius 50) instead of its square.

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
4. In Zhu Wen, vector paths are red pigment on transparent paper and carved
   details erase it again. In Bai Wen, the design removes pigment from a
   solid red face and carved details restore it (see *Carved marks*).
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
