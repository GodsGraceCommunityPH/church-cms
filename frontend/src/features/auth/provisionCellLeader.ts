import { supabase } from "../../lib/supabase";

export interface ProvisionCellLeaderInput {
  name: string;
  email: string;
  password?: string;
  cellGroupId: string;
}

export interface ProvisionedCellLeader {
  ok: boolean;
  created?: boolean;
  reason?: string;
  userId?: string;
  email?: string;
  error?: string;
}

export async function provisionCellLeader(
  input: ProvisionCellLeaderInput,
): Promise<ProvisionedCellLeader> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    created?: boolean;
    reason?: string;
    userId?: string;
    email?: string;
    error?: string;
  }>("provision-cell-leader", { body: input });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as ProvisionedCellLeader | null;
  if (!result) {
    return { ok: false, error: "Empty response from provisioning service." };
  }

  return {
    ok: Boolean(result.ok),
    created: result.created,
    reason: result.reason,
    userId: result.userId,
    email: result.email,
    error: result.error,
  };
}
