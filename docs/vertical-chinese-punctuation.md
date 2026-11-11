# Vertical Chinese punctuation in InkPoem

Only the rendered glyph changes; the poem's Unicode source, drafts, templates,
font sizes, spacing, rotation and Undo/Redo data are not migrated.

## Root cause
`splitVerticalLineSegments` treated every CJK punctuation character like a
regular upright Han glyph. HTML spans and Canvas painted the horizontal font
form in a character cell without any ink placement model. The even-length
column splitter could start a column with closing punctuation or end it with
an opening bracket.

## Rules
- A Chinese punctuation mark has its **own full logical cell**. Its metrics
  determine the real ink bounds. Mainland-style pause/stop marks (，。、；：！？)
  align their ink toward the upper-right of that cell, leaving room for
  different font bounding boxes and line-height/letter-spacing changes.
- Brackets and book-title/quote marks prefer Unicode vertical presentation
  forms (FE3x/FE4x, FE17/18). If coverage metrics resemble a missing glyph,
  rotate the original glyph once. Latin/numeric runs retain their sideways
  handling. Avoid double rotation.
- Automatic column boundaries cannot precede a pause/closing mark or follow
  an opening mark. When there are too few safe boundaries, use fewer columns
  rather than invent blank columns or delete text. **Manual newlines remain
  authoritative** even if the user intentionally starts a line with punctuation.
- The first logical column is the rightmost. Neither hanging punctuation nor
  text clipping is introduced. Full-cell advances are retained in layout
  width/height, so author attribution alignment from PR #25 remains based on
  the same body boundary.

## One layout, two painters
`src/textLayout.ts` computes actual glyph text, rotation, ink-origin offsets
and cell coordinates once. Preview draws these as SVG text using alphabetic
baseline; Canvas uses the same origins and rotations with `fillText`. Font
measurement temporarily normalizes Canvas alignment/baseline to avoid
state-dependent ink metrics. Horizontal text retains its existing span path.

## References and limitations
- W3C CLREQ: https://www.w3.org/TR/clreq/ (punctuation positioning and
  line-start/line-end prohibitions)
- Unicode vertical forms: https://www.unicode.org/Public/UCD/latest/charts/nameslist/fe10/
- Glyph coverage cannot be determined exactly from Canvas TextMetrics; the
  missing-glyph comparison is conservative. Some fonts may require visual
  inspection and the original rotated bracket is the safe fallback.
- The Playwright test captures a screenshot artifact; visual comparison and
  real iPhone Safari / exported pixel verification are **manual** until run
  in an environment with Node 24, dependencies and browser binaries.

Local verification (no CI): `npm ci`, `npm run cf:typegen`,
`npm run typecheck`, `npm run lint`, `npm run test:unit`,
`npm run build`, `npm run verify:build`,
`npm run test:e2e -- tests/e2e/vertical-punctuation.spec.ts tests/e2e/vertical-author-placement.spec.ts`.
