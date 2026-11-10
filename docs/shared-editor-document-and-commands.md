# Phase 3 — Shared Editor Snapshot & Commands

## Baseline and scope

This batch follows the merged PRs #16 (draft/asset safety) and #17
(template/async ownership). It consolidates the *editor document boundary*
only. Existing React state hooks, IndexedDB save transactions, undo/redo stack
limits, templates, gallery UI, image generation/billing, Canvas renderer, and
sharing protocol remain in place.

The central rule is **one canonical EditorDocument**, projected for its
consumers rather than reconstructed separately in each hook.

```
React editing hooks
       │
       ▼
createEditorDocument(...)  ───> EditorDocument (includes preset identity)
       │                           │
       │                           ├──> useEditorHistory (undo / redo)
       │                           ├──> useEditorPersistence (IndexedDB draft)
       │                           ├──> createReusableTemplateParts
       │                           └──> createEditorExportScene
       │                                      │
       ▼                                      ▼
useEditorCommands                       useImageExporter
       │
       ├── restore (undo / redo)
       ├── template (built-in / custom / language-dependent partial update)
       └── canvas-preset (built-in / legacy dimensions / custom)
```

## Invariants preserved

1. The persisted document keeps poem, style, width, height, **preset ID**,
   background, typography, custom text, logos, stamps and signatures.
   Transient AI mode is stored as image (same as Phase 1) while the export
   can still display the live AI background type.
2. Unsupported language stamps are hidden only in the **export projection**,
   not erased from saved artwork or undo history. Restoring later language
   support can still show the stamp.
3. Reusable template creation retains font, poetry styling, signatures and
   decorations but excludes uploaded backgrounds and logo images, as before.
4. Multi-field template application and undo restoration use one synchronous
   command adapter. React batches its existing setter calls. This is **not**
   a rewrite to a single reducer and does not change image/AI request
   ownership or generate any new server calls.
5. Canvas preset commands retain old ratio values such as `1080x1350`.
6. The history debounce remains 800ms to preserve grouping of rapid edits.
   **Immediate Undo** flushes a pending snapshot first. The button reflects
   pending work; an uncommitted new edit also disables Redo. This prevents a
   fast Ctrl/Cmd-Z or click on Undo from appearing to do nothing.
7. The history asset lease retains current and historical image URLs while
   an undo/redo or detached save can still reference them. The Phase 1
   IndexedDB persistence hook is unchanged below its snapshot input.

## Risk controls / deferred work

- No change to on-disk `version: 2` format or the `assets` store.
- No changes to AI billing, custom-template cloud API or authentication.
- Template selection UI remains independently tracked, as before; the
  **artwork** is undoable atomically, while template selection indicators
  may still require a later UI consistency pass.
- Existing per-property hooks still own their states and setters. The command
  adapter is an intermediate migration seam, not a fully transaction-aware
  command journal or reducer.
- Drag geometry and preview/export pixel parity belong to Phase 4, not here.

## Local-only verification (never dispatch CI manually)

```sh
npm ci
npm run typecheck
npm run lint
npm run test:unit
npx playwright test tests/e2e/shared-editor-commands.spec.ts
npx playwright test tests/e2e/editor-smoke.spec.ts
npx playwright test tests/e2e/editor-draft-safety.spec.ts
npx playwright test tests/e2e/async-template-safety.spec.ts
npm run build
```

Manual regression:

1. Apply a built-in image template; immediately Undo, then Redo. Background,
   typography, poem text position and layers should return together.
2. Change font and backgrounds rapidly, Undo/Redo before/after 800ms;
   ensure one expected history step and correct keyboard shortcuts.
3. Select canvas presets including legacy 1080x1350, Undo/Redo and reload.
   Preset ID and dimensions must remain consistent.
4. Preserve image/Logo assets through undo/redo and reload (including hidden
   background layers); no object URL should be revoked while still referenced.
5. Edit a signature/stamp/custom text, save and reload. Preview/export should
   match the saved document, including unsupported-stamp policy.
6. Create a custom template from an uploaded/AI background and apply it.
   It should retain user style but **not** serialize the binary artwork as a
   shareable cloud template.
7. Open two tabs, edit both, and check the existing Phase 1 revision conflict
   protection still blocks stale saves.
8. Repeat on narrow/mobile views. Verify no changes in layout or controls.

The single PR is expected to carry `[skip ci]`; do not start GitHub Actions.
The remote-only environment cannot run npm/Playwright against a checkout,
so any such checks must be completed locally before merging.
