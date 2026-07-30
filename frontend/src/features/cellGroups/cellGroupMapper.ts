import type { CellGroup } from "./cellGroup";

export function mapCellGroup(data: any): CellGroup {
  return {
    id: data.id,
    name: data.name,
    leaderId: data.leader_id,
    description: data.description,
    status: data.status,
    createdAt: data.created_at,

    memberCount: data.members?.length ?? 0,
  };
}
