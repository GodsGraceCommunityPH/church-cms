import { supabase } from "../../lib/supabase";

export interface CellGroupRegistrationInput {
  requestId: string;
  inviteToken: string;
  firstName: string;
  lastName: string;
  nickname: string;
  gender: string;
  birthday: string;
  mobile: string;
  email: string;
  address: string;
}

export type RegistrationDecision = "confirm_existing" | "create_new" | null;

export interface CellGroupRegistrationResult {
  status: "needs_confirmation" | "created" | "updated" | "needs_review";
  display_name?: string;
}

export interface ResolvedCellGroupRegistration {
  cell_group_id: string;
  group_name: string;
  current_slug: string;
  is_canonical: boolean;
  registration_token: string;
}

export async function resolveCellGroupRegistrationIdentifier(identifier: string) {
  const { data, error } = await supabase.rpc("resolve_cell_group_registration_identifier", {
    p_identifier: identifier,
  });
  if (error?.code === "PGRST202") {
    const { data: legacyInvite, error: legacyError } = await supabase
      .from("cell_group_invites")
      .select("token,cell_group_id,cell_groups(name)")
      .eq("token", identifier)
      .eq("is_active", true)
      .maybeSingle();

    if (legacyError) throw legacyError;
    if (!legacyInvite) return null;

    const relatedGroup = Array.isArray(legacyInvite.cell_groups)
      ? legacyInvite.cell_groups[0]
      : legacyInvite.cell_groups;

    return {
      cell_group_id: legacyInvite.cell_group_id,
      group_name: relatedGroup?.name ?? "",
      current_slug: identifier,
      is_canonical: true,
      registration_token: legacyInvite.token,
    } satisfies ResolvedCellGroupRegistration;
  }
  if (error) throw error;
  return (data?.[0] as ResolvedCellGroupRegistration | undefined) ?? null;
}

export async function submitCellGroupMemberRegistration(
  input: CellGroupRegistrationInput,
  decision: RegistrationDecision = null,
): Promise<CellGroupRegistrationResult> {
  const { data, error } = await supabase.rpc("submit_cell_group_member_registration", {
    p_request_id: input.requestId,
    p_invite_token: input.inviteToken,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_nickname: input.nickname,
    p_gender: input.gender,
    p_birthday: input.birthday || null,
    p_mobile: input.mobile,
    p_email: input.email,
    p_address: input.address,
    p_match_decision: decision,
  });

  if (error) throw error;
  return data as CellGroupRegistrationResult;
}
