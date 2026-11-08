# Operations workflow (29 October 2026)

This workflow supersedes older universal issue-refund, immediate-counterfeit
suspension and automatic post-cancellation relisting behavior. Refer to
`../CLIENT_WORKFLOW_MASTER_PLAN_DRAFT.md` in the workspace for the original
client requirements, later clarifications and implementation decisions.

| Order stage | Issue / action | Payment / next state |
| --- | --- | --- |
| Reserved / collection pending | Seller unavailable | Retain payment and main status; active issue |
| Same | Re-attempt collection | Resolve operations issue and restore collection queue membership |
| Reserved, collected, authenticated | Buyer/seller requested cancellation | Full refund, no fee deduction; product stays delisted |
| Collected | Item failed authentication | Full refund; delist product; notify buyer and seller; one authentication failure per order |
| Collected | Condition differs | Retain payment; admin follow-up required |
| Condition issue | Cancel order | Full refund and both-party notifications |
| Condition issue | Mark as Dispatched | Dispatch; retain condition note for driver/customer context |
| Dispatched | Buyer rejected / Changed mind | Refund, no automatic relisting; arrange return |
| Dispatched | Buyer unavailable | Retain Dispatched and payment; active operations issue |
| Same | Re-attempt delivery | Resolve operations issue; buyer-only new dispatch notification |
| Delivered | Any next operational transition | Rejected: terminal stage |

`POST /issues` validates reason/stage pairs and creates an order-linked record.
`PATCH /issues/:id/resolve` accepts only `retry_collection`, `retry_delivery`,
`cancel_order`, or `dispatch`. Returned `allowedActions` drives dashboard CTAs.
Historical refunded/unlinked issues are retained for review but cannot resume
an order with refunded money. Issue history remains available under the resolved
filter. The active Issues queue defaults to unresolved records.

An order's `activeIssue` controls operational queue membership, independently
of its main lifecycle status. Mobile and seller-facing status therefore stays
Reserved/Dispatched during availability issues. `conditionNote` survives issue
resolution and remains in the order presenter/mobile note mapping.

Refunded products become `rejected` (delisted, not hard deleted). `returnStatus`
records `with_seller` before collection or `awaiting_return` after collection.
Physical return is managed by operations; the seller can post again after
receiving the item, through the normal pending-review/moderation flow. Refund
alone does not trigger wishlist availability notifications or relisting.

Payment/status actions are serialized by a database-backed per-order lease.
Stripe refunds use the existing stable per-order idempotency key. New seller
authentication failures use an atomic per-order deduplication set. Existing
sellerStrikes and accounts are not backfilled or reset. At the configured
threshold (default/current policy: three failures), active/restricted accounts
are suspended with an explicit reason and support guidance. Existing login/API
suspension scope is preserved. No counterfeit allegation is inferred solely
from a generic authentication failure.

The admin-only Customers endpoints are:

- `GET /user/admin/customers?kind=all|sellers|buyers&page=1&limit=20&search=...`
- `PATCH /user/admin/customers/:id/status` with
  `{ "status": "suspended", "reason": "..." }`

Customers exposes safe contact/account details, payout readiness (cached provider
check; failure is shown as unavailable), first-listing date/duration, new failed
authentication count, and historical counterfeit cases separately. Manual
suspension records administrator/time and cannot mutate roles or silently
reactivate accounts. Seller/buyer filters can overlap for the same user.

## Checks and release

Run backend `npm test`, dashboard `node --test tests/order-issue-options.test.cjs`,
dashboard `npx tsc --noEmit` / `npm run build`, and Flutter `flutter test --no-pub`.
Workflow tests stub database/payment/email boundaries: no real refunds, bans,
emails or test products are created. Browser/device and provider test-mode
end-to-end verification remain separate release checks. Deploy backend and
dashboard together so their issue action contracts stay aligned. No historical
financial data migration is included.
