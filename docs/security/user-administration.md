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

Member linking changes only `users.member_id`. It does not write the Member row
or its `cell_group_id`. Existing Auth accounts are assigned deterministic
usernames from their private email prefix plus a short account identifier.

Production rollout requires applying `supabase/migrations/057_user_administration.sql`,
deploying `manage-cms-users` and `username-login` (with JWT verification disabled
for `username-login`), and setting the function secrets and allowed origins.
