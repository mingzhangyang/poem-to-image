# InkPoem Production Remediation Plan

Status: Engineering implementation complete; staging and business sign-off pending
Last updated: 2026-07-20
Primary outcome: Make InkPoem safe to operate as a paid production service, then address the most visible performance and product-quality gaps.

Implementation outcome:

- P0/P1 code work is implemented: exact-once billing and generation ledgers, paid-order reconciliation, bounded bodies, effective static/API headers, current dependencies, strict TypeScript/linting, real Workers+D1 tests, CI, structured logs, rate controls, separate staging configuration, preview assets, and locale integrity checks.
- Local release evidence is green: 54 unit checks, 26 Workers-runtime/D1 tests, six desktop/mobile browser tests, production build budgets, Wrangler dry run, and both production/full dependency audits.
- External release gates remain: test the migrations against a representative production-data copy, provision the separate staging D1/config/secrets, complete Stripe/Clerk staging transactions and runtime header/log review, configure alert destinations, and obtain fluent-language and product/legal approval.
- `noUncheckedIndexedAccess` is the next bounded TypeScript hardening step; strict mode and typed no-floating-promise linting are already enforced.

## 1. Release decision

Do not increase paid traffic until the remaining staging and rollout checks are complete. The engineering launch blockers found in the evaluation are fixed locally, but production safety still depends on validating the real bindings, credentials, existing data, and operational alerts.

### P0 launch gate

All of the following must be true before a production sign-off:

- A paid Stripe Checkout session can grant credits exactly once under retries, concurrency, and injected D1 failures.
- Every paid but unfulfilled session is durably visible in a reconciliation queue or query.
- Production dependency audit has no unaccepted high or critical findings.
- Static HTML receives the intended security headers.
- Public request bodies are bounded before they are buffered.
- Worker-runtime integration tests cover billing, authentication boundaries, and static/API routing.
- A staging deployment passes the release checklist in section 10.

## 2. Priorities and ownership

| ID | Priority | Workstream | Primary files | Release impact |
|---|---|---|---|---|
| BILL-1 | P0 | Atomic Stripe fulfillment | `worker/db.ts`, `worker/billing.ts`, D1 migrations | Launch blocker |
| BILL-2 | P0 | Paid-session reconciliation | `worker/billing.ts`, `worker/db.ts`, D1 migrations | Launch blocker |
| DEP-1 | P0 | Vulnerable dependencies | `package.json`, `package-lock.json` | Launch blocker |
| SEC-1 | P0 | Effective static security headers | `public/_headers`, `worker/index.ts` | Launch blocker |
| SEC-2 | P0 | Bounded request parsing | `worker/index.ts`, `worker/billing.ts` | Launch blocker |
| TEST-1 | P0 | Workers/D1 integration tests and CI | `tests/worker`, test config, CI config | Launch blocker |
| TYPE-1 | P1 | Strict TypeScript and generated bindings | `tsconfig.json`, Worker types, affected source | Before broad launch |
| OPS-1 | P1 | Observability and operational runbooks | Wrangler config, Worker logging, `docs/` | Before broad launch |
| PERF-1 | P1 | Template asset optimization | `public/template-backgrounds`, template UI | Before marketing push |
| I18N-1 | P1 | Translation integrity | `src/i18n/locales`, locale tests | Before multilingual promotion |
| ABUSE-1 | P1 | Endpoint rate controls | Wrangler config, Worker routing | Before broad launch |
| PROD-1 | P2 | Landing page, analytics, and commercial policy | routes, pages, privacy/terms | Growth readiness |

Suggested delivery for one engineer is 8-12 focused engineering days for P0 and P1, excluding legal review and translation review. Each milestone should land as a separate reviewable change.

## 3. Milestone 1: Make payment fulfillment recoverable and exactly-once

Target: BILL-1 and BILL-2
Estimate: 2-3 days
Dependency: None
Risk: Highest

### 3.1 Define the billing state machine

Use explicit order states instead of inserting an order as `completed` before credits are granted:

```text
pending -> completed
pending -> needs_review
completed -> refunded (only when refund support is implemented)
```

Rules:

- Create a `pending` order after Stripe returns the Checkout session and before returning the Checkout URL to the browser.
- Snapshot `user_id`, `package_id`, expected amount, currency, and credits on that order. A later package-price change must not alter an already-created Checkout session.
- Treat `stripe_session_id` as the external idempotency key.
- Treat one top-up ledger row per order as an invariant enforced by a unique database index, not only by application logic.
- A duplicate request for a `completed` order is a successful no-op.
- A duplicate request for a `pending` order resumes fulfillment.
- An event that cannot be matched to the stored order snapshot becomes `needs_review`; it must not disappear behind a generic `200 received` response.

### 3.2 Add an additive D1 migration

Create a new numbered migration. Keep it backward-compatible so the previous Worker can run during rollout.

The migration should:

- Add the fields needed to distinguish pending, completed, review, and refund states.
- Add `fulfilled_at` and `failure_reason` or equivalent audit fields.
- Add a unique partial index that permits at most one top-up transaction for a non-null `related_order_id`.
- Add a small billing-event or reconciliation table if an invalid paid event cannot be represented safely on `orders`.
- Preserve all existing completed orders and transactions.
- Include a diagnostic query for orders whose state, credit grant, and ledger entry disagree.

Do not drop or rename existing columns in this milestone. Destructive cleanup can happen after the new path has been stable for at least one release.

### 3.3 Replace `fulfillStripeOrder` with a resumable operation

The fulfillment operation should:

1. Load the order by Stripe session ID and validate the immutable snapshot.
2. Return success immediately if the order is already completed and its ledger row exists.
3. Execute the balance increment, top-up transaction insert, and order completion in one atomic D1 batch.
4. Make every write conditional on the order still being `pending`.
5. Read the resulting balance only after the batch succeeds.
6. Leave the order pending when the batch fails so a retry can resume it.

The database constraints and conditional writes must be sufficient to prevent a double grant even when webhook delivery and checkout-status polling race each other.

### 3.4 Handle invalid and delayed paid events

- Persist a compact record of every verified paid event before acknowledging an event that needs manual review. Store identifiers and validation results, not unnecessary payment or poem content.
- Return a non-success response when the event cannot be recorded, allowing Stripe to retry.
- Return `fulfilled: false` and a stable `needs_review` status from checkout-status polling when appropriate.
- Emit a structured error log containing the Stripe event ID/session ID, reason, and order state, without customer payment details.
- Add a reconciliation command or documented D1 query that lists paid/pending or review orders older than a chosen operational threshold.
- Decide and document refund/dispute behavior. At minimum, prevent an operator from assuming credits are automatically reversed when the Worker currently does not process those events.

### 3.5 Required tests

Use the actual Workers runtime and a real local D1 binding for these tests:

- First fulfillment grants the expected credits once.
- Replaying the same webhook does not grant more credits.
- Checkout-status polling racing with a webhook still grants once.
- Twenty concurrent attempts for one session produce one order completion and one top-up transaction.
- A failure inside the atomic batch changes neither the balance nor order state; a retry succeeds.
- A pending order left by an interrupted request resumes successfully.
- A package configuration change after Checkout creation does not change the purchased credits.
- Amount, currency, user, or session mismatches become `needs_review` and are queryable.
- Existing completed orders remain readable after migration.

### 3.6 Acceptance criteria

- For each completed order: exactly one top-up transaction exists and the granted amount matches the stored order snapshot.
- There is no code path that marks an order completed before the credit and ledger writes commit.
- The reconciliation query returns zero unexplained anomalies in staging.
- A replay/concurrency test can run repeatedly without a balance mismatch.

## 4. Milestone 2: Remove known security and dependency blockers

Target: DEP-1, SEC-1, and SEC-2
Estimate: 1-2 days
Dependency: Milestone 1 may proceed in parallel, but both are required for release.

### 4.1 Upgrade audited packages deliberately

- Upgrade React Router DOM to a non-vulnerable compatible version available at implementation time.
- Upgrade Clerk so its resolved `@clerk/shared` and `js-cookie` versions are no longer affected.
- Upgrade Google GenAI so its resolved `protobufjs` and `ws` versions are no longer affected.
- Upgrade Vite, Wrangler, Miniflare, esbuild, and related development packages.
- Re-evaluate and remove the explicit `ws` override if the upgraded dependency graph no longer needs it.
- Commit the updated lockfile.

Verification after each dependency group:

- Clerk sign-in, sign-out, token retrieval, and account page.
- Browser routing and SPA deep links.
- Gemini and OpenAI generation request construction using mocked provider responses.
- Local Wrangler startup and deployment dry run.
- Export and sharing behavior in supported browsers.

Audit gate:

- `npm audit --omit=dev` reports no high or critical findings.
- The full audit reports no high or critical findings, or any remaining dev-only exception is documented with reachability, owner, and removal date.

### 4.2 Apply headers where Static Assets are actually served

Add `public/_headers` so Vite copies it into `dist` and Cloudflare Static Assets applies it without invoking the Worker for every asset.

Minimum document headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` denying unused device capabilities
- `Cross-Origin-Opener-Policy: same-origin`
- The existing CSP baseline: `base-uri 'self'; frame-ancestors 'none'; object-src 'none'`

Then tighten CSP in two steps:

1. Deploy a report-only policy that inventories Clerk, Google Fonts, image, and connection origins, including the inline JSON-LD block.
2. Enforce an allowlisted policy after sign-in, font loading, AI generation, Stripe navigation, and all routes pass staging tests.

Keep API headers centralized in one response helper. Billing handlers must not bypass `Cache-Control: no-store` or the shared security headers.

Acceptance criteria:

- A runtime smoke test for `/`, `/account`, and `/privacy` sees the intended headers.
- Authenticated balance, history, checkout-status, template, and AI responses all include `Cache-Control: no-store`.
- No required Clerk, font, image, or API request is blocked by the enforced CSP.

### 4.3 Bound buffered request bodies

Create one reusable bounded-body parser that counts bytes while reading and returns `413 Payload Too Large` before parsing oversized input. Do not trust `Content-Length` as the only control.

Initial application limits to validate during implementation:

- AI generation JSON: 16 KB.
- Checkout JSON: 8 KB.
- Template JSON: 40 KB, preserving the existing 32 KB serialized-data limit.
- Stripe webhook: 256 KB.

Add tests for an absent `Content-Length`, a false small `Content-Length`, invalid UTF-8/JSON, exact-limit payloads, and over-limit payloads.

## 5. Milestone 3: Establish production-grade verification

Target: TEST-1 and TYPE-1
Estimate: 2-3 days
Dependency: Billing design from Milestone 1

### 5.1 Run Worker tests inside the Worker runtime

- Add Vitest with `@cloudflare/vitest-pool-workers` and the real Wrangler configuration.
- Apply D1 migrations in test setup.
- Replace the billing fake database with actual D1 tests for transactions, constraints, and concurrency.
- Keep fast pure-function Node tests where they are useful, but do not use them as proof of D1 behavior.
- Test the Worker entry point through HTTP for method handling, status codes, headers, auth boundaries, and SPA routing.

### 5.2 Add browser E2E coverage

Use Playwright for the highest-value user journeys:

- First visit and onboarding dismissal.
- Edit a poem, apply a template, alter typography, undo/redo, and export.
- Mobile controls and modal focus behavior.
- Guest custom-template persistence.
- Signed-in template synchronization using a test auth strategy.
- Checkout success, cancellation, and review/error states using Stripe test mode or a controlled test adapter.
- Deep links to `/account`, `/privacy`, and `/about` through the Worker static-asset setup.

Avoid screenshot-only assertions for export correctness. Retain pixel or canvas-command tests for deterministic rendering behavior.

### 5.3 Strengthen TypeScript and linting

- Enable `strict` TypeScript mode.
- Enable `noUncheckedIndexedAccess` after strict-mode errors are resolved, or track it as the next bounded step.
- Replace avoidable `any` values, including template IDs in onboarding.
- Generate Worker binding types with Wrangler and use `satisfies ExportedHandler<Env>` on the entry point.
- Remove the hand-written platform binding interfaces once generated types are integrated.
- Add a no-floating-promises lint rule and a normal source-code linter; `tsc --noEmit` alone should no longer be called linting.

### 5.4 Add continuous integration

Add one required CI workflow that runs on pull requests and the main branch:

1. Clean dependency install.
2. Generated Worker type check.
3. TypeScript and lint checks.
4. Unit and Worker-runtime tests.
5. Production build.
6. Wrangler deployment dry run.
7. Production dependency audit gate.
8. Browser smoke tests, either on every PR or on protected release branches if runtime cost is material.

Acceptance criteria:

- A change cannot merge when any release gate fails.
- Billing tests execute against real D1 semantics.
- The main user journey is covered at desktop and mobile viewport sizes.
- No unchecked floating Worker promises remain.

## 6. Milestone 4: Add abuse protection and operations

Target: OPS-1 and ABUSE-1
Estimate: 1-2 days
Dependency: Stable response/error conventions from Milestone 2

### 6.1 Observability

- Enable Workers logs and low-volume traces in the Wrangler configuration with explicit sampling.
- Use structured JSON logs with stable event names and request IDs.
- Never log poem text, bearer tokens, generated image data, webhook payloads, or secrets.
- Log provider, latency, result category, request ID, credits charged/refunded, and order/session identifiers where appropriate.
- Add alerts or a daily operational check for:
  - paid orders pending beyond the operational threshold;
  - `needs_review` orders;
  - credit-reconciliation mismatches;
  - repeated provider failures;
  - elevated Worker 5xx responses.

### 6.2 Rate controls

Add per-user and/or per-IP rate limits for:

- AI generation.
- Checkout-session creation.
- Template creation and mutation.
- Authentication failures or obviously invalid webhook traffic where a platform rule can safely filter it.

Credit checks remain the cost-control source of truth; rate limiting is an additional abuse and availability control, not a substitute.

### 6.3 Configuration and migration hygiene

- Migrate Wrangler configuration to JSONC when touching configuration substantially.
- Update and test the compatibility date.
- Add explicit staging and production environments where resource bindings differ.
- Align `.dev.vars.example` with every required Clerk validation variable already documented in the README.
- Remove or rewrite the stale AI Studio-oriented `.env.example`.
- Move the full database schema into a coherent numbered migration history and configure the migrations directory.
- Add staging migration, production migration, backup, reconciliation, and rollback instructions.

Acceptance criteria:

- An operator can identify and reconcile a stuck paid order without editing production data blindly.
- A fresh clone can reach a working authenticated local setup by following only the README and example files.
- Staging cannot accidentally bind to the production D1 database.

## 7. Milestone 5: Reduce initial transfer and template latency

Target: PERF-1
Estimate: 1-2 days
Dependency: None; schedule after P0

### 7.1 Create preview-specific assets

- Generate 320-480 px AVIF/WebP thumbnails for every built-in image template.
- Keep full-resolution files for the canvas/export path only.
- Add a `previewImage` field to image-backed template definitions.
- Render thumbnails with lazy-loading semantics; CSS full-resolution backgrounds should not be used for library cards.
- Load the full background only when a template is applied.

### 7.2 Improve caching and budgets

- Give fingerprinted bundles and generated thumbnails long-lived immutable caching.
- Keep HTML revalidated.
- Add a build check or asset report with budgets:
  - first-visit template imagery under 500 KB;
  - no individual preview image over 100 KB without an explicit exception;
  - initial JavaScript gzip tracked and prevented from regressing materially;
  - full-resolution images excluded from the initial request waterfall.

### 7.3 Verify user-visible performance

- Run a mobile performance profile on the deployed staging Worker.
- Confirm onboarding and the first editor frame do not trigger downloads for all template originals.
- Confirm applying a template shows a loading state and does not block editor interaction.

Acceptance criteria:

- The initial route no longer requests the multi-megabyte parchment, wax, and manuscript originals.
- Opening the full template library does not fetch every full-resolution background.
- Exported image quality remains unchanged.

## 8. Milestone 6: Complete multilingual polish

Target: I18N-1
Estimate: 0.5-1 day plus language review
Dependency: None; schedule after P0

- Replace the Traditional Chinese strings currently present in French and Spanish billing/template UI.
- Translate the English export-success/failure strings remaining in German, French, Japanese, Korean, and Traditional Chinese.
- Translate hardcoded English accessibility labels for canvas elements and template actions.
- Add a locale integrity test that:
  - guarantees identical key sets across locales;
  - rejects unexpected Han characters in Latin-language values, with a small allowlist for language names;
  - reports values identical to English unless explicitly allowlisted;
  - validates interpolation placeholders across locales.
- Have a native or fluent reviewer approve French, Spanish, Japanese, Korean, and both Chinese variants before advertising full interface support.

Acceptance criteria:

- Switching languages does not expose unrelated-language UI in any editor, billing, onboarding, or error state.
- Locale integrity tests run in CI.

## 9. Milestone 7: Product and commercial readiness

Target: PROD-1
Priority: P2 after engineering stabilization
Estimate: 2-4 days plus legal review

- Decide whether `/` remains editor-first or becomes the planned positioning page with the editor at `/create`.
- If adding a landing page, preserve direct editor access and saved local state during route migration.
- Add privacy-consistent funnel measurement for landing -> editor -> first edit -> export -> AI attempt -> checkout -> paid fulfillment.
- Do not add tracking that contradicts the current privacy policy. Update the policy before enabling materially new analytics.
- Add Terms of Service, purchase/refund terms, and a clear credit-expiration policy.
- Document account/data deletion and payment-support procedures.
- Add a user-visible support path for a paid session stuck in `needs_review`.
- Resolve the licensing provenance of the two template backgrounds currently documented only as user-provided replacements.

Success measures:

- Export completion rate, AI-generation success rate, checkout conversion, and paid-fulfillment success are measurable.
- Support can trace a reported payment using a session ID without accessing sensitive payment details.
- Marketing claims match the translated and tested product.

## 10. Release and rollout checklist

### Before staging

- [ ] P0 migrations reviewed and tested on a copy of representative data.
- [x] Dependency upgrades installed with clean production and full audits.
- [x] All unit, Worker-runtime, and browser smoke tests pass locally.
- [x] Production build and Wrangler dry run pass.
- [x] Security headers verified from built `dist`, not only from Worker helper tests.

### Staging

- [ ] Use Clerk and Stripe test environments and a staging D1 database.
- [ ] Complete one successful purchase, one cancellation, one replay, and one forced failure/retry.
- [ ] Run the billing reconciliation query and confirm zero anomalies.
- [ ] Verify desktop and mobile editor/export flows.
- [ ] Confirm CSP reports contain no unexplained blocked resources before enforcement.
- [ ] Confirm structured logs contain no poem text, tokens, image data, or webhook bodies.

### Production rollout

- [ ] Export or record a D1 recovery point before applying migrations.
- [ ] Apply additive migrations before deploying code that depends on them.
- [ ] Deploy gradually if available; otherwise deploy during a monitored window.
- [ ] Perform a low-value real Checkout purchase and confirm exactly one grant and ledger entry.
- [ ] Monitor 5xx, paid-pending, review, provider-error, and reconciliation signals.
- [ ] Keep the previous Worker version available for rollback; do not roll back the additive schema migration unless recovery requires it.

### Twenty-four hours after release

- [ ] Re-run billing reconciliation.
- [ ] Review all `needs_review` and failed-generation refund records.
- [ ] Review security/CSP reports and rate-limit events.
- [ ] Record any exceptions with an owner and due date.

## 11. Definition of done

This remediation plan is complete when:

- All P0 and P1 items are implemented or explicitly accepted by the product owner with a written risk exception.
- Paid fulfillment is exactly-once, recoverable, and operationally auditable.
- Dependency and security gates pass in CI.
- Runtime tests cover the production platform rather than only fakes.
- The first editor visit no longer transfers full-resolution template art.
- All advertised interface languages pass automated integrity checks and human review.
- Operators have documented deployment, rollback, reconciliation, refund, and incident procedures.
