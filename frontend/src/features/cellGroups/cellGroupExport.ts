import type { CellGroup } from "./cellGroup";
import type { ExportColumn } from "../export/exportTypes";
import type { ExportSheet } from "../export/exportTypes";
import {
  assertExportHasRows,
  createExportSheet,
  formatExportDate,
  sanitizeSheetName,
  toExportText,
} from "../export/exportUtils.ts";
import {
  MEMBER_ROSTER_COLUMNS,
  mapMemberExportSourceRow,
  memberFullName,
  toMemberRosterRow,
  type MemberExportSourceRow,
} from "../members/memberExport.ts";

export interface CellGroupExportRow {
  group: CellGroup;
  displayedCount: number;
}

const CELL_GROUP_LIST_COLUMNS: ExportColumn[] = [
  { header: "Cell Group", width: 30 },
  { header: "Leader", width: 26 },
  { header: "Status", width: 14 },
  { header: "Members", width: 12 },
  { header: "Male", width: 10 },
  { header: "Female", width: 10 },
  { header: "Unknown / Not Set", width: 18 },
  { header: "Created", width: 16 },
];

export function buildCellGroupListExport(
  rows: CellGroupExportRow[],
  genderFilter = "all",
): ExportSheet {
  const subject =
    genderFilter === "all" ? "Cell Groups" : `Cell Groups ${genderFilter}`;

  return assertExportHasRows(
    createExportSheet({
      subject,
      sheetName: "Cell Groups",
      columns: CELL_GROUP_LIST_COLUMNS,
      rows: rows.map(({ group, displayedCount }) => [
        toExportText(group.name) || "Unnamed Cell Group",
        toExportText(group.leaderName) || "Not assigned",
        toExportText(group.status),
        displayedCount,
        group.memberGenderCounts.male,
        group.memberGenderCounts.female,
        group.memberGenderCounts.unknown,
        formatExportDate(group.createdAt),
      ]),
    }),
  );
}

export function buildCellGroupRosterExport(
  groupName: string,
  members: MemberExportSourceRow[],
): ExportSheet {
  const records = members
    .map(mapMemberExportSourceRow)
    .sort((left, right) =>
      memberFullName(left).localeCompare(memberFullName(right), undefined, {
        sensitivity: "base",
      }),
    );

  return assertExportHasRows(
    createExportSheet({
      subject: `${groupName} Members`,
      sheetName: sanitizeSheetName(groupName, "Cell Group Roster"),
      columns: MEMBER_ROSTER_COLUMNS,
      rows: records.map(toMemberRosterRow),
    }),
  );
}
