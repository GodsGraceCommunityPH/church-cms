import type { ExportCell, ExportColumn } from "../export/exportTypes";
import {
  assertExportHasRows,
  createExportSheet,
  formatExportDate,
  normalizeGenderLabel,
  sanitizeSheetName,
  toExportText,
} from "../export/exportUtils.ts";
import type { ExportSheet } from "../export/exportTypes";

export interface MemberFilterFields {
  firstName: string;
  lastName: string;
  nickname: string;
  gender: string;
  cellGroupId: string;
}

export interface MemberExportFilters {
  search?: string;
  gender?: string | null;
  cellGroup?: string | null;
}

export interface MemberExportRecord extends MemberFilterFields {
  birthday: string | null;
  membershipStatus: string;
  cellGroupName: string;
  mobile: string | null;
  email: string | null;
  address: string | null;
  registrationDate: string | null;
}

export interface MemberExportOptions {
  cellGroupName?: string;
}

export type MemberExportAccess =
  | { scope: "church" }
  | { scope: "cell_group"; cellGroupId: string | null };

export function resolveMemberExportFilters(
  filters: MemberExportFilters,
  access: MemberExportAccess,
): MemberExportFilters | null {
  if (access.scope === "church") return filters;
  if (!access.cellGroupId) return null;

  // A Cell Leader cannot widen or replace their scope through query filters.
  return { ...filters, cellGroup: access.cellGroupId };
}

export interface MemberExportSourceRow {
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  gender: string | null;
  birthday: string | null;
  membership_status: string | null;
  cell_group_id: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  created_at: string | null;
  cell_group?: { name: string | null } | Array<{ name: string | null }> | null;
}

export const MEMBER_EXPORT_COLUMNS: ExportColumn[] = [
  { header: "Member Name", width: 28 },
  { header: "Gender", width: 16 },
  { header: "Birthday", width: 16 },
  { header: "Mobile Number", width: 18 },
  { header: "Email", width: 28 },
  { header: "Address", width: 38 },
  { header: "Membership Status", width: 18 },
  { header: "Cell Group", width: 24 },
  { header: "Registration Date", width: 18 },
];

export const MEMBER_ROSTER_COLUMNS: ExportColumn[] = [
  { header: "Member Name", width: 28 },
  { header: "Gender", width: 16 },
  { header: "Birthday", width: 16 },
  { header: "Mobile Number", width: 18 },
  { header: "Email", width: 28 },
  { header: "Address", width: 38 },
  { header: "Membership Status", width: 18 },
  { header: "Registration Date", width: 18 },
];

function normalizedFilter(value: string | null | undefined) {
  return (value ?? "all").trim().toLowerCase();
}

export function matchesMemberFilters(
  member: MemberFilterFields,
  filters: MemberExportFilters,
) {
  const keyword = (filters.search ?? "").trim().toLowerCase();
  const matchesSearch =
    !keyword ||
    member.firstName.toLowerCase().includes(keyword) ||
    member.lastName.toLowerCase().includes(keyword) ||
    member.nickname.toLowerCase().includes(keyword);

  const genderFilter = normalizedFilter(filters.gender);
  const normalizedGender = member.gender.trim().toLowerCase();
  const matchesGender =
    genderFilter === "all" ||
    (genderFilter === "unknown"
      ? !["male", "female"].includes(normalizedGender)
      : normalizedGender === genderFilter);

  const cellGroupFilter = (filters.cellGroup ?? "all").trim();
  const normalizedCellGroupFilter = cellGroupFilter.toLowerCase();
  const matchesCellGroup =
    normalizedCellGroupFilter === "all" ||
    (normalizedCellGroupFilter === "unassigned"
      ? !member.cellGroupId
      : normalizedCellGroupFilter === "assigned"
        ? Boolean(member.cellGroupId)
        : member.cellGroupId === cellGroupFilter);

  return matchesSearch && matchesGender && matchesCellGroup;
}

export function filterMembersForExport<T extends MemberFilterFields>(
  members: T[],
  filters: MemberExportFilters,
) {
  return members.filter((member) => matchesMemberFilters(member, filters));
}

function relatedCellGroupName(
  value: MemberExportSourceRow["cell_group"],
): string {
  const related = Array.isArray(value) ? value[0] : value;
  return related?.name ?? "";
}

export function mapMemberExportSourceRow(
  row: MemberExportSourceRow,
): MemberExportRecord {
  return {
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    nickname: row.nickname ?? "",
    gender: row.gender ?? "",
    cellGroupId: row.cell_group_id ?? "",
    cellGroupName: relatedCellGroupName(row.cell_group),
    birthday: row.birthday,
    membershipStatus: row.membership_status ?? "",
    mobile: row.mobile,
    email: row.email,
    address: row.address,
    registrationDate: row.created_at,
  };
}

export function memberFullName(member: Pick<MemberExportRecord, "firstName" | "lastName">) {
  return `${member.firstName} ${member.lastName}`.trim();
}

export function toMemberExportRow(member: MemberExportRecord): ExportCell[] {
  return [
    memberFullName(member) || "Unnamed member",
    normalizeGenderLabel(member.gender),
    formatExportDate(member.birthday),
    toExportText(member.mobile),
    toExportText(member.email),
    toExportText(member.address),
    toExportText(member.membershipStatus),
    toExportText(member.cellGroupName) || "Unassigned",
    formatExportDate(member.registrationDate),
  ];
}

export function toMemberRosterRow(member: MemberExportRecord): ExportCell[] {
  return [
    memberFullName(member) || "Unnamed member",
    normalizeGenderLabel(member.gender),
    formatExportDate(member.birthday),
    toExportText(member.mobile),
    toExportText(member.email),
    toExportText(member.address),
    toExportText(member.membershipStatus),
    formatExportDate(member.registrationDate),
  ];
}

export function memberExportIdentity(
  filters: MemberExportFilters,
  options: MemberExportOptions = {},
) {
  const cellGroupFilter = normalizedFilter(filters.cellGroup);
  const genderFilter = normalizedFilter(filters.gender);
  const parts: string[] = [];

  if (cellGroupFilter === "unassigned") parts.push("Unassigned");
  else if (cellGroupFilter === "assigned") parts.push("Assigned");
  else if (cellGroupFilter !== "all") {
    parts.push(options.cellGroupName?.trim() || "Cell Group");
  }

  if (genderFilter === "male") parts.push("Male");
  else if (genderFilter === "female") parts.push("Female");
  else if (genderFilter === "unknown") parts.push("Unknown");

  parts.push("Members");

  const subject = parts.join(" ");
  return { subject, sheetName: sanitizeSheetName(subject) };
}

export function buildMemberExportSheet(
  records: MemberExportRecord[],
  filters: MemberExportFilters,
  options: MemberExportOptions = {},
): ExportSheet {
  const matching = filterMembersForExport(records, filters);
  const identity = memberExportIdentity(filters, options);

  return assertExportHasRows(
    createExportSheet({
      subject: identity.subject,
      sheetName: identity.sheetName,
      columns: MEMBER_EXPORT_COLUMNS,
      rows: matching.map(toMemberExportRow),
    }),
  );
}
