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
  mobile: string | null;
  email: string | null;
  address: string;
  remarks: string;
}

export function getMemberSaveError(error: unknown): string {
  const databaseError = error as { code?: string; message?: string };

  if (databaseError.code === "23505") {
    return "A member already uses this email or mobile number. Check the existing member list before trying again.";
  }

  if (databaseError.code === "23503") {
    return "The selected Cell Group is no longer available. Clear the Cell Group selection and try again.";
  }

  if (databaseError.code === "42501" || databaseError.code === "PGRST301") {
    return databaseError.message
      ? `Member save was rejected (${databaseError.code}): ${databaseError.message}`
      : `Member save was rejected (${databaseError.code}). Sign out, sign back in, and try again.`;
  }

  if (databaseError.code === "23514" || databaseError.code === "22P02") {
    return databaseError.message
      ? `One of the member details is invalid: ${databaseError.message}`
      : "One of the member details is invalid. Review the form and try again.";
  }

  return databaseError.message
    ? `Unable to save the member: ${databaseError.message}`
    : "Unable to save the member. Please try again.";
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
