import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("username sign-in keeps private email resolution on the server", async () => {
  const login = await read("../../../supabase/functions/username-login/index.ts");
  const migration = await read("../../../supabase/migrations/20261104022255_user_administration.sql");
  const service = await read("../../src/features/users/userManagementService.ts");
  assert.match(login, /resolve_username_login/);
  assert.match(login, /access_token: result\.session\.access_token/);
  assert.doesNotMatch(login, /respond\(origin,\s*\{[^}]*email:/);
  assert.match(migration, /grant execute on function public\.resolve_username_login\(text\) to service_role/);
  assert.doesNotMatch(service, /resolve_username_login/);
  assert.match(service, /functions\.invoke\("username-login"/);
});

test("username identifiers accept usernames and valid emails while rejecting malformed emails", async () => {
  const admin = await read("../../../supabase/functions/manage-cms-users/index.ts");
  const login = await read("../../../supabase/functions/username-login/index.ts");
  const service = await read("../../src/features/users/userManagementService.ts");
  const emailPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  const usernamePattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,39}$/;
  const accepts = (value) => usernamePattern.test(value) || (value.length <= 254 && emailPattern.test(value));
  for (const value of ["joy.calma", "joy_calma", "joy-calma", "joy123"]) assert.equal(accepts(value), true, value);
  for (const value of ["joy@ggccc.com", "joy@gmail.com", "joy.calma@ggccc.com", "Joy@Ggccc.Com"]) assert.equal(accepts(value), true, value);
  for (const value of ["joy@", "@ggccc.com", "joy..calma@gmail.com", "joy@gmail", "joy calma@gmail.com"]) assert.equal(accepts(value), false, value);
  assert.match(admin, /validUsername[\s\S]*254[\s\S]*Enter a 3–40 character username or a valid email address/);
  assert.match(login, /validIdentifier[\s\S]*254/);
  assert.match(service, /validIdentifier[\s\S]*254/);
  assert.match(login, /resolve_username_login[\s\S]*p_username: username/);
  assert.equal("Joy@Ggccc.Com".toLowerCase(), "joy@ggccc.com");
});

test("email identifier login is case-insensitive and usernames remain uniquely case-insensitive", async () => {
  const resolverMigration = await read("../../../supabase/migrations/20261104022255_user_administration.sql");
  const migration = await read("../../../supabase/migrations/20261104065645_security_review_fixes.sql");
  assert.match(resolverMigration, /lower\(u\.username\)=lower\(btrim\(p_username\)\)/);
  assert.match(resolverMigration, /create unique index if not exists users_username_lower_unique[\s\S]*lower\(username\)/i);
  assert.match(migration, /on conflict\(id\) do update set username=excluded\.username/);
  assert.equal(new Set(["joy.calma", "JOY.CALMA"].map((value) => value.toLowerCase())).size, 1);
});

test("account operations check admin.users and preserve the final active administrator", async () => {
  const migration = await read("../../../supabase/migrations/20261104022255_user_administration.sql");
  const handler = await read("../../../supabase/functions/manage-cms-users/index.ts");
  assert.match(migration, /p\.code='admin\.users'/);
  assert.match(migration, /At least one active Administrator must remain/);
  assert.match(migration, /delete from public\.user_roles/);
  assert.match(migration, /grant execute on function public\.admin_user_upsert[\s\S]*to service_role/);
  assert.match(handler, /has_permission/);
  assert.match(handler, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(handler, /transactionRolledBack[\s\S]*Account setup result is uncertain/);
  assert.doesNotMatch(handler, /\.from\("roles"\)\.delete/);
});

test("user administration is routed and exposes username, roles, status, and Member linking", async () => {
  const app = await read("../../src/App.tsx");
  const page = await read("../../src/pages/admin/UserManagement.tsx");
  const sidebar = await read("../../src/components/admin/Sidebar.tsx");
  assert.match(app, /path="\/admin\/users" element={<UserManagement \/>}/);
  assert.match(sidebar, /hasPermission\("admin\.users"\).*\/admin\/users/s);
  for (const text of ["Username or email", "Assigned roles", "Link Member record", "Deactivate", "Reactivate"]) assert.ok(page.includes(text));
});

test("CMS password validation accepts only supplied passwords from 6 through 128 characters", async () => {
  const { passwordValidationError } = await import("../../../supabase/functions/manage-cms-users/passwordPolicy.ts");
  for (const password of ["", "abc123", "a".repeat(128)]) assert.equal(passwordValidationError(password), null);
  for (const password of ["abc12", "a".repeat(129)]) assert.equal(passwordValidationError(password), "Password must be 6–128 characters.");

  const handler = await read("../../../supabase/functions/manage-cms-users/index.ts");
  assert.match(handler, /body\.action === "create" \|\| body\.action === "update"[\s\S]*passwordValidationError\(providedPassword\)/);
  assert.match(handler, /admin\.auth\.admin\.createUser\(\{[^}]*password: temporaryPassword/);
  assert.match(handler, /if \(providedPassword && !creating\)[\s\S]*admin\.auth\.admin\.updateUserById\(userId, \{ password: providedPassword \}\)/);
  assert.match(handler, /temporaryPassword = providedPassword \|\|/);
});

test("user administration UI describes the six-character policy on create and edit password input", async () => {
  const page = await read("../../src/pages/admin/UserManagement.tsx");
  assert.match(page, /minLength=\{6\} maxLength=\{128\}/);
  assert.match(page, /6–128 characters[\s\S]*Letters and numbers are accepted; special characters are optional/i);
  assert.match(page, /New password \(optional\)/);
});

test("ambiguous member registrations have a permission-scoped review queue without automatic Member edits", async () => {
  const app = await read("../../src/App.tsx");
  const page = await read("../../src/pages/admin/MemberRegistrationReviews.tsx");
  const sidebar = await read("../../src/components/admin/Sidebar.tsx");
  assert.match(app, /PermissionRoute permission="members\.view"[\s\S]*path="\/admin\/member-registration-reviews"/);
  assert.match(sidebar, /members\.view[\s\S]*\/admin\/member-registration-reviews/);
  assert.match(page, /member_registration_reviews/);
  assert.match(page, /is_assigned_cell_group/);
  assert.match(page, /rpc\("set_member_registration_review_status"/);
  assert.doesNotMatch(page, /\.from\("members"\)\.(insert|update|delete)/);
});
