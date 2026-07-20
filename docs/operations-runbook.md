# InkPoem Operations Runbook

The root `wrangler.jsonc` is the production configuration. Never point staging commands at it. Create staging from `wrangler.staging.example.jsonc`, store the real file as ignored `wrangler.staging.jsonc`, and replace the placeholder with a separately created staging D1 database ID.

## Release order

1. Record the current Worker version and D1 recovery bookmark:

   ```sh
   npx wrangler versions list
   npx wrangler d1 time-travel info poem-to-image --remote --config wrangler.jsonc
   ```

2. Run the migration preflight. Both result sets must be empty; stop and investigate any duplicate before applying migrations:

   ```sh
   npx wrangler d1 execute DB --remote --config wrangler.jsonc --file worker/queries/preflight-migrations.sql
   ```

3. Apply additive migrations before code that depends on them:

   ```sh
   npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc
   ```

4. Run the release gates and deploy:

   ```sh
   npm run verify
   npm run audit:production
   npm run audit:full
   npm run deploy:dry-run
   npm run deploy
   ```

For staging, use the same commands with `--config wrangler.staging.jsonc`. Staging must use Clerk and Stripe test keys and its own D1 database.

## Billing reconciliation

The scheduled Worker check runs every 15 minutes. It emits `ops.reconciliation_healthy` or `ops.reconciliation_alert` with counts only; it does not log poems, tokens, webhook bodies, or image data.

Run the detailed read-only report with:

```sh
npx wrangler d1 execute DB --remote --config wrangler.jsonc --file worker/queries/billing-reconciliation.sql
```

Investigate these result classes:

- `pending` with `payment_confirmed_at`: Stripe payment was validated, but credit fulfillment has not completed. First allow normal Stripe/status retries; then replay checkout-status or the verified Stripe event through the application path. Do not edit balances directly.
- `needs_review`: compare the stored order snapshot with the Stripe session in the Stripe dashboard. Resolve the underlying mismatch before changing state.
- invariant failure: stop paid traffic. A completed order must have exactly one succeeded `topup` whose amount equals `credits_granted`.
- stale generation reservation: confirm provider outcome and ledger state before deciding whether a failed debit should be refunded.

Use the Stripe session ID as the support-safe lookup identifier. Do not copy card details, bearer tokens, full webhook payloads, or poem content into logs or tickets.

## Refunds and disputes

Refund and dispute events are not automatically converted into credit reversals. Credits already granted remain until an operator reviews the account and records an explicit, auditable adjustment. Never assume a Stripe refund changed the D1 balance. Product/legal owners still need to approve the customer-facing refund and credit-expiration policy before commercial launch.

## Rollback and recovery

- Worker rollback: identify a known-good version with `npx wrangler versions list`, then run `npx wrangler rollback <version-id> --message "reason"`.
- The migrations in this release are additive. Normally roll back Worker code without reversing schema.
- If database recovery is required, use the bookmark shown by `d1 time-travel info` and follow the confirmation flow from `npx wrangler d1 time-travel restore poem-to-image --remote --config wrangler.jsonc`. Confirm the target time/bookmark and affected database before restoring.
- After any rollback or restore, rerun the reconciliation query and one low-value Stripe test-mode purchase before reopening paid traffic.

## Alert ownership

Configure Cloudflare log alerts for `ops.reconciliation_alert`, sustained `api.request_failed`, and repeated `ai.generation_failed`. The on-call owner should review reconciliation at least daily and immediately during a release window. Alert destinations are account-level operational state and must be configured in Cloudflare before production sign-off.
