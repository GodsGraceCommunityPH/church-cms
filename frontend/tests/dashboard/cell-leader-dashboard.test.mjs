import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("dashboard service sources member counts from the aggregate RPC, not the RLS-limited query", async () => {
  const service = await read("../../src/features/dashboard/dashboardService.ts");

  assert.match(service, /supabase\.rpc\("get_dashboard_member_counts"\)/);
  assert.match(
    service,
    /memberCountsResult\.error\s*\?\s*normalizeDashboardMemberCounts\(null\)\s*:\s*normalizeDashboardMemberCounts\(memberCountsResult\.data\)/,
  );
  assert.match(service, /const roleLookup = loadIsCellLeader\(\)/);
  assert.match(service, /\.from\("user_roles"\)[\s\S]*\.select\("roles\(code\)"\)[\s\S]*\.eq\("user_id", userId\)/);
  assert.match(service, /\(await roleLookup\) \|\| memberCounts\.isCellLeader/);
  assert.match(service, /isCellLeader,/);
  assert.match(service, /const totalMembers = members\.length/);
  assert.doesNotMatch(service, /memberCounts[^\n]*totalMembers/);
});

test("Cell Leaders get exactly the four scoped summary cards and no church-wide breakdowns", async () => {
  const dashboard = await read("../../src/pages/admin/Dashboard.tsx");
  const cardBuilder = await read("../../src/features/dashboard/dashboardMemberCounts.ts");

  assert.match(dashboard, /buildDashboardMemberCountCards\(data\.memberCounts\)/);
  assert.match(dashboard, /const isCellLeader = data\.isCellLeader/);
  assert.match(
    dashboard,
    /const allSummaryCards = isCellLeader\s*\?\s*\[\.\.\.memberCountCards, \.\.\.trainingCards\]\s*:\s*\[\.\.\.memberCountCards, cellGroupsCard, \.\.\.trainingCards\]/,
  );
  assert.match(dashboard, /showGender = !isCellLeader && \(dashboardView === "all" \|\| dashboardView === "members"\)/);
  assert.match(dashboard, /showCellGroups = !isCellLeader && dashboardView !== "training"/);
  assert.match(dashboard, /dashboard-summary-card-static/);
  assert.match(cardBuilder, /label: "Total Church Members"/);
  assert.match(cardBuilder, /label: "Your Cell Group Members"/);
  assert.match(cardBuilder, /link: null[\s\S]*action: counts\.totalMembers === null \? "Count unavailable" : "Church-wide total"/);
  assert.match(cardBuilder, /link: "\/admin\/cell-groups"/);
  assert.match(dashboard, /dashboardView === "training"[\s\S]*trainingSummaryCards/);
  assert.match(dashboard, /data\.trainingPrograms\.map/);
});

test("staff dashboards keep the church-wide cards, gender chart, and Cell Group distribution", async () => {
  const dashboard = await read("../../src/pages/admin/Dashboard.tsx");

  assert.match(
    dashboard,
    /memberSummaryCards = isCellLeader\s*\?\s*memberCountCards\s*:\s*\[\.\.\.memberCountCards, assignedCard, genderNotSetCard, noCellGroupCard\]/,
  );
  assert.match(
    dashboard,
    /cellGroupSummaryCards = isCellLeader\s*\?\s*memberCountCards\s*:\s*\[\.\.\.memberCountCards, cellGroupsCard, membersAssignedCard, unassignedCard\]/,
  );
  assert.match(dashboard, /label: "Cell Groups"/);
  assert.match(dashboard, /Members by Gender/);
  assert.match(dashboard, /Members by Cell Group/);
  assert.match(dashboard, /label: "Assigned to Cell Groups"/);
});

test("count migration is aggregate-only, security definer, and permission gated", async () => {
  const migration = await read("../../../supabase/migrations/20261106090000_dashboard_member_counts.sql");

  assert.match(migration, /create or replace function public\.get_dashboard_member_counts\(\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /public\.has_permission\('members\.view'\)/);
  assert.match(migration, /public\.has_permission\('admin\.users'\)/);
  assert.match(migration, /cg\.leader_member_id = viewer_member_id/);
  assert.match(migration, /u\.member_id/);
  assert.match(migration, /revoke all on function public\.get_dashboard_member_counts\(\) from public, anon/);
  assert.match(migration, /grant execute on function public\.get_dashboard_member_counts\(\) to authenticated/);
  assert.match(migration, /select count\(\*\) into viewer_total_members from public\.members/);
  assert.doesNotMatch(migration, /first_name|last_name|nickname|email|mobile/);
});

test("count migration does not weaken Member RLS or grant individual record access", async () => {
  const migration = await read("../../../supabase/migrations/20261106090000_dashboard_member_counts.sql");

  assert.doesNotMatch(migration, /create policy|drop policy|alter policy/i);
  assert.doesNotMatch(migration, /disable row level security|bypassrls/i);
  assert.doesNotMatch(migration, /grant\s+select\s+on\s+public\.members/i);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete)\s+on\s+public\.members/i);
  assert.match(migration, /from public, anon/);
  assert.doesNotMatch(migration, /to anon|to public/);
});
