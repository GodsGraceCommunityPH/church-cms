# Project Ilaw Ordering (Phase 2)

## Status

Implemented in code and covered by automated tests. The migration and
permission/role assignment have **not** been applied to production by this
change. See [Pre-deploy steps](#pre-deploy-steps).

Phase 1 (the public fundraising page and catalog) is unchanged. Phase 2 adds
multi-item ordering, manual payment confirmation, fulfilment tracking, an
append-only activity history, permission-scoped CMS management, and CSV export.

---

## Public ordering flow

1. A customer opens `/shop` and chooses the Project Ilaw T-shirt (XS–3XL) or
   the Project Ilaw Eco Bag (one size).
2. The customer can add, edit, or remove multiple line items. Quantities must be
   positive whole numbers from 1 to 99.
3. The customer enters a required name and mobile number plus optional notes.
4. `submit_project_ilaw_order` saves the order header and every line item in one
   transaction. The reference uses `PI-YYYYMMDD-NNNNNN` in Asia/Manila time.
5. Only after a successful save does the confirmation dialog appear:
   - “Orders Received!”
   - “Thank you for supporting Project Ilaw!”
   - A prompt to contact Bryan Castro on Facebook Messenger for payment
     instructions.
   - The order reference.
   - “Message Bryan on Messenger”, which is only a link when configured.
6. The customer pays Bryan directly. Nothing on the website collects or shows
   GCash, bank, card, QR, receipt, or payment-reference details, and there is no
   payment gateway.

The Eco Bag is one size, so neither the product card nor the line-item editor
asks for a size. The server still stores `One Size` for reporting integrity.

### Idempotency

The browser generates a UUID `client_request_id` for each submission attempt.
If the customer double-clicks or retries, the same request id returns the
original reference and totals. A new request id is generated only after a
successful save.

---

## Data model

| Table | Purpose |
| --- | --- |
| `project_ilaw_orders` | Order header: reference, customer, server totals, payment and fulfilment status, cancellation metadata. |
| `project_ilaw_order_items` | Immutable-per-revision line items with `revision`, `superseded_at`, snapshotted product name/type/size/price. |
| `project_ilaw_order_events` | Append-only audit trail. |

Server-side rules enforced by the migration:

- Prices are always ₱499 and totals are computed from the trusted catalog
  function, never from client input.
- A deferred constraint trigger verifies the header total quantity and amount
  against the active (non-superseded) line items.
- Amending an order supersedes the previous revision instead of deleting it.
  History retains the prior snapshot.
- `project_ilaw_order_events` rejects `UPDATE` and `DELETE`, including from the
  service role.
- `client_request_id` and `reference` are unique.

---

## Statuses and transitions

Payment status is independent of fulfilment status. Confirming payment never
changes fulfilment, and changing fulfilment never changes payment.

| Payment status | Meaning |
| --- | --- |
| `awaiting_payment` | Default for every new order. |
| `payment_confirmed` | A staff member manually confirmed payment. Carries who, when, and an optional note. |

| Fulfilment status | Allowed next statuses |
| --- | --- |
| `not_started` | `processing`, `ready_for_pickup`, `cancelled` |
| `processing` | `ready_for_pickup`, `cancelled` |
| `ready_for_pickup` | `completed`, `cancelled` |
| `completed` | none |
| `cancelled` | none |

Completed orders cannot be amended or cancelled. Cancelling records who, when,
and an optional reason. A payment-confirmed order that is later cancelled is
**not** treated as a refund automatically.

---

## Permissions

| Permission | Allows |
| --- | --- |
| `project_ilaw.orders.view` | View the orders page, order detail, line items, and activity history. |
| `project_ilaw.orders.confirm_payment` | Manually confirm payment. |
| `project_ilaw.orders.manage` | Amend orders, change fulfilment, and cancel. |
| `project_ilaw.orders.export` | Download the permission-scoped CSV. |

Frontend routes and controls check these permissions, and every server RPC checks
them again. No role receives Project Ilaw permissions by default except:

- `administrator` — all four permissions, matching the existing convention.
- `project_ilaw_orders_staff` — a new least-privilege role with **only**
  `project_ilaw.orders.view` and `project_ilaw.orders.confirm_payment`.

### Assigning Bryan Castro

The migration creates the role but deliberately does **not** create an Auth
account and does not guess a user id. Before assigning it:

1. Verify the exact existing CMS account with the church. Do not infer it from a
   name alone.
2. Run the lookup against the target database:

   ```sql
   select u.id, au.email, u.display_name, u.is_active
   from public.users u
   join auth.users au on au.id = u.id
   where lower(au.email) = lower('<verified-bryan-email>');
   ```

3. Confirm exactly one active row is returned.
4. Assign the role:

   ```sql
   insert into public.user_roles (user_id, role_id)
   select u.id, r.id
   from auth.users au
   join public.users u on u.id = au.id
   join public.roles r on r.code = 'project_ilaw_orders_staff'
   where lower(au.email) = lower('<verified-bryan-email>')
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
   where lower(au.email) = lower('<verified-bryan-email>')
   order by r.code, p.code;
   ```

If the account cannot be verified, stop. Do not create an account, do not grant
administrator, and report the blocker.

---

## CMS management

Routes:

- `/admin/project-ilaw-orders` — summary cards, product and size breakdowns,
  filters, orders table, CSV export.
- `/admin/project-ilaw-orders/:id` — line items, customer details, payment
  confirmation, fulfilment actions, cancellation, amendment form, and activity
  history.

The list page shows:

- Total orders, total units (active and cancelled), orders awaiting payment,
  payments confirmed, expected sales, and confirmed collections.
- T-shirt quantities per size, Eco Bag quantity, and cancelled quantities.
- Date, product, payment-status, and fulfilment-status filters.

Product and size breakdowns exclude cancelled orders. The table keeps cancelled
orders visible so their history remains auditable.

---

## Accounting rules

These rules are shared by the summary cards, filters, and CSV:

- **Expected sales** = sum of totals for orders whose fulfilment status is not
  `cancelled`.
- **Confirmed collections** = sum of totals for orders whose payment status is
  `payment_confirmed`, including orders later cancelled.
- **Awaiting payment** counts only non-cancelled orders.
- A cancelled order that was already paid remains in confirmed collections and is
  flagged separately. It is not treated as a refund.
- CSV exports one row per active line item and includes reference, date, customer,
  mobile, product, size, quantity, unit price, line total, both statuses, and
  payment confirmer/timestamp.

The export RPC (`project_ilaw_export_rows`) re-checks
`project_ilaw.orders.export` on the server and applies the same filters.

---

## Notifications

Creating an order inserts a `project_ilaw_order_created` notification for every
active CMS user who holds `project_ilaw.orders.view`. The notification links to
the order detail page. No email, SMS, Messenger bot, or external integration is
invented or required.

Existing member notifications continue to work. Notification RLS now accepts
either `members.view` or `project_ilaw.orders.view`, but a recipient can still
only read and mark their own notifications.

---

## Messenger configuration

Set the real link in the frontend environment:

```env
VITE_PROJECT_ILAW_MESSENGER_URL=https://m.me/<bryan-username>
```

Accepted hosts are `m.me`, `messenger.com`, `www.messenger.com`,
`facebook.com`, and `www.facebook.com`. Invalid or missing values produce a
disabled “Message Bryan on Messenger” button with a short explanation; the order
and its reference are still shown, and no link is fabricated.

See `frontend/.env.example`.

---

## Security model

- Anonymous customers can execute only
  `submit_project_ilaw_order(uuid, text, text, text, jsonb)`.
- Anonymous and authenticated users have no `INSERT`, `UPDATE`, or `DELETE`
  privilege on any Project Ilaw table.
- `authenticated` has `SELECT` only, filtered by RLS policies that call
  `has_permission('project_ilaw.orders.view')`.
- Privileged mutations run through security-definer RPCs that check the caller’s
  permission and derive the actor from `auth.uid()`.
- The service role is never exposed to the frontend.
- Activity history is append-only at the database level.
- Order totals cannot be forged by the client.

---

## Automated tests

```powershell
cd frontend
npm run test:fundraising
npm run test:navigation
npm run test:security
```

- `tests/fundraising/project-ilaw-shop.test.mjs` — catalog, one-size Eco Bag,
  validation, totals, statuses, Messenger URL validation, confirmation modal.
- `tests/fundraising/project-ilaw-accounting.test.mjs` — accounting rules,
  filters, CSV escaping.
- `tests/security/project-ilaw-order-contract.test.mjs` — migration contract,
  RLS, permission checks, append-only activity, plus an optional live integration
  test.
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

1. Review and apply
   `supabase/migrations/20261110090000_project_ilaw_ordering.sql` to the target
   environment.
2. Run
   `supabase/verification/059_project_ilaw_ordering_verification.sql` and confirm
   it reports `Project Ilaw Phase 2 verification passed.`
3. Verify the exact Bryan Castro account and assign
   `project_ilaw_orders_staff` using the SQL above. Do not create an account.
4. Set `VITE_PROJECT_ILAW_MESSENGER_URL` in the frontend deployment environment.
5. Redeploy the frontend and smoke-test `/shop`, the confirmation dialog, the
   CMS orders page, payment confirmation, fulfilment changes, and CSV export.
6. Confirm the production deployment succeeded before declaring the work
   complete.

---

## Known limitations / blockers

- The migration and role assignment have not been applied to production.
- Bryan Castro’s exact CMS account cannot be verified from this repository alone.
- The Messenger URL has not been supplied, so the button stays disabled until the
  environment variable is set.
- Notifications are in-app only; no email or Messenger automation is configured.
