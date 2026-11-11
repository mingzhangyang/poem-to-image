# Poem typography: one base size, four independent layer sizes

InkPoem has two intentionally different font-size controls:

| Location | Label | Stored value | Affects |
| --- | --- | --- | --- |
| Typography panel | Base Font Size (px) | `typography.fontSize` | The shared baseline for the title, body, author and source |
| Poem Editor: Layer Styles | Relative Font Size (%) | `poemStyle.titleScale / bodyScale / authorScale / sourceScale` | Only the selected poem section |

The relative controls do **not** overwrite the global baseline or each other.
Custom text items and signatures already have their own independent font sizes,
and are not scaled by this poem-specific baseline.

## Effective font sizes

Both the browser preview and exported Canvas call the same
`createStructuredPoemLayout` function. It computes each section in logical
pixels, with no separate DOM/export sizing rules.

- Body = round(base size × `bodyScale`).
- Title = round(base size × 1.18 (horizontal) / 1.12 (vertical) × `titleScale`).
- Author = round(base size × 0.72 (horizontal) / 0.74 (vertical) × `authorScale`).
- Source = round(base size × 0.68 (horizontal) / 0.70 (vertical) × `sourceScale`).
- All section font sizes retain the existing 12 px minimum.

The pre-existing title / author / source multipliers and line gaps are unchanged.
The Poem Editor uses a common 70–160% range for all four sections. At 100%,
a layer retains its historical default relationship with the base font size.

## Persistence and compatibility

`bodyScale` is an additive optional-on-disk field. Existing drafts, custom
templates and undo/redo snapshots without it resolve to 100% when mounted or
applied. Old drafts still validate; a present non-finite value is rejected.
Changing only the body size does not rewrite the other three relative values.
Templates, the canonical editor document, export, history and draft persistence
share the same `PoemLayerStyle`.

## Manual regression checklist (local only; no Actions)

1. Change the **Base Font Size** and confirm title, body, author and source all
   grow or shrink while their relative controls stay unchanged.
2. In Poem Editor, change only **Body → Relative Font Size**: title, author and
   source retain their sizes. Check all 70/100/160% endpoints.
3. Repeat for horizontal and vertical Chinese, English and long wrapped text;
   inspect letter spacing, line height, section gaps, and circular clipping.
4. Apply built-in / custom templates, switch interface language, Undo/Redo,
   refresh the editor, and restore a pre-change IndexedDB draft.
5. Compare on-screen layout and PNG/JPEG/WebP exports at 1×/2×/3×. Verify
   independent custom-text and signature sizing.
6. Repeat on the mobile Styles tab and real iPhone Safari.

Recommended local commands: `npm ci`, `npm run typecheck`, `npm run lint`,
`npm run test:unit`, `npm run build`, and `npm run test:e2e`.
None should manually dispatch GitHub Actions.
