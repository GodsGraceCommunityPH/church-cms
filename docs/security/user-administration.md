# User administration

The staff portal authenticates with a unique username and password. Auth still
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

Member linking changes only `users.member_id`. It does not write the Member row
or its `cell_group_id`. Existing Auth accounts are assigned deterministic
usernames from their private email prefix plus a short account identifier.

Production has applied `20261104022255_user_administration.sql` and has active
`manage-cms-users` and `username-login` Edge Functions. Keep the migration
version aligned with the production migration history; do not reapply it.
`username-login` must keep JWT verification disabled because it serves the
unauthenticated sign-in flow and validates the request in its handler.
Both production functions return the exact allowed CORS origin for
`https://www.godsgracecommunity.com` and reject an unrelated origin.
