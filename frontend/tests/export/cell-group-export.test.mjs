import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCellGroupListExport,
  buildCellGroupRosterExport,
} from "../../src/features/cellGroups/cellGroupExport.ts";
import { EmptyExportError } from "../../src/features/export/exportUtils.ts";

const group = {
  id: "group-1",
  name: "Grace Cell Group",
  slug: "grace",
  leaderId: "member-1",
  leaderName: "Maria Morales",
  description: "North area",
  status: "Active",
  createdAt: "2025-01-05T08:00:00+00:00",
  memberCount: 4,
  memberGenderCounts: { male: 2, female: 1, unknown: 1 },
};

function rosterMember(overrides = {}) {
  return {
    first_name: "Ana",
    last_name: "Santos",
    nickname: "",
    gender: "Female",
    birthday: "1990-01-02",
    membership_status: "Active",
    cell_group_id: "group-1",
    mobile: "09171234567",
    email: "ana@example.com",
    address: "1 Main Street",
    created_at: "2025-03-04T08:00:00+00:00",
    ...overrides,
  };
}

test("exports the Cell Group list with leader names and gender counts", () => {
  const sheet = buildCellGroupListExport([{ group, displayedCount: 3 }]);

  assert.equal(sheet.rows.length, 1);
  assert.deepEqual(sheet.rows[0], [
    "Grace Cell Group",
    "Maria Morales",
    "Active",
    3,
    2,
    1,
    1,
    "Jan 5, 2025",
  ]);
  assert.equal(sheet.sheetName, "Cell Groups");
});

test("falls back to Not assigned when a Cell Group has no leader", () => {
  const sheet = buildCellGroupListExport([
    { group: { ...group, leaderName: "" }, displayedCount: 0 },
  ]);

  assert.equal(sheet.rows[0][1], "Not assigned");
});

test("includes the gender filter in the Cell Group file name", () => {
  const sheet = buildCellGroupListExport(
    [{ group, displayedCount: 1 }],
    "female",
  );

  assert.match(sheet.fileName, /^GGCCC_Cell_Groups_female_/);
});

test("exports every member in a Cell Group roster", () => {
  const sheet = buildCellGroupRosterExport("Grace Cell Group", [
    rosterMember({
      first_name: "Ben",
      last_name: "Cruz",
      gender: "Male",
      mobile: "09180000002",
      birthday: null,
    }),
    rosterMember(),
  ]);

  assert.equal(sheet.rows.length, 2);
  assert.equal(sheet.rows[0][0], "Ana Santos");
  assert.equal(sheet.rows[1][0], "Ben Cruz");
  assert.equal(sheet.rows[0][3], "09171234567");
  assert.equal(sheet.rows[0][2], "Jan 2, 1990");
  assert.equal(sheet.sheetName, "Grace Cell Group");
  assert.match(sheet.fileName, /^GGCCC_Grace_Cell_Group_Members_/);
});

test("refuses to build an empty Cell Group workbook", () => {
  assert.throws(() => buildCellGroupListExport([]), EmptyExportError);
  assert.throws(
    () => buildCellGroupRosterExport("Grace Cell Group", []),
    EmptyExportError,
  );
});
