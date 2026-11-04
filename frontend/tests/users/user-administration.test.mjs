import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("username sign-in keeps private email resolution on the server", async () => {
  const login = await read("../../../supabase/functions/username-login/index.ts");
  const migration = await read("../../../supabase/migrations/057_user_administration.sql");
  const service = await read("../../src/features/users/userManagementService.ts");
  assert.match(login, /resolve_username_login/);
  assert.match(login, /access_token: result\.session\.access_token/);
  assert.doesNotMatch(login, /respond\(origin,\s*\{[^}]*email:/);
  assert.match(migration, /grant execute on function public\.resolve_username_login\(text\) to service_role/);
  assert.doesNotMatch(service, /resolve_username_login/);
  assert.match(service, /functions\.invoke\("username-login"/);
});

test("account operations check admin.users and preserve the final active administrator", async () => {
  const migration = await read("../../../supabase/migrations/057_user_administration.sql");
  const handler = await read("../../../supabase/functions/manage-cms-users/index.ts");
  assert.match(migration, /p\.code='admin\.users'/);
  assert.match(migration, /At least one active Administrator must remain/);
  assert.match(migration, /delete from public\.user_roles/);
  assert.match(migration, /grant execute on function public\.admin_user_upsert[\s\S]*to service_role/);
  assert.match(handler, /has_permission/);
  assert.match(handler, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(handler, /\.from\("roles"\)\.delete/);
});

test("user administration is routed and exposes username, roles, status, and Member linking", async () => {
  const app = await read("../../src/App.tsx");
  const page = await read("../../src/pages/admin/UserManagement.tsx");
  const sidebar = await read("../../src/components/admin/Sidebar.tsx");
  assert.match(app, /path="\/admin\/users" element={<UserManagement \/>}/);
  assert.match(sidebar, /hasPermission\("admin\.users"\).*\/admin\/users/s);
  for (const text of ["Username", "Assigned roles", "CMS access active", "Link Member record"]) assert.ok(page.includes(text));
});
