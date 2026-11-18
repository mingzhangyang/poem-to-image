# Poem font weight and independent layout evaluation

## Implemented: poem font weight

- Typography: global font weight selector **Regular (400)**, **Medium (500)**, **Bold (700)**.
- Poem Editor > Layer Styles: title, body, author, and source each offer **Use global weight** or an independent 400/500/700 override.
- The same effective weight participates in Canvas text measurement (including wrapping), HTML/SVG live preview, and Canvas export. Used faces are awaited before export and when preview metrics are refreshed.
- Stored in canonical editor snapshots, undo/redo and draft persistence; reusable custom templates retain the weight values. Old drafts, bundled templates and absent override fields resolve to normal 400 and inherit, respectively.
- Some single-weight handwriting and historic fonts only have a regular face; browsers may synthesize heavier weights. This control cannot guarantee a real 500/700 face for such families.

## Proposal: optional independent title/body/author/source containers

Today, the structured poem layout already measures title, author, body, and source as separate **semantic sections**, but they live inside one draggable poem box. Existing automatic composition is useful: it preserves poetic hierarchy, vertical right-to-left orientation and title/author proximity, while adapting to changing text and font metrics.

Switching every poem to free-floating boxes by default would change existing templates and can introduce collisions, clipping, awkward attribution and inconsistent preview/export alignment.

Recommended next batch:

1. Keep **Auto layout** as the default for all new and existing artwork, preserving today's group drag, responsive positions, and section-gap controls.
2. Add a deliberate **Detach / Position independently** action for each semantic section. Only detached sections become draggable/resizable text boxes; the other sections stay in the auto layout.
3. Initialize a detached layer from the current computed *visual* box once, relative to the same inner canvas positioning frame used by export. Do not resample or overwrite the saved detached anchor whenever fonts finish loading or text reflows.
4. Provide a keyboard-arrow nudge, visible selection/handles, boundary and overlap hints, and **Return to automatic layout**. Ensure touch dragging does not conflict with pinch/zoom on mobile.
5. Persist optional independent placements in the canonical editor document and templates, with old drafts requiring no migration. Shared geometry must drive both the browser preview and Canvas export.
6. Regression: multiline titles; empty title/author/source; long wrapped poems; vertical titles and attribution; line-height and weight changes; mobile; selection/z-order; undo/redo; template switching; draft reload; 1×/2×/3× exports.

Do **not** implement the container refactor in the font-weight patch: the interaction and persistence model is a separately reviewable change.

## Local verification (without manually starting CI)

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run build`
- `npx playwright test tests/e2e/editor-smoke.spec.ts tests/e2e/vertical-author-placement.spec.ts` (substitute actual existing file path when running)

Manual: change global weight and each layer override in horizontal and vertical layouts; preview and PNG/JPEG/WebP exports must agree. Confirm legacy drafts and templates still render at their former normal weight.
