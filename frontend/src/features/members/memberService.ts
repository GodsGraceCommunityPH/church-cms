import { supabase } from "../../lib/supabase";
import type { Member } from "./member";
import { mapMember } from "./memberMapper";
import { classifyMemberDuplicate } from "./memberDuplicateDetection";
import type { MemberDuplicateKind } from "./memberDuplicateDetection";

export { normalizeMemberMobile, normalizeMemberName } from "./memberDuplicateDetection";
export type { MemberDuplicateKind } from "./memberDuplicateDetection";

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

export interface MemberDuplicateCandidate {
  member: Member;
  kind: MemberDuplicateKind;
  reasons: string[];
}

export interface CreateMemberResult {
  created: boolean;
  matches: MemberDuplicateCandidate[];
}

export async function findPotentialMemberDuplicates(payload: MemberPayload): Promise<Member[]> {
  const { data, error } = await supabase
    .from("members")
    .select(memberWithCellGroup)
    .order("last_name")
    .order("first_name");
  if (error) throw error;
  return (data ?? []).map(mapMember).filter((member) => classifyMemberDuplicate(payload, member) !== null);
}

export async function classifyPotentialMemberDuplicates(
  payload: MemberPayload,
): Promise<MemberDuplicateCandidate[]> {
  const matches = await findPotentialMemberDuplicates(payload);
  return matches.flatMap((member) => {
    const kind = classifyMemberDuplicate(payload, member);
    if (!kind) return [];
    const reasons = kind === "likely_same_person"
      ? ["Similar first name", "Same surname"]
      : ["Same normalized mobile number"];
    return [{ member, kind, reasons }];
  });
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

export async function createMember(
  payload: MemberPayload,
  reviewedMemberIds: string[] = [],
): Promise<CreateMemberResult> {
  const { data, error } = await supabase.rpc("create_member_with_duplicate_check", {
    p_member: payload,
    p_reviewed_member_ids: [...reviewedMemberIds].sort(),
  });

  if (error) {
    throw error;
  }
  const result = data as {
    status?: string;
    candidates?: Array<{ id: string; first_name: string; last_name: string; mobile: string | null; match_kind: MemberDuplicateKind }>;
  } | null;
  return {
    created: result?.status === "created",
    matches: (result?.candidates ?? []).map((candidate) => ({
      member: {
        id: candidate.id,
        firstName: candidate.first_name,
        lastName: candidate.last_name,
        nickname: "",
        gender: "",
        birthday: "",
        membershipStatus: "",
        cellGroupId: "",
        cellGroup: "",
        mobile: candidate.mobile ?? "",
        email: "",
        address: "",
        remarks: "",
      },
      kind: candidate.match_kind,
      reasons: candidate.match_kind === "likely_same_person"
        ? ["Similar first name", "Same surname"]
        : ["Same normalized mobile number"],
    })),
  };
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
