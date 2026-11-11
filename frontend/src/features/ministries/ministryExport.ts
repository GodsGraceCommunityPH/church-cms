import type { Ministry, MinistryMember } from "./ministry";
import type { ExportColumn } from "../export/exportTypes";
import type { ExportSheet } from "../export/exportTypes";
import {
  assertExportHasRows,
  createExportSheet,
  formatExportDate,
  sanitizeSheetName,
  toExportText,
} from "../export/exportUtils.ts";

const MINISTRY_COLUMNS: ExportColumn[] = [
  { header: "Ministry", width: 30 },
  { header: "Status", width: 14 },
  { header: "Ministry Leader", width: 26 },
  { header: "Assistant Leader", width: 26 },
  { header: "Members", width: 12 },
  { header: "Description", width: 42 },
];

const MINISTRY_ROSTER_COLUMNS: ExportColumn[] = [
  { header: "Member Name", width: 28 },
  { header: "Role", width: 20 },
  { header: "Status", width: 14 },
  { header: "Date Joined", width: 16 },
];

function activeMemberWithRole(ministry: Ministry, role: MinistryMember["role"]) {
  return ministry.members.find(
    (member) => member.role === role && member.status === "Active",
  );
}

function memberName(member: MinistryMember | undefined) {
  if (!member) return "";
  return `${member.firstName} ${member.lastName}`.trim();
}

export function buildMinistryListExport(ministries: Ministry[]): ExportSheet {
  return assertExportHasRows(
    createExportSheet({
      subject: "Ministries",
      sheetName: "Ministries",
      columns: MINISTRY_COLUMNS,
      rows: ministries.map((ministry) => [
        toExportText(ministry.name) || "Unnamed Ministry",
        toExportText(ministry.status),
        memberName(activeMemberWithRole(ministry, "Leader")) || "Not assigned",
        memberName(activeMemberWithRole(ministry, "Assistant Leader")) ||
          "Not assigned",
        ministry.members.length,
        toExportText(ministry.description),
      ]),
    }),
  );
}

export function buildMinistryRosterExport(
  ministryName: string,
  members: MinistryMember[],
): ExportSheet {
  const sorted = [...members].sort((left, right) =>
    memberName(left).localeCompare(memberName(right), undefined, {
      sensitivity: "base",
    }),
  );

  return assertExportHasRows(
    createExportSheet({
      subject: `${ministryName} Members`,
      sheetName: sanitizeSheetName(ministryName, "Ministry Roster"),
      columns: MINISTRY_ROSTER_COLUMNS,
      rows: sorted.map((member) => [
        memberName(member) || "Unnamed member",
        toExportText(member.role),
        toExportText(member.status),
        formatExportDate(member.dateJoined),
      ]),
    }),
  );
}
