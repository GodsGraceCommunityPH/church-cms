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
