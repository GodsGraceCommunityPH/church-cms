import { supabase } from "../../lib/supabase";
import type { Member } from "./member";
import { mapMember } from "./memberMapper";

const memberWithCellGroup = `
  *,
  cell_group:cell_groups!members_cell_group_id_fkey(
    id,
    name
  )
`;

export interface MemberPayload {
  first_name: string;
  last_name: string;
  nickname: string;
  gender: string;
  birthday: string | null;
  membership_status: string;
  cell_group_id: string | null;
  mobile: string;
  email: string;
  address: string;
  remarks: string;
}

export async function getMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from("members")
    .select(memberWithCellGroup)
    .order("last_name")
    .order("first_name");

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapMember);
}

export async function getMember(id: string): Promise<Member> {
  const { data, error } = await supabase
    .from("members")
    .select(memberWithCellGroup)
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return mapMember(data);
}

export async function createMember(payload: MemberPayload): Promise<void> {
  const { error } = await supabase.from("members").insert(payload);

  if (error) {
    throw error;
  }
}

export async function updateMember(
  id: string,
  payload: MemberPayload,
): Promise<void> {
  const { error } = await supabase.from("members").update(payload).eq("id", id);

  if (error) {
    throw error;
  }
}

// Keep the person and their related records available for future reporting.
export async function deactivateMember(id: string): Promise<void> {
  const { error } = await supabase
    .from("members")
    .update({ membership_status: "Inactive" })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_unreferenced_member", { p_member_id: id });
  if (error) throw error;
}
