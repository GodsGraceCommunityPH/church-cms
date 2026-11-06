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
  assert.match(service, /const totalMembers = members\.length/);
  assert.doesNotMatch(service, /memberCounts[^\n]*totalMembers/);
});

test("dashboard renders the count cards separately from existing summary data", async () => {
  const dashboard = await read("../../src/pages/admin/Dashboard.tsx");
  const cardBuilder = await read("../../src/features/dashboard/dashboardMemberCounts.ts");

  assert.match(dashboard, /buildDashboardMemberCountCards\(data\.memberCounts\)/);
  assert.match(dashboard, /dashboard-summary-card-static/);
  assert.match(cardBuilder, /label: "Total Church Members"/);
  assert.match(cardBuilder, /label: "Your Cell Group Members"/);
  assert.match(cardBuilder, /link: null[\s\S]*action: counts\.totalMembers === null \? "Count unavailable" : "Church-wide total"/);
  assert.match(cardBuilder, /link: "\/admin\/cell-groups"/);
  assert.match(dashboard, /showGender = dashboardView === "all" \|\| dashboardView === "members"/);
  assert.match(dashboard, /data\.trainingPrograms\.map/);
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
