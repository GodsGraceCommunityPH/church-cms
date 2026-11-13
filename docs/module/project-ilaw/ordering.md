# Project Ilaw Ordering (Phase 2)

## Status

Implemented in code and covered by automated tests. The migration and
permission/role assignment have **not** been applied to production by this
change. See [Pre-deploy steps](#pre-deploy-steps).

Public ordering is **closed by default**. The Admin Order Management capability
can be published and reviewed while `orders_enabled = false`; the database
submission function rejects every order until an authorized administrator opens
ordering. Payment details also stay disabled by default and are a separate
switch from order intake.

Phase 1 (the public fundraising page and catalog) remains, with the confirmed
GCash InstaPay QR and the real `/shop` catalogue. The old homepage merchandise
mockup section was removed so the landing page stays focused on the Project Ilaw
mission. Phase 2 adds multi-item ordering with colours, a review-before-submit
step, the confirmed QR in the payment workflow, manual verification,
made-to-order production reporting, fulfilment tracking, an append-only activity
history, permission-scoped CMS management, and CSV export.

---

## Products

| Product | Price | Sizes | Colours |
| --- | --- | --- | --- |
| Project Ilaw T-shirt | ₱499 | XS, S, M, L, XL, 2XL, 3XL | Black, White, Maroon, Green, Blue |
| Project Ilaw Eco Bag | ₱499 | One Size | Maroon, Green, Blue (handle colours) |

Both products are made to order. There is no stock check and no stock approval
step; orders determine production quantities.

---

## Public ordering and payment flow

Public ordering is closed until the church authorizes it. While
`project_ilaw_settings.orders_enabled` is false, `/shop` shows the catalog and a
clear “Ordering is not open yet” notice, and `submit_project_ilaw_order`
rejects every submission before any row is created. Hiding the form is only a
presentation aid; the database gate is authoritative.

1. A customer opens `/shop`, reads the Project Ilaw introduction, and chooses
   products, sizes, colours, and quantities.
2. The customer can add, edit, or remove multiple line items. Quantities must be
   positive whole numbers from 1 to 99.
3. The customer enters a required name and mobile number plus optional notes.
4. Before anything is saved, the customer reviews the full order: products,
   colours, sizes, quantities, unit prices, subtotals, total, customer details,
   and the pickup arrangement. The order is submitted only after the customer
   explicitly confirms the review.
5. `submit_project_ilaw_order` saves the order header and every line item in one
   transaction. The reference uses `PI-YYYYMMDD-NNNNNN` in Asia/Manila time and
   is unique.
6. Only after a successful save does the confirmation dialog appear:
   - “Orders Received!”
   - “Thank you for supporting Project Ilaw!”
   - The order reference and the server-calculated total.
   - A “Go to payment” button that scrolls to the payment section.
7. In the payment section the customer enters the **name and mobile number** used
   at submission — no order reference is required. `get_project_ilaw_payment_contexts_by_customer`
   returns every matching order (newest first). When only one order matches it
   opens directly; when several match the customer chooses. The selected order is
   then opened through `get_project_ilaw_payment_context`, which keeps the
   reference, payment token, and payment details internal to that step.
   `get_project_ilaw_payment_context` remains available for internal and
   reference-based workflows.
8. When payments are enabled, the payment section shows the confirmed
   **GCash (InstaPay QR)** image, the exact amount due, the order reference, the
   “Transfer fees may apply.” notice, and a button to enlarge the QR. The QR is
   the payment destination only; it never proves or confirms a payment.
9. The customer pays the exact order total, keeps the receipt, and submits the
   transaction reference plus a screenshot or PDF of the payment. The order moves
   to `payment_verification`.
10. The Project Ilaw team verifies the actual transaction in the receiving
    account and manually confirms the payment. A screenshot never confirms a
    payment automatically.

Fulfilment is pickup only: **Pickup at God's Grace Community Covenant Church**.
No delivery option or delivery address is invented.

Customer-facing status labels translate the internal model:

| Internal status | Customer label |
| --- | --- |
| `awaiting_payment` | Awaiting Payment |
| `payment_verification` | Payment Submitted |
| `paid` | Payment Confirmed |
| fulfilment `not_started` | Order received |
| fulfilment `in_production` | Preparing |
| fulfilment `ready_for_pickup` | Ready for pickup |
| fulfilment `completed` | Completed |
| fulfilment `cancelled` | Cancelled |

The Eco Bag is one size, so neither the product card nor the line-item editor
asks for a size. The server still stores `One Size` for reporting integrity.

### Idempotency

The browser generates a UUID `client_request_id` for each submission attempt.
If the customer double-clicks or retries, the same request id returns the
original reference and totals. A new request id is generated only after a
successful save.

### Ordering and payment configuration

Two independent switches live in the `project_ilaw_settings` singleton:

- `orders_enabled` — controls whether `submit_project_ilaw_order` accepts new
  orders. It starts `false` and can only be changed with
  `project_ilaw.orders.manage`.
- `payments_enabled` — controls whether official payment details and the
  confirmed QR are shown and whether customers can submit payment evidence. It
  starts `false` and is enforced inside both `submit_project_ilaw_payment` and
  the storage upload helper.

Disabling payment instructions does **not** open or close order intake, and
opening order intake does **not** enable payment collection. The public Shop
reads both switches through `get_project_ilaw_public_settings`, which returns
only the two booleans. While payments are disabled, no QR or active payment
instructions are shown, and evidence is rejected server-side rather than merely
hidden.

Payment account details are configuration, not code. They start empty. The
confirmed GCash InstaPay QR is a public, committed asset at
`frontend/public/images/fundraising/gcash-instapay-qr.png`; it is shown only
when payments are enabled and is never stored in the private evidence bucket.
Because the confirmed QR is the payment destination, payments can be opened
without inventing text account details; any GCash or bank text is optional
supporting information. The migration never invents an account number or a
cutoff date.

### Payment evidence

Payment evidence is stored in the private `project-ilaw-payment-evidence`
bucket. Anonymous uploads are limited to
`orders/<order_id>/<payment_token>/<filename>` and are rejected while payments
are disabled or once an order is paid or cancelled. Reading evidence requires
`project_ilaw.orders.view`, and the admin UI opens it through a short-lived
signed URL. An order reference alone never authorizes access to order data or
evidence.

---

## Data model

| Table | Purpose |
| --- | --- |
| `project_ilaw_orders` | Order header: reference, customer, server totals, payment and fulfilment status, payment token/evidence, cancellation metadata. |
| `project_ilaw_order_items` | Immutable-per-revision line items with `revision`, `superseded_at`, snapshotted product name/type/size/colour/price. |
| `project_ilaw_order_events` | Append-only audit trail. |
| `project_ilaw_settings` | Singleton configuration for order intake, payment details, and the production cutoff. |

Server-side rules enforced by the migration:

- Prices are always ₱499 and totals are computed from the trusted catalog
  function, never from client input.
- Colours are validated per product: the T-shirt allows five colours, the Eco
  Bag allows three handle colours.
- A deferred constraint trigger verifies the header total quantity and amount
  against the active (non-superseded) line items.
- Amending an order supersedes the previous revision instead of deleting it.
  History retains the prior snapshot.
- `project_ilaw_order_events` rejects `UPDATE` and `DELETE`, including from the
  service role.
- `client_request_id`, `reference`, and `payment_token` are unique.

---

## Statuses and transitions

Payment status is independent of fulfilment status. Confirming payment never
changes fulfilment, and changing fulfilment never changes payment.

| Payment status | Meaning |
| --- | --- |
| `awaiting_payment` | Default for every new order. |
| `payment_verification` | The customer submitted a transaction reference and evidence; awaiting manual review. |
| `paid` | A staff member verified the transaction and manually confirmed payment. Carries who, when, and an optional note. |

| Fulfilment status | Allowed next statuses |
| --- | --- |
| `not_started` | `in_production`, `ready_for_pickup`, `cancelled` |
| `in_production` | `ready_for_pickup`, `cancelled` |
| `ready_for_pickup` | `completed`, `cancelled` |
| `completed` | none |
| `cancelled` | none |

Completed orders cannot be amended or cancelled. Cancelling records who, when,
and an optional reason. A paid order that is later cancelled is **not** treated
as a refund automatically.

Rejecting a payment submission returns the order to `awaiting_payment` with a
rejection timestamp and a **required** reason of at least 5 characters, so the
customer can correct the submission. The rejection and reason are preserved in
the activity history.

A payment can be confirmed only while it is in `payment_verification` and a
non-empty evidence path exists. Staff cannot confirm an order that has not
submitted evidence, and no upload, trigger, or client action marks an order paid
automatically.

---

## Permissions

| Permission | Allows |
| --- | --- |
| `project_ilaw.orders.view` | View orders, line items, payment evidence, production reports, settings, and activity history. |
| `project_ilaw.orders.confirm_payment` | Manually confirm or reject a payment. |
| `project_ilaw.orders.manage` | Amend orders, change fulfilment, cancel orders, and maintain Project Ilaw settings. |
| `project_ilaw.orders.export` | Download the permission-scoped order and production CSVs. |

Frontend routes and controls check these permissions, and every server RPC checks
them again. No role receives Project Ilaw permissions by default except:

- `administrator` — all four permissions, matching the existing convention.
- `project_ilaw_orders_staff` — a new least-privilege role with **only**
  `project_ilaw.orders.view` and `project_ilaw.orders.confirm_payment`.

### Assigning an order-staff account

The migration creates the role but deliberately does **not** create an Auth
account and does not guess a user id. Before assigning it:

1. Verify the exact existing CMS account with the church. Do not infer it from a
   name alone.
2. Run the lookup against the target database:

   ```sql
   select u.id, au.email, u.display_name, u.is_active
   from public.users u
   join auth.users au on au.id = u.id
   where lower(au.email) = lower('<verified-email>');
   ```

3. Confirm exactly one active row is returned.
4. Assign the role:

   ```sql
   insert into public.user_roles (user_id, role_id)
   select u.id, r.id
   from auth.users au
   join public.users u on u.id = au.id
   join public.roles r on r.code = 'project_ilaw_orders_staff'
   where lower(au.email) = lower('<verified-email>')
   on conflict (user_id, role_id) do nothing;
   ```

5. Re-check that the account has exactly the intended permissions and no
   administrator, finance, or unrelated grants:

   ```sql
   select au.email, r.code as role_code, p.code as permission_code
   from auth.users au
   join public.users u on u.id = au.id
   join public.user_roles ur on ur.user_id = u.id
   join public.roles r on r.id = ur.role_id
   join public.role_permissions rp on rp.role_id = r.id
   join public.permissions p on p.id = rp.permission_id
   where lower(au.email) = lower('<verified-email>')
   order by r.code, p.code;
   ```

If the account cannot be verified, stop. Do not create an account, do not grant
administrator, and report the blocker.

---

## CMS management

Routes:

- `/admin/project-ilaw-orders` — summary cards, product/size/colour breakdowns,
  search, filters, orders table, production report, settings, CSV exports.
- `/admin/project-ilaw-orders/:id` — line items with colour, customer details,
  payment evidence review, manual confirmation/rejection, fulfilment actions,
  cancellation, amendment form, and activity history.

The list page shows:

- Total orders, total units (active and cancelled), awaiting payment, payment
  verification, paid orders, expected sales, and confirmed collections.
- T-shirt quantities per size and colour, Eco Bag quantity and handle colours,
  and cancelled quantities.
- A search field (reference, name, mobile, payment reference) plus date, product,
  payment-status, and fulfilment-status filters.
- A production report panel aggregating confirmed quantities by product, size,
  and colour, honouring the configured cutoff.
- A settings panel for official payment details and the production cutoff,
  visible to order viewers and editable only with `project_ilaw.orders.manage`.

Product, size, and colour breakdowns exclude cancelled orders. The table keeps
cancelled orders visible so their history remains auditable.

---

## Accounting and production rules

These rules are shared by the summary cards, filters, reports, and CSV:

- **Expected sales** = sum of totals for orders whose fulfilment status is not
  `cancelled`.
- **Confirmed collections** = sum of totals for orders whose payment status is
  `paid`, including orders later cancelled.
- **Awaiting payment** and **payment verification** count only non-cancelled
  orders.
- A cancelled order that was already paid remains in confirmed collections and is
  flagged separately. It is not treated as a refund.
- **Confirmed production** counts only `paid`, non-cancelled orders, aggregated
  by product, size, colour, and quantity.
- The production cutoff stays unset until church leadership decides the date.
  While unset, every paid, non-cancelled order is included. Once set, only orders
  created on or before that Manila date are included.
- The order CSV exports one row per active line item and includes reference,
  date, customer, mobile, product, size, colour, quantity, unit price, line total,
  both statuses, payment reference, and payment confirmer/timestamp.

The export and production RPCs re-check the relevant permission on the server
and apply the same filters.

---

## Notifications

Creating an order inserts a `project_ilaw_order_created` notification for every
active CMS user who holds `project_ilaw.orders.view`. Submitting payment inserts
a `project_ilaw_payment_submitted` notification for every active user who holds
`project_ilaw.orders.confirm_payment`. Notifications link to the order detail
page. No email, SMS, chat bot, or external integration is invented or required.

Existing member notifications continue to work. Notification RLS now accepts
either `members.view` or `project_ilaw.orders.view`, but a recipient can still
only read and mark their own notifications.

---

## Security model

- Anonymous customers can execute only:
  - `submit_project_ilaw_order(uuid, text, text, text, jsonb)`
  - `get_project_ilaw_payment_context(text, text)` — requires the reference and
    the mobile number used at submission.
  - `submit_project_ilaw_payment(text, text, uuid, text, text)` — requires the
    order reference, mobile number, and the order's secret payment token.
  - `get_project_ilaw_payment_instructions()`
- Anonymous and authenticated users have no `INSERT`, `UPDATE`, or `DELETE`
  privilege on any Project Ilaw table.
- `authenticated` has `SELECT` only, filtered by RLS policies that call
  `has_permission('project_ilaw.orders.view')`.
- Privileged mutations run through security-definer RPCs that check the caller’s
  permission and derive the actor from `auth.uid()`.
- The service role is never exposed to the frontend.
- Activity history is append-only at the database level.
- Order totals cannot be forged by the client.
- Public order intake is enforced inside `submit_project_ilaw_order`, not only in
  the Shop UI. While `orders_enabled` is false, no order row or line item is
  created.
- Payment collection is enforced separately inside `submit_project_ilaw_payment`
  and `project_ilaw_can_upload_payment_evidence`. While `payments_enabled` is
  false, no evidence is accepted even with a valid reference, mobile number, and
  payment token.
- Payment confirmation requires `payment_verification` and a non-empty evidence
  path; rejection requires a reason of at least 5 characters.
- Payment evidence is private and token-scoped for uploads; staff reads require
  `project_ilaw.orders.view`.
- The confirmed QR is a public payment-destination asset. It is never used as
  proof of payment and is never written to the private evidence bucket.

---

## Automated tests

```powershell
cd frontend
npm run test:project-ilaw
npm run test:navigation
npm run test:security
```

- `tests/fundraising/project-ilaw-shop.test.mjs` — catalog, colours, one-size
  Eco Bag, validation, totals, statuses, payment steps, review-before-submit,
  confirmation modal, confirmed QR asset, and removal of the old homepage
  merchandise preview.
- `tests/fundraising/project-ilaw-accounting.test.mjs` — accounting rules,
  production aggregation, filters, CSV escaping.
- `tests/security/project-ilaw-order-contract.test.mjs` — migration contract,
  RLS, payment evidence storage, ordering/payment switch enforcement, required
  rejection reason, confirmation prerequisites, permission checks, append-only
  activity, plus an optional live integration test.
- `tests/navigation/sidebar-groups.test.mjs` — CMS navigation.

The live integration test is skipped unless a disposable Supabase fixture is
provided:

```env
PILAW_TEST_SUPABASE_URL=
PILAW_TEST_SUPABASE_ANON_KEY=
PILAW_TEST_SERVICE_ROLE_KEY=
PILAW_TEST_VIEWER_EMAIL=
PILAW_TEST_VIEWER_PASSWORD=
PILAW_TEST_CONFIRM_EMAIL=
PILAW_TEST_CONFIRM_PASSWORD=
PILAW_TEST_MANAGER_EMAIL=
PILAW_TEST_MANAGER_PASSWORD=
PILAW_TEST_OUTSIDER_EMAIL=
PILAW_TEST_OUTSIDER_PASSWORD=
```

The fixture needs four accounts: view-only, view + confirm, view + manage +
export, and no Project Ilaw permission. Because order activity is append-only, the
integration test intentionally leaves its test order in the disposable database.

---

## Pre-deploy steps

1. Review and apply, in order:
   `supabase/migrations/20261110090000_project_ilaw_ordering.sql` and then
   `supabase/migrations/20261113120000_project_ilaw_customer_lookup.sql` to the
   target environment.
2. Run
   `supabase/verification/059_project_ilaw_ordering_verification.sql` and confirm
   it reports `Project Ilaw Phase 2 verification passed.`
3. Verify the exact order-staff account and assign
   `project_ilaw_orders_staff` using the SQL above. Do not create an account.
4. Leave `orders_enabled = false` for the Admin Order Management release. The
   dashboard, detail page, evidence review, production report, settings, and CSV
   export can be reviewed without accepting public orders.
5. Only after explicit church authorization, open ordering in the Admin Portal
   with the “Accept public orders” setting. This is a separate action from
   enabling payment details.
6. In the Admin Portal, confirm the published **GCash (InstaPay QR)** asset,
   enter any supporting account details, and enable payments only after the
   church confirms the receiving account. Leave the production cutoff unset
   until leadership decides the date.
7. Confirm the QR remains legible and scannable on a phone, and that
   “Transfer fees may apply.” is visible.
8. Redeploy the frontend and smoke-test `/`, `/shop`, `/give`, the closed-ordering
   notice, payment lookup, evidence upload, manual payment confirmation and
   rejection, fulfilment changes, production report, and CSV export.
9. When ordering is authorized, smoke-test order submission as well, then confirm
   the production deployment succeeded before declaring the work complete.

---

## Known limitations / blockers

- The migration and role assignment have not been applied to production.
- Public ordering is disabled by default and must be opened explicitly by an
  authorized administrator.
- The confirmed GCash InstaPay QR is committed, but supporting account text
  details have not been supplied and payments remain disabled.
- The production cutoff has not been decided, so it remains unset.
- Notifications are in-app only; no email or chat automation is configured.
