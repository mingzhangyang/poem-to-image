# Phase 2 — Async Workflow & Template Sync Safety

## Scope

Starting from the merged Phase 1 draft-safety work (PR #16), this batch
hardens *custom template synchronization* and *AI/background async completion*.
It intentionally does **not** modify IndexedDB drafts, rendering, share
links, server billing, schema migrations, or editor commands/history.

## Custom templates: identity-scoped sync

The original localStorage key `poem-to-image.custom-templates` mixed
anonymous templates and cloud snapshots from whichever account last logged in.

- New keys are `poem-to-image.custom-templates.v2.<encoded scope>`, where
  scopes are `guest` or `account:<Clerk userId>`. Neither the new guest
  view nor another account automatically reads a previous account's cache.
- When Clerk has not loaded, or a signed-in user identity is not ready,
  template lists remain hidden. The API must obtain a nonempty token
  **and** confirm that the initiating scope still owns the request before
  dispatching the network call or processing a response.
- The **unscoped legacy key is preserved** as a backup and never silently
  attributed to a user. In guest mode a visible, explicit import option
  allows recovery after reviewing the ownership warning. Do not automatically
  merge historical cloud data into a different authenticated account.
- Cloud GET distinguishes a successful `{ templates: [] }` from HTTP
  401/403/429/5xx, network errors, and malformed JSON. Only valid 2xx GETs
  replace a scoped cache. Failures leave the last good list intact and
  surface a warning and safe retry.
- Mutation calls are ordered per hook. Each queued write captures a unique
  account-lifetime lease (not merely a user ID), and old queued tasks cannot
  dispatch after unmount or an A → B → A switch.
- A pending write invalidates older GET snapshots; each confirmed write
  invalidates reads again. Authoritative reconciliation waits until the entire
  mutation queue is idle so an intermediate GET cannot overwrite a later write.
  The server confirms create/rename/delete before local changes; failures
  never optimistically delete data.
- Cloud and cached templates validate required nested configuration and
  decoration collections before being applied; malformed 200 responses keep
  the last good cache. Historic optional logos, signatures, poemStyle
  and other explicitly optional fields remain supported.
- After a mutation completes, an authoritative refetch reconciles cases in
  which the write was accepted by the server but its response was lost.
  A warning remains for uncertain outcomes so the user can inspect the list
  **before repeating a create**. No duplicate POST retry is automatic.
- LocalStorage quota and corruption are reported. Corrupt guest cache
  content is not replaced without user recovery; failed writes still leave
  the in-memory list visible.

## AI image/background request ownership

- AI generations receive an intent epoch. Applying a built-in or custom
  template, selecting another background type, changing a background
  color, starting an upload, or switching accounts invalidates older
  generations and pending image conversions.
- Every potentially late completion rechecks the *same* owner at the
  final image commit, **after** any image fetch/decoding/transcoding.
  Uploads additionally capture a specific account-lifetime lease and image
  conversion ID. Switching accounts invalidates that lease even if the user
  returns to the same account. Post-await type changes and error handling
  recheck it. A superseded conversion reports `false`; the old upload/AI
  task may not set background type or display a stale error.
- Double clicks while one AI request is active are coalesced on the
  client to avoid accidental duplicate billable requests.
- **Important billing limitation:** changing the background does not cancel
  or refund a request already accepted by the AI server. Such a request
  can still consume credits. Its obsolete result is ignored, but a
  same-account balance refresh is still requested when a response supplies
  an updated balance. The UI must never treat an aborted preview as an
  implicit refund.

## Local-only verification

Do **not** manually start Actions/CI. The change uses a single commit with
`[skip ci]` and one independent PR.

```sh
npm ci
npm run typecheck
npm run lint
npm run test:unit
npx playwright test tests/e2e/async-template-safety.spec.ts
npx playwright test tests/e2e/background-presets.spec.ts
npx playwright test tests/e2e/editor-draft-safety.spec.ts
npm run build
```

Manual acceptance checklist:

1. As a guest, create, rename and delete a custom template. Reload and
   verify only the guest-scoped cache is used.
2. Log into account A, verify its cloud list. Log into B and back into A.
   No instant render or late response may show another account's templates.
3. Simulate 401, 503, and malformed 200 for GET; existing cached templates
   must remain visible. A valid 200 with an empty list is genuinely empty.
4. Delay a cloud GET, then create/rename/delete. Confirm the old GET never
   overwrites the mutation. After the write, a fresh GET reconciles the list.
5. Delay the POST response and log out or switch accounts. Its result cannot
   be inserted into the new account's cache. Inspect server state before
   retrying an uncertain POST.
6. Review the explicit legacy import notice on a browser with pre-PR caches;
   ensure no automatic cross-account import occurs.
7. Start AI generation, then change built-in template, upload image, or
   select Solid/Paper before the response. The old completion must not
   change the current background, even if transcoding finishes later.
8. Confirm a successful, still-current AI generation applies its background,
   and existing source attribution/export continue to work.

**Validation status when drafted:** remote repository metadata and file
changes were inspected. The execution container cannot resolve github.com,
so typecheck/Playwright/build remain unverified until local execution.
