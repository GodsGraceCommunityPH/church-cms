import type { CellGroup } from "./cellGroup";

export function mapCellGroup(data: any): CellGroup {
  const members = data.members ?? [];
  const memberGenderCounts = { male: 0, female: 0, unknown: 0 };
  for (const member of members) {
    const gender = member.gender?.trim().toLowerCase();
    if (gender === "male") memberGenderCounts.male += 1;
    else if (gender === "female") memberGenderCounts.female += 1;
    else memberGenderCounts.unknown += 1;
  }

  return {
    id: data.id,
    name: data.name,
    leaderId: data.leader_id,
    description: data.description,
    status: data.status,
    createdAt: data.created_at,

    memberCount: members.length,
    memberGenderCounts,
  };
}
