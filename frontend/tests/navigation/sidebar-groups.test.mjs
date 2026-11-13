import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const GROUPS = [
  {
    label: "Discipleship",
    items: [
      "/admin/training",
      "/admin/members",
      "/admin/member-registration-reviews",
      "/admin/cell-groups",
    ],
  },
  {
    label: "Ministry & Outreach",
    items: ["/admin/evangelism", "/admin/ministries"],
  },
  {
    label: "Church Operations",
    items: ["/admin/events", "/admin/equipment"],
  },
  {
    label: "Project Ilaw",
    items: ["/admin/project-ilaw-orders", "/admin/project-ilaw-items"],
  },
  {
    label: "Content & Resources",
    items: ["/admin/resources", "/admin/worship-messages", "/admin/church-life"],
  },
];

function groupSource(sidebar, label) {
  const start = sidebar.indexOf(`label: "${label}"`);
  assert.notEqual(start, -1, `expected group ${label}`);
  const end = sidebar.indexOf("\n  },", start);
  assert.notEqual(end, -1, `expected ${label} group to close`);
  return sidebar.slice(start, end);
}

test("sidebar renders the collapsible navigation groups with their children", async () => {
  const sidebar = await read("../../src/components/admin/Sidebar.tsx");
  for (const group of GROUPS) {
    const source = groupSource(sidebar, group.label);
    for (const path of group.items) {
      assert.ok(source.includes(`to: "${path}"`), `${group.label} should contain ${path}`);
    }
  }
});

test("sidebar preserves every existing navigation route", async () => {
  const sidebar = await read("../../src/components/admin/Sidebar.tsx");
  for (const path of [
    "/admin/dashboard",
    "/admin/training",
    "/admin/members",
    "/admin/member-registration-reviews",
    "/admin/cell-groups",
    "/admin/evangelism",
    "/admin/ministries",
    "/admin/events",
    "/admin/equipment",
    "/admin/project-ilaw-orders",
    "/admin/project-ilaw-items",
    "/admin/resources",
    "/admin/worship-messages",
    "/admin/church-life",
    "/admin/users",
    "/admin/help",
  ]) {
    assert.ok(sidebar.includes(`"${path}"`), `missing route ${path}`);
  }
});

test("user administration and How To's stay standalone with their existing access rules", async () => {
  const sidebar = await read("../../src/components/admin/Sidebar.tsx");

  assert.match(sidebar, /hasPermission\("admin\.users"\)[\s\S]*?to="\/admin\/users"/);
  const userAdmin = sidebar.slice(sidebar.indexOf('hasPermission("admin.users")'));
  assert.match(userAdmin, /to="\/admin\/users"/);

  const helpPath = sidebar.indexOf('to="/admin/help"');
  const helpStart = sidebar.lastIndexOf("<NavLink", helpPath);
  const helpEnd = sidebar.indexOf("</NavLink>", helpPath);
  assert.notEqual(helpStart, -1);
  assert.notEqual(helpEnd, -1);
  const help = sidebar.slice(helpStart, helpEnd + "</NavLink>".length);
  assert.doesNotMatch(help, /hasPermission/);
  assert.match(help, /to="\/admin\/help"/);
  for (const group of GROUPS) {
    assert.ok(
      !groupSource(sidebar, group.label).includes("/admin/users"),
      "User Administration must not be part of a group",
    );
    assert.ok(
      !groupSource(sidebar, group.label).includes("/admin/help"),
      "How To's must not be part of a group",
    );
  }
});

test("group headers auto-expand for nested active routes and expose accessible controls", async () => {
  const sidebar = await read("../../src/components/admin/Sidebar.tsx");
  assert.match(sidebar, /useLocation\(\)/);
  assert.match(sidebar, /pathname\.startsWith\(`\$\{to\}\/`\)/);
  assert.match(sidebar, /aria-expanded=\{isExpanded\}/);
  assert.match(sidebar, /aria-controls=\{contentId\}/);
  assert.match(sidebar, /useEffect\([\s\S]*?setOpenGroups/);
});
