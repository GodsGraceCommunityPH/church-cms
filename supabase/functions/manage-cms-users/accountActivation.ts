export type AccountActivationOperations = {
  readDatabaseActive: (userId: string) => Promise<boolean>;
  setAuthBanned: (userId: string, banned: boolean) => Promise<void>;
  setDatabaseActive: (userId: string, isActive: boolean) => Promise<void>;
  // Optional cross-instance serialization helpers.
  acquireLease?: (userId: string, operationId: string) => Promise<boolean>;
  releaseLease?: (userId: string, operationId: string, status: "completed" | "failed" | "uncertain", error?: string) => Promise<void>;
  // Optional reconciliation helper for ambiguous Auth outcomes.
  readAuthBanned?: (userId: string) => Promise<boolean>;
};

export class AccountActivationError extends Error {
  readonly uncertain: boolean;
  constructor(message: string, uncertain = false) {
    super(message);
    this.uncertain = uncertain;
  }
}

/** Keep the Auth ban and CMS active flag aligned, compensating after DB failure. */
export async function synchronizeAccountActivation(
  userId: string,
  isActive: boolean,
  operations: AccountActivationOperations,
): Promise<void> {
  const operationId = crypto.randomUUID();
  let leaseHeld = false;

  if (operations.acquireLease) {
    const acquired = await operations.acquireLease(userId, operationId);
    if (!acquired) {
      throw new AccountActivationError("Account activation is already in progress. Try again shortly.", true);
    }
    leaseHeld = true;
  }

  try {
    const persisted = await operations.readDatabaseActive(userId);
    try {
      await operations.setAuthBanned(userId, !isActive);
    } catch {
      // Reconcile an ambiguous Auth outcome by reading the actual ban state.
      if (operations.readAuthBanned) {
        try {
          const actualBanned = await operations.readAuthBanned(userId);
          await operations.setDatabaseActive(userId, !actualBanned);
          throw new AccountActivationError("Auth access could not be confirmed; CMS status was reconciled to the Auth state.", true);
        } catch (reconciliationError) {
          if (reconciliationError instanceof AccountActivationError) throw reconciliationError;
        }
      }
      throw new AccountActivationError("Auth access could not be updated; CMS status was left unchanged.");
    }

    try {
      await operations.setDatabaseActive(userId, isActive);
    } catch {
      try {
        const persistedIsActive = await operations.readDatabaseActive(userId);
        await operations.setAuthBanned(userId, !persistedIsActive);
      } catch {
        throw new AccountActivationError("Status outcome is uncertain. Reconcile the user row and Auth ban state.", true);
      }
      throw new AccountActivationError("Database rejected the status change; Auth access was restored to match the CMS status.");
    }
  } finally {
    if (leaseHeld && operations.releaseLease) {
      try {
        await operations.releaseLease(userId, operationId, "completed");
      } catch {
        // Best-effort release; lease expiry provides recovery.
      }
    }
  }
}
