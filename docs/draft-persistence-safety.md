# Draft Persistence & Asset Safety — Phase 1

## Scope

This change protects the single anonymous editor draft. It does **not** alter
share-publication credentials, the My Shares IndexedDB database, Cloudflare
Worker APIs, user-defined template cloud sync, editor undo semantics, or image
rendering. Those have separate owners and tests.

## Storage contract

- **Authoritative:** IndexedDB `inkpoem-editor-drafts`, schema version 1.
  The `documents/current` record has `version: 2`, an increasing `revision`,
  and the complete serialized `scene`. `assets` stores binary image Blobs.
  Asset IDs are `draft-asset:<id>`, never ephemeral `blob:` URLs.
- **Atomic:** Each revision is one IndexedDB read/write transaction covering
  both stores. The record's revision must match the caller's expected revision,
  or the save aborts without touching either the document or resources.
- **Image restoration:** Background and Logo `blob:` or `data:` URLs are
  converted to binary assets before the transaction. On load, the asset
  references become live object URLs; these are released on unmount. Remote
  template URLs remain unchanged. Removed assets are pruned only in the same
  successful transaction as the new scene.
- **Legacy compatibility:** The old `inkpoem.editor-state.v1` JSON is read only
  when there is no IndexedDB document. Metadata-only documents still write
  a size-bounded legacy mirror as an optional fallback for older versions.
  Data URLs and blob URLs are **not** silently stripped from the authoritative
  draft or written as broken legacy pointers.
- **Short navigation window:** `inkpoem.editor-pending.v2` stores a synchronous
  metadata-only checkpoint tagged with its base revision when leaving during
  the 600 ms debounce. On load it is applied only if that base still matches
  the committed revision, then promoted on the next auto-save. Blob-backed
  edits cannot be checkpointed synchronously; the unsaved-changes leave-page
  warning protects that window instead.
- **Recovery:** IndexedDB unavailable, malformed documents, or missing binary
  assets **block editor initialization** and offer Retry. They never cause
  an empty editor to auto-save over unread drafts. Once mounted, failed writes
  display a persistent retry action; competing tab revisions display a
  non-overwriting conflict warning.

## Limits and known constraints

- IndexedDB durability ultimately depends on the browser and storage quota.
  Browser profile deletion, private browsing eviction, or forced termination
  may remove data. Export an image or back up projects before clearing storage.
- Very large images may hit browser storage quota; save failures are visible,
  not silently discarded.
- In-progress image saves cannot be guaranteed to complete during tab
  termination. The `beforeunload` warning is intentional in this case.
- The single metadata-only emergency checkpoint is not a multi-device sync
  mechanism. Interleaved edits from different tabs are not auto-merged.
  A revision conflict must be resolved by the user without overwriting data.
- This phase preserves the existing single-draft behavior. It is **not**
  multi-document or per-account persistence.

## Local-only validation (do not start CI)

Run against the newest main before opening/merging:

```sh
npm ci
npm run typecheck
npm run lint
npm run test:unit
npx playwright test tests/e2e/editor-draft-safety.spec.ts
npx playwright test tests/e2e/editor-smoke.spec.ts
npm run build
```

Then manually check in desktop Chromium and iPhone Safari:

1. Create a poem with an uploaded background and a Logo; wait for the save.
   Refresh; both images, poem text, and layout must return unchanged.
2. Change to a built-in image template; refresh; its original URL, crop, and
   source attribution must still be correct.
3. Edit text and immediately refresh. A small metadata-only checkpoint should
   recover the change; a binary asset write may require confirming the leave
   warning and waiting for save.
4. Block IndexedDB before load. Confirm recovery UI appears and no default
   document gets written.
5. Block writes after editing. Confirm Retry is visible, then restore access
   and retry; the saved image and poem should remain current.
6. Open two tabs on an existing document. Write in the first, then edit the
   stale second tab. Confirm conflict is displayed and the first save is intact.
7. Test restoration of a legacy draft containing a template background, plus
   a corrupt stored record and a missing asset; never overwrite either.

**No deployed storage migrations:** This is a new browser-side IndexedDB.
It does not change D1 migrations, R2 buckets, share links, or the Worker.
