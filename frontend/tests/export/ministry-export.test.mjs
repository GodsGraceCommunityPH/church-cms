import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMinistryListExport,
  buildMinistryRosterExport,
} from "../../src/features/ministries/ministryExport.ts";
import { EmptyExportError } from "../../src/features/export/exportUtils.ts";

function ministry(overrides = {}) {
  return {
    id: "ministry-1",
    name: "Music Ministry",
    description: "Sunday worship",
    picturePath: "",
    pictureUrl: "",
    status: "Active",
    members: [
      {
        id: "assignment-1",
        memberId: "member-1",
        firstName: "Ana",
        lastName: "Santos",
        role: "Leader",
        dateJoined: "2024-01-07",
        status: "Active",
      },
      {
        id: "assignment-2",
        memberId: "member-2",
        firstName: "Ben",
        lastName: "Cruz",
        role: "Assistant Leader",
        dateJoined: "2024-02-11",
        status: "Active",
      },
      {
        id: "assignment-3",
        memberId: "member-3",
        firstName: "Cara",
        lastName: "Diaz",
        role: "Member",
        dateJoined: "2024-03-03",
        status: "Active",
      },
    ],
    ...overrides,
  };
}

test("exports the ministry list with leaders and member counts", () => {
  const sheet = buildMinistryListExport([ministry()]);

  assert.equal(sheet.rows.length, 1);
  assert.deepEqual(sheet.rows[0], [
    "Music Ministry",
    "Active",
    "Ana Santos",
    "Ben Cruz",
    3,
    "Sunday worship",
  ]);
  assert.equal(sheet.sheetName, "Ministries");
});

test("shows Not assigned when a ministry has no active leader", () => {
  const sheet = buildMinistryListExport([ministry({ members: [] })]);

  assert.equal(sheet.rows[0][2], "Not assigned");
  assert.equal(sheet.rows[0][3], "Not assigned");
  assert.equal(sheet.rows[0][4], 0);
});

test("exports the ministry roster with roles and readable joined dates", () => {
  const sheet = buildMinistryRosterExport("Music Ministry", ministry().members);

  assert.equal(sheet.rows.length, 3);
  assert.deepEqual(sheet.rows[0], ["Ana Santos", "Leader", "Active", "Jan 7, 2024"]);
  assert.deepEqual(sheet.rows[1], [
    "Ben Cruz",
    "Assistant Leader",
    "Active",
    "Feb 11, 2024",
  ]);
  assert.equal(sheet.sheetName, "Music Ministry");
  assert.match(sheet.fileName, /^GGCCC_Music_Ministry_Members_/);
});

test("refuses to build empty ministry workbooks", () => {
  assert.throws(() => buildMinistryListExport([]), EmptyExportError);
  assert.throws(() => buildMinistryRosterExport("Music Ministry", []), EmptyExportError);
});
