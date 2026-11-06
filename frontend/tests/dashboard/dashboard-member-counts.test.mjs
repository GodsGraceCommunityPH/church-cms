import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDashboardMemberCountCards,
  hasCellLeaderRole,
  normalizeDashboardMemberCounts,
} from "../../src/features/dashboard/dashboardMemberCounts.ts";

test("maps the aggregate RPC row for a Cell Leader", () => {
  const counts = normalizeDashboardMemberCounts([
    {
      total_members: 193,
      your_cell_group_members: 13,
      is_cell_leader: true,
      can_view_member_counts: true,
    },
  ]);

  assert.deepEqual(counts, {
    totalMembers: 193,
    yourCellGroupMembers: 13,
    isCellLeader: true,
    canViewMemberCounts: true,
  });
});

test("maps non-leader counts and ignores a Cell Group total", () => {
  const counts = normalizeDashboardMemberCounts([
    {
      total_members: "193",
      your_cell_group_members: 13,
      is_cell_leader: false,
      can_view_member_counts: true,
    },
  ]);

  assert.equal(counts.totalMembers, 193);
  assert.equal(counts.yourCellGroupMembers, null);
  assert.equal(counts.isCellLeader, false);
  assert.equal(counts.canViewMemberCounts, true);
});

test("keeps counts unavailable when the RPC payload is missing or malformed", () => {
  for (const payload of [null, undefined, [], {}, "unexpected"]) {
    const counts = normalizeDashboardMemberCounts(payload);
    assert.equal(counts.totalMembers, null, String(payload));
    assert.equal(counts.yourCellGroupMembers, null, String(payload));
    assert.equal(counts.canViewMemberCounts, false, String(payload));
  }
});

test("does not expose counts to users without members.view or admin.users", () => {
  const counts = normalizeDashboardMemberCounts([
    {
      total_members: 193,
      your_cell_group_members: 13,
      is_cell_leader: true,
      can_view_member_counts: false,
    },
  ]);

  assert.equal(counts.totalMembers, null);
  assert.equal(counts.yourCellGroupMembers, null);
  assert.equal(counts.canViewMemberCounts, false);
  assert.deepEqual(buildDashboardMemberCountCards(counts), []);
});

test("Cell Leaders get a church-wide card without a Members link and their own Cell Group card", () => {
  const cards = buildDashboardMemberCountCards({
    totalMembers: 193,
    yourCellGroupMembers: 13,
    isCellLeader: true,
    canViewMemberCounts: true,
  });

  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0], {
    key: "total-church-members",
    label: "Total Church Members",
    value: 193,
    link: null,
    action: "Church-wide total",
    icon: "church-members",
  });
  assert.deepEqual(cards[1], {
    key: "your-cell-group-members",
    label: "Your Cell Group Members",
    value: 13,
    link: "/admin/cell-groups",
    action: "View your Cell Group",
    icon: "cell-group-members",
  });
});

test("Cell Leader cards show unavailable counts instead of borrowing the RLS-limited total", () => {
  const cards = buildDashboardMemberCountCards({
    totalMembers: null,
    yourCellGroupMembers: null,
    isCellLeader: true,
    canViewMemberCounts: true,
  });

  assert.equal(cards.length, 2);
  assert.equal(cards[0].value, null);
  assert.equal(cards[0].link, null);
  assert.equal(cards[0].action, "Count unavailable");
  assert.equal(cards[1].value, null);
  assert.equal(cards[1].action, "Count unavailable");
});

test("trusted non-leaders keep the linked Total Members card", () => {
  const cards = buildDashboardMemberCountCards({
    totalMembers: 193,
    yourCellGroupMembers: null,
    isCellLeader: false,
    canViewMemberCounts: true,
  });

  assert.equal(cards.length, 1);
  assert.equal(cards[0].label, "Total Members");
  assert.equal(cards[0].link, "/admin/members");
  assert.equal(cards[0].action, "View all members");
});

test("Cell Leaders with zero visible members still get a real zero", () => {
  const cards = buildDashboardMemberCountCards({
    totalMembers: 193,
    yourCellGroupMembers: 0,
    isCellLeader: true,
    canViewMemberCounts: true,
  });

  assert.equal(cards[1].value, 0);
  assert.equal(cards[1].action, "View your Cell Group");
});

test("detects the Cell Leader role even when another role is assigned", () => {
  assert.equal(hasCellLeaderRole([{ roles: { code: "cell_leader" } }]), true);
  assert.equal(hasCellLeaderRole([{ roles: [{ code: "cell_leader" }] }]), true);
  assert.equal(
    hasCellLeaderRole([
      { roles: { code: "administrator" } },
      { roles: { code: "cell_leader" } },
    ]),
    true,
  );
});

test("does not treat other roles or malformed role payloads as Cell Leaders", () => {
  for (const payload of [
    null,
    undefined,
    [],
    {},
    [{ roles: { code: "administrator" } }],
    [{ roles: [{ code: "pastor" }] }],
    [{ roles: null }],
    ["cell_leader"],
  ]) {
    assert.equal(hasCellLeaderRole(payload), false, JSON.stringify(payload));
  }
});
