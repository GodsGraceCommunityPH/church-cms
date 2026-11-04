import { AccountActivationError } from "./accountActivation.ts";

export type SetActiveRpcParams = {
  p_auth_user_id: string;
  p_caller_user_id: string;
  p_is_active: boolean;
  p_operation_id: string;
};

function requireId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AccountActivationError(`A ${label} id is required for account activation.`, true);
  }
  return value;
}

/**
 * A missing or null operation ID must never reach the database as an unfenced
 * update. The SQL function also rejects NULL; this guard fails fast at the Edge
 * Function boundary and keeps the contract unit-testable.
 */
export function requireOperationId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AccountActivationError(
      "A fenced account activation operation id is required.",
      true,
    );
  }
  return value;
}

export function buildSetActiveRpcParams(input: {
  authUserId: unknown;
  callerUserId: unknown;
  isActive: unknown;
  operationId: unknown;
}): SetActiveRpcParams {
  const authUserId = requireId(input.authUserId, "target user");
  const callerUserId = requireId(input.callerUserId, "caller user");
  if (typeof input.isActive !== "boolean") {
    throw new AccountActivationError("Account status must be a boolean.", true);
  }
  return {
    p_auth_user_id: authUserId,
    p_caller_user_id: callerUserId,
    p_is_active: input.isActive,
    p_operation_id: requireOperationId(input.operationId),
  };
}
