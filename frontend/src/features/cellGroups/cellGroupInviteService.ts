import { supabase } from "../../lib/supabase";

export async function getInvite(cellGroupId: string) {
  return await supabase
    .from("cell_group_invites")
    .select("*")
    .eq("cell_group_id", cellGroupId)
    .maybeSingle();
}

export async function createInvite(cellGroupId: string, token: string) {
  return await supabase
    .from("cell_group_invites")
    .insert({
      cell_group_id: cellGroupId,
      token,
    })
    .select()
    .single();
}
