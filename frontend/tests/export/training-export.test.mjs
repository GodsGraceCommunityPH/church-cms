import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrainingBatchRosterExport,
  buildTrainingOverviewExport,
  buildTrainingStudentsExport,
  exportTrainingStatusLabel,
  matchesTrainingExportScope,
} from "../../src/features/training/trainingExport.ts";
import { EmptyExportError } from "../../src/features/export/exportUtils.ts";

const programs = [
  {
    name: "SOL 1",
    slug: "sol-1",
    totalEnrolled: 30,
    completed: 12,
    inProgress: 18,
    activeBatches: 1,
    readyForGraduation: 3,
  },
];

function student(overrides = {}) {
  return {
    programName: "SOL 1",
    batchName: "SOL 1 Book 1",
    trainerName: "Trainer One",
    firstName: "Ana",
    lastName: "Santos",
    gender: "Female",
    status: "completed",
    enrolledAt: "2025-01-05T08:00:00+00:00",
    startedAt: "2025-01-12T08:00:00+00:00",
    completedAt: "2025-03-16T08:00:00+00:00",
    withdrawnAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

test("labels workflow statuses for readable worksheets", () => {
  assert.equal(exportTrainingStatusLabel("in_progress"), "In Progress");
  assert.equal(exportTrainingStatusLabel("ready_for_completion"), "Ready for Completion");
  assert.equal(exportTrainingStatusLabel("completed"), "Completed");
  assert.equal(exportTrainingStatusLabel("something_else"), "Something Else");
});

test("separates current and completed Training records", () => {
  assert.equal(matchesTrainingExportScope("pending_enrollment", "current"), true);
  assert.equal(matchesTrainingExportScope("in_progress", "current"), true);
  assert.equal(matchesTrainingExportScope("completed", "current"), false);
  assert.equal(matchesTrainingExportScope("completed", "completed"), true);
  assert.equal(matchesTrainingExportScope("withdrawn", "completed"), false);
});

test("exports Training program totals", () => {
  const sheet = buildTrainingOverviewExport(programs, "current");

  assert.equal(sheet.rows.length, 1);
  assert.deepEqual(sheet.rows[0], ["SOL 1", 1, 18, 3, 12, 30]);
  assert.match(sheet.fileName, /^GGCCC_Training_Programs_/);
});

test("exports completed students with readable dates and no invisible records", () => {
  const sheet = buildTrainingStudentsExport(
    [
      student(),
      student({
        firstName: "Ben",
        lastName: "Cruz",
        status: "in_progress",
        completedAt: null,
      }),
      student({
        programName: "Life Class",
        firstName: "Cara",
        lastName: "Diaz",
        status: "completed",
      }),
    ],
    "completed",
  );

  assert.equal(sheet.rows.length, 2);
  assert.deepEqual(sheet.rows.map((row) => row[1]), ["Cara Diaz", "Ana Santos"]);
  assert.equal(sheet.rows[1][8], "Mar 16, 2025");
  assert.equal(sheet.sheetName, "Completed Students");
});

test("exports the complete class roster with status and dates", () => {
  const sheet = buildTrainingBatchRosterExport({
    programName: "SOL 1",
    batchName: "SOL 1 Book 1",
    students: [
      {
        ...student(),
        id: "e1",
        memberId: "m1",
        status: "completed",
        batchId: "b1",
        guideName: "Guide One",
        rosterOrder: 1,
      },
      {
        ...student({ status: "withdrawn", withdrawnAt: "2025-02-01T08:00:00+00:00" }),
        id: "e2",
        memberId: "m2",
        batchId: "b1",
        guideName: null,
        rosterOrder: 2,
      },
    ],
  });

  assert.equal(sheet.rows.length, 2);
  assert.deepEqual(sheet.rows[0].slice(0, 5), [
    "Ana Santos",
    "Female",
    "Completed",
    "Guide One",
    "Jan 5, 2025",
  ]);
  assert.equal(sheet.rows[1][7], "Feb 1, 2025");
  assert.match(sheet.fileName, /^GGCCC_SOL_1_SOL_1_Book_1_Students_/);
});

test("refuses to build empty Training workbooks", () => {
  assert.throws(() => buildTrainingOverviewExport([], "current"), EmptyExportError);
  assert.throws(
    () => buildTrainingStudentsExport([student({ status: "in_progress" })], "completed"),
    EmptyExportError,
  );
  assert.throws(
    () =>
      buildTrainingBatchRosterExport({
        programName: "SOL 1",
        batchName: "SOL 1 Book 1",
        students: [],
      }),
    EmptyExportError,
  );
});
