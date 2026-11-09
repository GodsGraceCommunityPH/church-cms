import test from "node:test";
import assert from "node:assert/strict";

import {
  EmptyExportError,
  assertExportHasRows,
  buildExportFileName,
  createExportSheet,
  formatExportDate,
  normalizeGenderLabel,
  sanitizeSheetName,
} from "../../src/features/export/exportUtils.ts";

test("formats date-only and timestamp values without shifting the day", () => {
  assert.equal(formatExportDate("2026-11-06"), "Nov 6, 2026");
  assert.equal(formatExportDate("2026-11-06T23:30:00+00:00"), "Nov 6, 2026");
  assert.equal(formatExportDate("2026-01-01T00:00:00.000Z"), "Jan 1, 2026");
  assert.equal(formatExportDate(null), "");
  assert.equal(formatExportDate("not-a-date"), "");
});

test("normalizes gender labels used in exports", () => {
  assert.equal(normalizeGenderLabel("Male"), "Male");
  assert.equal(normalizeGenderLabel("female"), "Female");
  assert.equal(normalizeGenderLabel(""), "Unknown / Not Set");
  assert.equal(normalizeGenderLabel("Other"), "Unknown / Not Set");
});

test("builds descriptive, filesystem-safe export file names", () => {
  const date = new Date(2026, 10, 6);
  assert.equal(
    buildExportFileName("Unassigned Members", date),
    "GGCCC_Unassigned_Members_2026-11-06.xlsx",
  );
  assert.equal(
    buildExportFileName("Maria Corazon Morales Members", date),
    "GGCCC_Maria_Corazon_Morales_Members_2026-11-06.xlsx",
  );
  assert.equal(
    buildExportFileName("SOL 1 / Current: Students", date),
    "GGCCC_SOL_1_Current_Students_2026-11-06.xlsx",
  );
});

test("sanitizes Excel worksheet names to Excel's limits", () => {
  assert.equal(sanitizeSheetName("Unassigned Members"), "Unassigned Members");
  assert.equal(sanitizeSheetName("SOL 1 / Current: Students"), "SOL 1 - Current- Students");
  assert.equal(sanitizeSheetName(""), "Records");
  assert.equal(sanitizeSheetName("x".repeat(50)).length, 31);
});

test("createExportSheet uses the subject for both file and sheet names", () => {
  const sheet = createExportSheet({
    subject: "Unassigned Members",
    sheetName: "Unassigned Members",
    columns: [{ header: "Member Name" }],
    rows: [["Ana Santos"]],
    date: new Date(2026, 10, 6),
  });

  assert.equal(sheet.fileName, "GGCCC_Unassigned_Members_2026-11-06.xlsx");
  assert.equal(sheet.sheetName, "Unassigned Members");
});

test("rejects an export with no matching rows", () => {
  const sheet = createExportSheet({
    subject: "Members",
    sheetName: "Members",
    columns: [{ header: "Member Name" }],
    rows: [],
  });

  assert.throws(() => assertExportHasRows(sheet), EmptyExportError);
});
