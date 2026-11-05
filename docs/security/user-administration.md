# User administration

The staff portal authenticates with a unique CMS login identifier and password.
The identifier can be a 3–40 character username or a valid email address up to
254 characters; both are matched without regard to letter casing. Auth still
stores a private synthetic email address because Supabase password auth requires
an email or phone. That address is generated server-side and is neither shown
to administrators nor returned to the browser.

The `username-login` Edge Function resolves usernames with a service-role-only
RPC, signs in through the public Supabase Auth API on the server, and returns
only the normal access and refresh tokens. Deploy this function with JWT
verification disabled because it serves the sign-in flow; it validates origin,
method, request shape, and credentials itself. Apply the database migration
before deploying the functions. Configure `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `CORS_ALLOWED_ORIGINS` in
the Edge Function environment.

All management actions use `manage-cms-users`, which verifies the caller JWT
and `admin.users` permission before using the server-only service key. Database
finalizer RPCs repeat the permission check transactionally. Roles are assigned
through `user_roles`; removing an assignment never deletes a catalogue role.
The database serializes administrator status transitions and prevents removing
or deactivating the last active Administrator.

Profile edits do not change account activation. The dedicated activation path
changes the Supabase Auth ban first, performs the permission-checked database
transition, and restores Auth to the database's persisted state if the database
rejects or ambiguously completes the operation. If state cannot be reconciled,
the function returns an explicit uncertain-outcome error for administrator
review.

### Activation leases, fencing, and reconciliation

`account_activation_leases` is a per-user lease/state store. Each activation
generates one operation ID, acquires the lease, renews it from a heartbeat while
the Auth request is running, and releases it with `completed`, `failed`, or
`uncertain`. Only `completed` / `failed` rows are removed automatically;
`uncertain` rows are preserved for administrator reconciliation.

`admin_user_set_active` requires a non-null operation ID and verifies the live,
unexpired lease inside the same transaction that updates `users.is_active`. The
lease row is locked with `FOR UPDATE`, so renewal, release, or a reconciliation
claim cannot change ownership between the check and the update. Every expiry and
claim-window decision uses `clock_timestamp()` (actual wall-clock time) after the
row lock is acquired, never `now()` / transaction start. A transaction that
waited on the advisory lock or a row lock until after expiry therefore cannot act
on the lease. The original three-argument overload from
`20261104022255_user_administration.sql` is dropped; there is no unfenced path.

Reconciliation is an explicit administrator action:

1. `claim_account_activation_reconciliation` atomically claims an expired or
   uncertain lease. It refuses a live operation and refuses a second
   reconciliation while another claim window is active. The original
   `operation_id` is preserved; `reconciliation_id` identifies the reconciler.
2. The Edge Function reads the actual Supabase Auth ban state and the persisted
   CMS `users.is_active` value. The documented recovery rule is that the CMS
   value is authoritative and the Auth ban is aligned to `!is_active`.
3. After any repair, both states are read again. The lease is not released until
   they are consistent.
4. `finalize_account_activation_reconciliation` re-checks the persisted CMS
   value in the same transaction before deleting the lease. A claim that has
   outlived its own expiry cannot finalize; it stays recoverable by a later
   reconciler. An unverified outcome clears the reconciliation claim but
   preserves the `uncertain` row, so repeated reconciliation remains safe and
   idempotent.

`frontend/tests/users/account-activation-concurrency.test.mjs` is the
two-session PostgreSQL regression test for lock-wait timing. It requires
`ACTIVATION_CONCURRENCY_DATABASE_URL` pointing at an empty, disposable
PostgreSQL database; it is skipped otherwise because PGlite cannot exercise
concurrent sessions.

**Limitation:** database fencing cannot cancel an Auth ban request that has
already been sent to Supabase Auth. If that request lands after reconciliation's
final read, Auth can diverge again. The CMS state remains authoritative and a
later reconciliation repairs it. Account activation is not a cross-system
atomic transaction between Auth and the database.

Member linking changes only `users.member_id`. It does not write the Member row
or its `cell_group_id`. Existing Auth accounts are assigned deterministic
usernames from their private email prefix plus a short account identifier.

Production has applied `20261104022255_user_administration.sql`,
`20261104065645_security_review_fixes.sql`,
`20261104065657_account_activation_leases.sql`, and
`20261104065810_enable_account_activation_leases_rls.sql`, and has active
`manage-cms-users` and `username-login` Edge Functions. Keep the migration
filenames aligned with the production migration history; do not reapply them.
`username-login` must keep JWT verification disabled because it serves the
unauthenticated sign-in flow and validates the request in its handler.
Both production functions return the exact allowed CORS origin for
`https://www.godsgracecommunity.com` and reject an unrelated origin.
