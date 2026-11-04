export type AccountActivationLease = {
  user_id: string;
  operation_id: string;
  requested_active: boolean;
  started_at: string;
  expires_at: string;
  status: string;
  source?: string;
  reconciliation_id?: string | null;
  reconciliation_started_at?: string | null;
  last_error?: string | null;
};

export type ReconciliationClaim = {
  claimed: boolean;
  reason?: string | null;
  leaseState?: string | null;
  synthetic?: boolean;
  lease?: AccountActivationLease | null;
};

export type ReconciliationFinalizeResult = {
  verified: boolean;
  released: boolean;
  alreadyFinalized?: boolean;
  reason?: string | null;
};

export type AccountReconciliationOperations = {
  /** Atomically claim the unresolved lease in the database. */
  claim: (userId: string, reconciliationId: string) => Promise<ReconciliationClaim>;
  readAuthBanned: (userId: string) => Promise<boolean>;
  readDatabaseActive: (userId: string) => Promise<boolean>;
  setAuthBanned: (userId: string, banned: boolean) => Promise<void>;
  finalize: (input: {
    userId: string;
    reconciliationId: string;
    verified: boolean;
    expectedActive: boolean | null;
    message?: string;
  }) => Promise<ReconciliationFinalizeResult>;
};

export type AccountReconciliationState =
  | "consistent"
  | "inconsistent"
  | "unreadable"
  | "blocked";

export type AccountReconciliationLeaseState =
  | "missing"
  | "live"
  | "uncertain"
  | "claimed"
  | "unknown";

export type AccountReconciliationResult = {
  ok: boolean;
  state: AccountReconciliationState;
  leaseState: AccountReconciliationLeaseState;
  synthetic: boolean;
  claimed: boolean;
  consistent: boolean | null;
  reconciled: boolean;
  released: boolean;
  authBanned: boolean | null;
  databaseActive: boolean | null;
  originalOperationId: string | null;
  reconciliationId: string;
  lease: AccountActivationLease | null;
  message: string | null;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error.";

async function finalizeSafely(
  operations: AccountReconciliationOperations,
  input: {
    userId: string;
    reconciliationId: string;
    verified: boolean;
    expectedActive: boolean | null;
    message?: string;
  },
): Promise<ReconciliationFinalizeResult> {
  try {
    return await operations.finalize(input);
  } catch (error) {
    return {
      verified: false,
      released: false,
      alreadyFinalized: false,
      reason: `finalize_error: ${messageOf(error)}`,
    };
  }
}

/**
 * Reconcile one unresolved account activation.
 *
 * Recovery rule: the persisted CMS `users.is_active` value is authoritative. The
 * Supabase Auth ban is aligned to `!is_active`. The rule is only applied after
 * an atomic database claim. A live activation is never claimed, and an
 * uncertain row is never released until both states have been re-read and
 * verified.
 *
 * Limitation: a ban request already sent to Supabase Auth cannot be cancelled by
 * database fencing. If it lands after this function's final verification, Auth
 * can diverge again. The CMS state remains authoritative and a later
 * reconciliation repairs it. This is not a cross-system atomic transaction.
 */
export async function reconcileAccountActivation(
  userId: string,
  operations: AccountReconciliationOperations,
): Promise<AccountReconciliationResult> {
  const reconciliationId = crypto.randomUUID();
  const base: AccountReconciliationResult = {
    ok: false,
    state: "unreadable",
    leaseState: "unknown",
    synthetic: false,
    claimed: false,
    consistent: null,
    reconciled: false,
    released: false,
    authBanned: null,
    databaseActive: null,
    originalOperationId: null,
    reconciliationId,
    lease: null,
    message: null,
  };

  let claim: ReconciliationClaim;
  try {
    claim = await operations.claim(userId, reconciliationId);
  } catch (error) {
    return {
      ...base,
      message: `Unable to read or claim the activation lease: ${messageOf(error)}`,
    };
  }

  if (!claim.claimed) {
    const reason = claim.reason ?? "unknown";
    const leaseState: AccountReconciliationLeaseState =
      reason === "live_operation"
        ? "live"
        : reason === "reconciliation_in_progress"
          ? "uncertain"
          : "unknown";
    const message =
      reason === "live_operation"
        ? "A live activation operation still owns this account. Reconciliation did not claim it or modify any state."
        : reason === "reconciliation_in_progress"
          ? "Another reconciliation currently owns this account. Retry after its claim window expires."
          : `The activation lease could not be claimed (${reason}).`;
    return {
      ...base,
      state: "blocked",
      leaseState,
      lease: claim.lease ?? null,
      originalOperationId: claim.lease?.operation_id ?? null,
      message,
    };
  }

  const lease = claim.lease ?? null;
  const leaseState: AccountReconciliationLeaseState =
    claim.leaseState === "missing" || claim.leaseState === "live" || claim.leaseState === "uncertain"
      ? claim.leaseState
      : lease
        ? "uncertain"
        : "missing";
  const synthetic = claim.synthetic === true;
  const originalOperationId = synthetic ? null : (lease?.operation_id ?? null);

  let authBanned: boolean | null = null;
  let databaseActive: boolean | null = null;
  let authError: string | null = null;
  let databaseError: string | null = null;

  try {
    authBanned = await operations.readAuthBanned(userId);
  } catch (error) {
    authError = messageOf(error);
  }
  try {
    databaseActive = await operations.readDatabaseActive(userId);
  } catch (error) {
    databaseError = messageOf(error);
  }

  if (authBanned === null || databaseActive === null) {
    const reason =
      [authError, databaseError].filter(Boolean).join(" ") ||
      "Unable to read the current Auth or CMS state.";
    const finalized = await finalizeSafely(operations, {
      userId,
      reconciliationId,
      verified: false,
      expectedActive: null,
      message: reason,
    });
    return {
      ...base,
      claimed: true,
      state: "unreadable",
      leaseState,
      synthetic,
      lease,
      originalOperationId,
      authBanned,
      databaseActive,
      released: finalized.released,
      message: reason,
    };
  }

  let consistent = authBanned === !databaseActive;
  let repaired = false;

  if (!consistent) {
    try {
      await operations.setAuthBanned(userId, !databaseActive);
      repaired = true;
    } catch (error) {
      const reason = `Auth repair failed: ${messageOf(error)}`;
      const finalized = await finalizeSafely(operations, {
        userId,
        reconciliationId,
        verified: false,
        expectedActive: null,
        message: reason,
      });
      return {
        ...base,
        claimed: true,
        state: "inconsistent",
        leaseState,
        synthetic,
        lease,
        originalOperationId,
        authBanned,
        databaseActive,
        consistent: false,
        released: finalized.released,
        message: reason,
      };
    }

    // Re-read both sides. A delayed Auth result or a concurrent CMS change must
    // be observed before the uncertain lease is released.
    try {
      authBanned = await operations.readAuthBanned(userId);
    } catch (error) {
      authBanned = null;
      authError = messageOf(error);
    }
    try {
      databaseActive = await operations.readDatabaseActive(userId);
    } catch (error) {
      databaseActive = null;
      databaseError = messageOf(error);
    }
  }

  if (authBanned === null || databaseActive === null) {
    const reason =
      [authError, databaseError].filter(Boolean).join(" ") ||
      "Unable to verify the final Auth and CMS state.";
    const finalized = await finalizeSafely(operations, {
      userId,
      reconciliationId,
      verified: false,
      expectedActive: null,
      message: reason,
    });
    return {
      ...base,
      claimed: true,
      state: "unreadable",
      leaseState,
      synthetic,
      lease,
      originalOperationId,
      authBanned,
      databaseActive,
      consistent: null,
      released: finalized.released,
      message: reason,
    };
  }

  consistent = authBanned === !databaseActive;
  if (!consistent) {
    const reason =
      "Reconciliation could not verify a consistent Auth/CMS state. A delayed Auth result or a concurrent CMS change may have won; the uncertain lease was preserved.";
    const finalized = await finalizeSafely(operations, {
      userId,
      reconciliationId,
      verified: false,
      expectedActive: null,
      message: reason,
    });
    return {
      ...base,
      claimed: true,
      state: "inconsistent",
      leaseState,
      synthetic,
      lease,
      originalOperationId,
      authBanned,
      databaseActive,
      consistent: false,
      released: finalized.released,
      message: reason,
    };
  }

  const finalized = await finalizeSafely(operations, {
    userId,
    reconciliationId,
    verified: true,
    expectedActive: databaseActive,
    message: repaired
      ? "Auth ban repaired to match the persisted CMS status."
      : "Auth and CMS state were already consistent.",
  });

  if (!finalized.verified || !finalized.released) {
    return {
      ...base,
      claimed: true,
      state: "inconsistent",
      leaseState,
      synthetic,
      lease,
      originalOperationId,
      authBanned,
      databaseActive,
      consistent: true,
      released: false,
      message: finalized.reason
        ? `Final verification failed (${finalized.reason}); the uncertain lease was preserved.`
        : "Final verification failed; the uncertain lease was preserved.",
    };
  }

  return {
    ...base,
    ok: true,
    claimed: true,
    state: "consistent",
    leaseState,
    synthetic,
    lease,
    originalOperationId,
    authBanned,
    databaseActive,
    consistent: true,
    reconciled: true,
    released: true,
    message: repaired
      ? "Auth ban was repaired to match the persisted CMS status and the lease was released."
      : "Auth and CMS state were already consistent and the lease was released.",
  };
}
