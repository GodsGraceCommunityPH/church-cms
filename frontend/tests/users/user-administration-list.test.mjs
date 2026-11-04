import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MEMBER_LIST_SELECT,
  ROLE_LIST_SELECT,
  USER_LIST_LOAD_ERROR,
  USER_LIST_SELECT,
  loadUserAdministration,
  mapUserRows,
} from "../../../supabase/functions/manage-cms-users/listUsers.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function fakeAdmin({ users = [], roles = [], members = [], errors = {} } = {}) {
  const responses = {
    users: { data: errors.users ? null : users, error: errors.users ?? null },
    roles: { data: errors.roles ? null : roles, error: errors.roles ?? null },
    members: { data: errors.members ? null : members, error: errors.members ?? null },
  };
  const calls = [];

  return {
    calls,
    from(table) {
      return {
        select(columns) {
          calls.push({ table, select: columns });
          return {
            order(column) {
              calls.push({ table, order: column });
              return Promise.resolve(responses[table]);
            },
          };
        },
      };
    },
  };
}

test("list selection names both user_roles foreign keys explicitly", async () => {
  assert.match(USER_LIST_SELECT, /user_roles!user_roles_user_id_fkey\(/);
  assert.match(USER_LIST_SELECT, /roles!user_roles_role_id_fkey\(code,name\)/);
  assert.doesNotMatch(USER_LIST_SELECT, /user_roles\(role_id,roles\(/);

  const handler = await read("../../../supabase/functions/manage-cms-users/index.ts");
  assert.match(handler, /loadUserAdministration\(admin\)/);
  assert.match(handler, /return fail\(origin, result\.error, 500\)/);
  assert.match(handler, /return json\(origin, \{ ok: true, users: result\.users, roles: result\.roles, members: result\.members \}\)/);
});

test("list query loads users, roles, and members and maps assigned roles", async () => {
  const admin = fakeAdmin({
    users: [
      {
        id: "user-1",
        username: "admin.one",
        display_name: "Admin One",
        member_id: "member-1",
        is_active: true,
        user_roles: [
          { role_id: "role-1", roles: { code: "administrator", name: "Administrator" } },
          { role_id: "role-2", roles: { code: "member", name: "Member" } },
        ],
      },
      {
        id: "user-2",
        username: "leader.two",
        display_name: "Leader Two",
        member_id: null,
        is_active: false,
        user_roles: [{ role_id: "role-3", roles: null }],
      },
    ],
    roles: [
      { id: "role-1", code: "administrator", name: "Administrator" },
      { id: "role-2", code: "member", name: "Member" },
      { id: "role-3", code: "cell_leader", name: "Cell Leader" },
    ],
    members: [{ id: "member-1", first_name: "Ada", last_name: "Lovelace", email: null, cell_group_id: null }],
  });

  const result = await loadUserAdministration(admin);
  assert.equal(result.ok, true);
  assert.equal(result.users.length, 2);
  assert.equal(result.roles.length, 3);
  assert.equal(result.members.length, 1);
  assert.deepEqual(result.users[0].roles, ["administrator", "member"]);
  assert.deepEqual(result.users[1].roles, []);
  assert.equal(result.users[0].member_id, "member-1");
  assert.equal(result.users[1].member_id, null);

  const usersCall = admin.calls.find((call) => call.table === "users" && call.select);
  const rolesCall = admin.calls.find((call) => call.table === "roles" && call.select);
  const membersCall = admin.calls.find((call) => call.table === "members" && call.select);
  assert.equal(usersCall?.select, USER_LIST_SELECT);
  assert.equal(rolesCall?.select, ROLE_LIST_SELECT);
  assert.equal(membersCall?.select, MEMBER_LIST_SELECT);
  assert.ok(admin.calls.some((call) => call.table === "users" && call.order === "display_name"));
  assert.ok(admin.calls.some((call) => call.table === "roles" && call.order === "name"));
  assert.ok(admin.calls.some((call) => call.table === "members" && call.order === "last_name"));
});

test("a failed list query returns a visible error instead of an empty success", async () => {
  for (const table of ["users", "roles", "members"]) {
    const admin = fakeAdmin({
      errors: { [table]: { code: "PGRST201", message: `ambiguous relationship on ${table}` } },
    });

    const result = await loadUserAdministration(admin);
    assert.equal(result.ok, false, `${table} failure must not report success`);
    assert.equal(result.error, USER_LIST_LOAD_ERROR);
    assert.equal(result.users, undefined);
  }
});

test("genuine empty results stay successful so the empty state can render", async () => {
  const result = await loadUserAdministration(fakeAdmin());
  assert.deepEqual(result, { ok: true, users: [], roles: [], members: [] });
});

test("user row mapping keeps assigned role codes and ignores blank assignments", () => {
  const mapped = mapUserRows([
    {
      id: "user-1",
      username: "user.one",
      display_name: "User One",
      member_id: undefined,
      is_active: true,
      user_roles: [
        { roles: { code: "pastor" } },
        { roles: { code: "" } },
        { roles: null },
        { roles: { code: "finance" } },
      ],
    },
  ]);

  assert.deepEqual(mapped[0].roles, ["pastor", "finance"]);
  assert.equal(mapped[0].member_id, null);
});

test("frontend treats a missing ok flag as a failed list request and shows an error", async () => {
  const service = await read("../../src/features/users/userManagementService.ts");
  const page = await read("../../src/pages/admin/UserManagement.tsx");

  assert.match(service, /if \(!data\?\.ok\) throw new Error\(data\?\.error \|\| "User management request failed\."\)/);
  assert.doesNotMatch(service, /input\.action !== "list"/);

  assert.match(page, /const \[loadError, setLoadError\] = useState\(""\)/);
  assert.match(page, /catch \(reason\)[\s\S]*setLoadError/);
  assert.match(page, /User data could not be loaded\.[\s\S]*\{loadError\}/);
  assert.match(page, /!loadError && visibleUsers\.length === 0 && <p>No users found\.<\/p>/);
});
