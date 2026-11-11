import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../../../supabase/migrations/20261110120000_member_export_permission.sql", import.meta.url),
  "utf8",
);
const memberExportService = await readFile(
  new URL("../../src/features/members/memberExportService.ts", import.meta.url),
  "utf8",
);

test("member export permission is granted only to staff roles", () => {
  assert.match(migration, /'members\.export', 'Export members', 'members'/);
  assert.match(migration, /role\.code in \('administrator', 'pastor'\)/);
  assert.match(migration, /role\.code not in \('administrator', 'pastor'\)/);
});

test("member export service checks the database permission and Cell Leader scope", () => {
  assert.match(memberExportService, /rpc\(\s*"has_permission"/);
  assert.match(memberExportService, /required_permission:\s*"members\.export"/);
  assert.match(memberExportService, /roleCodes\.includes\("cell_leader"\)|forcedCellGroupId/);
  assert.match(memberExportService, /\.eq\("leader_member_id", memberId\)/);
});

test("member export service paginates every accessible record", () => {
  assert.match(memberExportService, /const PAGE_SIZE = 1000/);
  assert.match(memberExportService, /\.range\(from, from \+ PAGE_SIZE - 1\)/);
  assert.match(memberExportService, /page\.length < PAGE_SIZE/);
});
