import { supabase } from "../../lib/supabase";
import {
  getTrainingOverview,
  type TrainingProgramSummary,
} from "../training/trainingService";
import {
  hasCellLeaderRole,
  normalizeDashboardMemberCounts,
  type DashboardMemberCounts,
} from "./dashboardMemberCounts";

export interface DashboardGenderMetric {
  key: "female" | "male" | "unknown";
  label: string;
  count: number;
  percentage: number;
}

export interface DashboardCellGroupMetric {
  id: string | null;
  name: string;
  count: number;
  percentage: number;
}

export interface DashboardData {
  totalMembers: number;
  memberCounts: DashboardMemberCounts;
  isCellLeader: boolean;
  totalCellGroups: number;
  inTraining: number;
  completedTraining: number;
  genders: DashboardGenderMetric[];
  cellGroups: DashboardCellGroupMetric[];
  trainingPrograms: TrainingProgramSummary[];
  membersWithoutGender: number;
  membersWithoutCellGroup: number;
}

interface DashboardMemberRow {
  id: string;
  gender: string | null;
  cell_group_id: string | null;
}

interface DashboardCellGroupRow {
  id: string;
  name: string;
}

function percentage(count: number, total: number) {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function normalizeGender(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "female") return "female";
  if (normalized === "male") return "male";
  return "unknown";
}

/**
 * Resolves the Cell Leader role for the signed-in user. The explicit
 * `user_id` filter is required because Administrators may be able to read
 * every role assignment under RLS.
 */
async function loadIsCellLeader(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return false;

    const { data, error } = await supabase
      .from("user_roles")
      .select("roles(code)")
      .eq("user_id", userId);
    if (error) return false;
    return hasCellLeaderRole(data);
  } catch {
    return false;
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const roleLookup = loadIsCellLeader();
  const [membersResult, cellGroupsResult, memberCountsResult, trainingPrograms] = await Promise.all([
    supabase.from("members").select("id, gender, cell_group_id"),
    supabase.from("cell_groups").select("id, name").order("name"),
    supabase.rpc("get_dashboard_member_counts"),
    getTrainingOverview(),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (cellGroupsResult.error) throw cellGroupsResult.error;

  const members = (membersResult.data ?? []) as DashboardMemberRow[];
  const cellGroupRows = (cellGroupsResult.data ?? []) as DashboardCellGroupRow[];
  // Church-wide totals come from the aggregate-only RPC because the member
  // query above is intentionally limited by RLS for Cell Leaders.
  const memberCounts = memberCountsResult.error
    ? normalizeDashboardMemberCounts(null)
    : normalizeDashboardMemberCounts(memberCountsResult.data);
  // The role lookup is scoped to the signed-in user and acts as an independent
  // fallback so the Cell Leader presentation still applies when the count RPC
  // errors or is not deployed yet.
  const isCellLeader = (await roleLookup) || memberCounts.isCellLeader;
  const totalMembers = members.length;
  const genderCounts = { female: 0, male: 0, unknown: 0 };
  const cellGroupCounts = new Map<string, number>();
  let membersWithoutCellGroup = 0;

  for (const member of members) {
    genderCounts[normalizeGender(member.gender)] += 1;
    if (member.cell_group_id) {
      cellGroupCounts.set(
        member.cell_group_id,
        (cellGroupCounts.get(member.cell_group_id) ?? 0) + 1,
      );
    } else {
      membersWithoutCellGroup += 1;
    }
  }

  const cellGroups: DashboardCellGroupMetric[] = [
    ...cellGroupRows.map((group) => ({
      id: group.id,
      name: group.name,
      count: cellGroupCounts.get(group.id) ?? 0,
      percentage: percentage(cellGroupCounts.get(group.id) ?? 0, totalMembers),
    })),
    {
      id: null,
      name: "No Cell Group / Unassigned",
      count: membersWithoutCellGroup,
      percentage: percentage(membersWithoutCellGroup, totalMembers),
    },
  ].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));

  return {
    totalMembers,
    memberCounts,
    isCellLeader,
    totalCellGroups: cellGroupRows.length,
    inTraining: trainingPrograms.reduce(
      (total, program) => total + (program.inProgress ?? 0),
      0,
    ),
    completedTraining: trainingPrograms.reduce(
      (total, program) => total + (program.completed ?? 0),
      0,
    ),
    genders: [
      { key: "female", label: "Female", count: genderCounts.female, percentage: percentage(genderCounts.female, totalMembers) },
      { key: "male", label: "Male", count: genderCounts.male, percentage: percentage(genderCounts.male, totalMembers) },
      { key: "unknown", label: "Unknown / Not Set", count: genderCounts.unknown, percentage: percentage(genderCounts.unknown, totalMembers) },
    ],
    cellGroups,
    trainingPrograms,
    membersWithoutGender: genderCounts.unknown,
    membersWithoutCellGroup,
  };
}
