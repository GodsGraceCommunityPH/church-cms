import { supabase } from "../../lib/supabase";
import {
  EmptyExportError,
  ExportPermissionError,
} from "../export/exportUtils.ts";
import {
  buildMemberExportSheet,
  mapMemberExportSourceRow,
  resolveMemberExportFilters,
  type MemberExportFilters,
  type MemberExportOptions,
  type MemberExportRecord,
  type MemberExportSourceRow,
} from "./memberExport.ts";

const PAGE_SIZE = 1000;

const MEMBER_EXPORT_SELECT = `
  first_name,
  last_name,
  nickname,
  gender,
  birthday,
  membership_status,
  cell_group_id,
  mobile,
  email,
  address,
  created_at,
  cell_group:cell_groups!members_cell_group_id_fkey (
    name
  )
`;

export interface MemberExportScope {
  /** null means the user may export church-wide records. */
  forcedCellGroupId: string | null;
}

export async function resolveMemberExportScope(): Promise<MemberExportScope> {
  const { data: canExport, error: permissionError } = await supabase.rpc(
    "has_permission",
    { required_permission: "members.export" },
  );
  if (permissionError) throw permissionError;
  if (!canExport) throw new ExportPermissionError();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const userId = authData.user?.id;
  if (!userId) {
    throw new ExportPermissionError("Sign in again before exporting member records.");
  }

  const [rolesResult, profileResult] = await Promise.all([
    supabase.from("user_roles").select("roles ( code )").eq("user_id", userId),
    supabase.from("users").select("member_id").eq("id", userId).maybeSingle(),
  ]);
  if (rolesResult.error) throw rolesResult.error;
  if (profileResult.error) throw profileResult.error;

  const roleCodes = ((rolesResult.data ?? []) as Array<{
    roles: { code: string } | Array<{ code: string }> | null;
  }>).flatMap((assignment) => {
    const roles = Array.isArray(assignment.roles)
      ? assignment.roles
      : assignment.roles
        ? [assignment.roles]
        : [];
    return roles.map((role) => role.code);
  });

  if (roleCodes.includes("administrator") || roleCodes.includes("pastor")) {
    return { forcedCellGroupId: null };
  }

  const memberId = profileResult.data?.member_id;
  if (!memberId) return { forcedCellGroupId: "" };

  const { data: group, error: groupError } = await supabase
    .from("cell_groups")
    .select("id")
    .eq("leader_member_id", memberId)
    .limit(1)
    .maybeSingle();
  if (groupError) throw groupError;

  // A Cell Leader may only export their own group. No group means no records.
  return { forcedCellGroupId: group?.id ?? "" };
}

async function fetchAllMemberExportRecords(): Promise<MemberExportRecord[]> {
  const records: MemberExportRecord[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("members")
      .select(MEMBER_EXPORT_SELECT)
      .order("last_name", { ascending: true, nullsFirst: true })
      .order("first_name", { ascending: true, nullsFirst: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as unknown as MemberExportSourceRow[];
    records.push(...page.map(mapMemberExportSourceRow));

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return records;
}

export async function buildMemberExportFromDatabase(
  filters: MemberExportFilters,
  options: MemberExportOptions = {},
) {
  const scope = await resolveMemberExportScope();
  const access =
    scope.forcedCellGroupId === null
      ? { scope: "church" as const }
      : { scope: "cell_group" as const, cellGroupId: scope.forcedCellGroupId || null };
  const effectiveFilters = resolveMemberExportFilters(filters, access);
  if (!effectiveFilters) {
    throw new EmptyExportError(
      "No Cell Group is assigned to your account, so there are no member records to export.",
    );
  }

  const records = await fetchAllMemberExportRecords();
  return buildMemberExportSheet(records, effectiveFilters, options);
}
