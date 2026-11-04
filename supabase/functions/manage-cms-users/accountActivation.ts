export type AccountActivationOperations = {
  readDatabaseActive: (userId: string) => Promise<boolean>;
  setAuthBanned: (userId: string, banned: boolean) => Promise<void>;
  setDatabaseActive: (userId: string, isActive: boolean) => Promise<void>;
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
  await operations.readDatabaseActive(userId);
  try {
    await operations.setAuthBanned(userId, !isActive);
  } catch {
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
}
