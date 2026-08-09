import { supabase } from "../../lib/supabase";
import {
  getTrainingOverview,
  type TrainingProgramSummary,
} from "../training/trainingService";

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

export async function getDashboardData(): Promise<DashboardData> {
  const [membersResult, cellGroupsResult, trainingPrograms] = await Promise.all([
    supabase.from("members").select("id, gender, cell_group_id"),
    supabase.from("cell_groups").select("id, name").order("name"),
    getTrainingOverview(),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (cellGroupsResult.error) throw cellGroupsResult.error;

  const members = (membersResult.data ?? []) as DashboardMemberRow[];
  const cellGroupRows = (cellGroupsResult.data ?? []) as DashboardCellGroupRow[];
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
