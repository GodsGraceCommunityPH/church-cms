import { supabase } from "../../lib/supabase";
import type { CellGroup } from "./cellGroup";
import { mapCellGroup } from "./cellGroupMapper";

export async function getCellGroups(): Promise<CellGroup[]> {
  const { data, error } = await supabase
    .from("cell_groups")
    .select(`
      *,
      members!members_cell_group_id_fkey (
        id,
        gender
      )
    `)
    .order("name");

  if (error) throw error;

  return (data ?? []).map(mapCellGroup);
}

export async function deleteCellGroup(id: string): Promise<void> {
  const { error } = await supabase.from("cell_groups").delete().eq("id", id);

  if (error) throw error;
}
