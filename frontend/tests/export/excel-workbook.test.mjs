import test from "node:test";
import assert from "node:assert/strict";
import writeExcelFile from "write-excel-file/node";
import readXlsxFile, { readSheetNames } from "read-excel-file/node";

import { buildMemberExportSheet } from "../../src/features/members/memberExport.ts";
import { buildSheetData } from "../../src/features/export/excelExport.ts";

function member(overrides = {}) {
  return {
    firstName: "Ana",
    lastName: "Santos",
    nickname: "Ana",
    gender: "Female",
    cellGroupId: "",
    cellGroupName: "",
    birthday: "1990-01-02",
    membershipStatus: "Active",
    mobile: "09171234567",
    email: "ana@example.com",
    address: "1 Main Street",
    registrationDate: "2025-03-04T08:00:00+00:00",
    ...overrides,
  };
}

test("writes a real .xlsx workbook that can be read back with the expected values", async () => {
  const sheet = buildMemberExportSheet([member()], { cellGroup: "unassigned" });

  const buffer = await writeExcelFile(buildSheetData(sheet), {
    sheet: sheet.sheetName,
    columns: sheet.columns.map((column) => ({ width: column.width })),
    stickyRowsCount: 1,
  }).toBuffer();

  assert.equal(buffer.subarray(0, 2).toString(), "PK");
  assert.deepEqual(await readSheetNames(buffer), [sheet.sheetName]);

  const rows = await readXlsxFile(buffer);

  assert.deepEqual(
    rows[0],
    sheet.columns.map((column) => column.header),
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], "Ana Santos");
  assert.equal(rows[1][1], "Female");
  assert.equal(rows[1][2], "Jan 2, 1990");
  assert.equal(rows[1][3], "09171234567");
  assert.equal(typeof rows[1][3], "string");
  assert.equal(rows[1][7], "Unassigned");
  assert.equal(rows[1][8], "Mar 4, 2025");
});
