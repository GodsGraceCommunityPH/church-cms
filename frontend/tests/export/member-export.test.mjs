import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMemberExportSheet,
  filterMembersForExport,
  memberExportIdentity,
  resolveMemberExportFilters,
  toMemberExportRow,
} from "../../src/features/members/memberExport.ts";
import { EmptyExportError } from "../../src/features/export/exportUtils.ts";

function member(overrides = {}) {
  return {
    firstName: "Ana",
    lastName: "Santos",
    nickname: "Ana",
    gender: "Female",
    cellGroupId: "group-1",
    birthday: "1990-01-02",
    membershipStatus: "Active",
    cellGroupName: "Grace Cell Group",
    mobile: "09171234567",
    email: "ana@example.com",
    address: "1 Main Street",
    registrationDate: "2025-03-04T08:00:00+00:00",
    ...overrides,
  };
}

const members = [
  member(),
  member({
    firstName: "Ben",
    lastName: "Cruz",
    nickname: "Benny",
    gender: "Male",
    birthday: null,
    mobile: "09180000002",
  }),
  member({
    firstName: "Cara",
    lastName: "Diaz",
    nickname: "",
    gender: "",
    cellGroupId: "",
    cellGroupName: "",
    mobile: null,
    registrationDate: null,
  }),
];

test("returns every member when no filters are active", () => {
  assert.equal(filterMembersForExport(members, {}).length, 3);
  assert.equal(
    filterMembersForExport(members, { search: "", gender: "all", cellGroup: "all" })
      .length,
    3,
  );
});

test("matches the Members page search, gender, and Cell Group filters", () => {
  assert.deepEqual(
    filterMembersForExport(members, { search: "benny" }).map((item) => item.firstName),
    ["Ben"],
  );
  assert.deepEqual(
    filterMembersForExport(members, { gender: "male" }).map((item) => item.firstName),
    ["Ben"],
  );
  assert.deepEqual(
    filterMembersForExport(members, { gender: "unknown" }).map((item) => item.firstName),
    ["Cara"],
  );
  assert.deepEqual(
    filterMembersForExport(members, { cellGroup: "unassigned" }).map(
      (item) => item.firstName,
    ),
    ["Cara"],
  );
  assert.deepEqual(
    filterMembersForExport(members, { cellGroup: "assigned" }).map(
      (item) => item.firstName,
    ),
    ["Ana", "Ben"],
  );
  assert.deepEqual(
    filterMembersForExport(members, { cellGroup: "group-1", gender: "female" }).map(
      (item) => item.firstName,
    ),
    ["Ana"],
  );
});

test("combines search and Cell Group filters", () => {
  assert.deepEqual(
    filterMembersForExport(members, {
      search: "ana",
      cellGroup: "unassigned",
    }),
    [],
  );
});

test("maps member fields to readable export cells and keeps leading zeroes", () => {
  const row = toMemberExportRow(member());

  assert.deepEqual(row, [
    "Ana Santos",
    "Female",
    "Jan 2, 1990",
    "09171234567",
    "ana@example.com",
    "1 Main Street",
    "Active",
    "Grace Cell Group",
    "Mar 4, 2025",
  ]);
  assert.equal(typeof row[3], "string");
});

test("uses an empty Cell Group label and readable fallback for missing values", () => {
  const row = toMemberExportRow(
    member({
      firstName: "",
      lastName: "",
      cellGroupId: "",
      cellGroupName: "",
      birthday: null,
      membershipStatus: "",
      registrationDate: null,
    }),
  );

  assert.equal(row[0], "Unnamed member");
  assert.equal(row[2], "");
  assert.equal(row[6], "");
  assert.equal(row[7], "Unassigned");
  assert.equal(row[8], "");
});

test("builds an Unassigned Members workbook with all matching records", () => {
  const sheet = buildMemberExportSheet(
    members,
    { cellGroup: "unassigned" },
    { cellGroupName: "Ignored" },
  );

  assert.equal(sheet.rows.length, 1);
  assert.match(sheet.fileName, /^GGCCC_Unassigned_Members_\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.equal(sheet.sheetName, "Unassigned Members");
  assert.deepEqual(
    sheet.columns.map((column) => column.header),
    [
      "Member Name",
      "Gender",
      "Birthday",
      "Mobile Number",
      "Email",
      "Address",
      "Membership Status",
      "Cell Group",
      "Registration Date",
    ],
  );
});

test("includes the Cell Group and gender in the export identity", () => {
  assert.deepEqual(
    memberExportIdentity(
      { cellGroup: "group-1", gender: "male" },
      { cellGroupName: "Grace Cell Group" },
    ),
    {
      subject: "Grace Cell Group Male Members",
      sheetName: "Grace Cell Group Male Members",
    },
  );
  assert.deepEqual(memberExportIdentity({ gender: "unknown" }), {
    subject: "Unknown Members",
    sheetName: "Unknown Members",
  });
});

test("refuses to build an empty member workbook", () => {
  assert.throws(
    () => buildMemberExportSheet(members, { search: "nobody" }),
    EmptyExportError,
  );
});

test("a Cell Leader's export is forced to their assigned Cell Group", () => {
  assert.deepEqual(
    resolveMemberExportFilters(
      { search: "ana", gender: "female", cellGroup: "unassigned" },
      { scope: "cell_group", cellGroupId: "group-1" },
    ),
    { search: "ana", gender: "female", cellGroup: "group-1" },
  );
  assert.deepEqual(
    resolveMemberExportFilters(
      { cellGroup: "another-group" },
      { scope: "cell_group", cellGroupId: "group-1" },
    ),
    { cellGroup: "group-1" },
  );
  assert.equal(
    resolveMemberExportFilters(
      { cellGroup: "unassigned" },
      { scope: "cell_group", cellGroupId: null },
    ),
    null,
  );
  assert.deepEqual(
    resolveMemberExportFilters(
      { cellGroup: "unassigned" },
      { scope: "church" },
    ),
    { cellGroup: "unassigned" },
  );
});

test("handles a large matching set without dropping records", () => {
  const largeSet = Array.from({ length: 5000 }, (_, index) =>
    member({
      firstName: `Member${index}`,
      lastName: "Santos",
      nickname: "",
      gender: index % 2 === 0 ? "Female" : "Male",
    }),
  );

  assert.equal(filterMembersForExport(largeSet, { gender: "female" }).length, 2500);
  assert.equal(filterMembersForExport(largeSet, { cellGroup: "assigned" }).length, 5000);
  assert.equal(filterMembersForExport(largeSet, { search: "member4999" }).length, 1);
});
