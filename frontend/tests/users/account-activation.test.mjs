import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AccountActivationError,
  synchronizeAccountActivation,
} from "../../../supabase/functions/manage-cms-users/accountActivation.ts";
import { buildSetActiveRpcParams } from "../../../supabase/functions/manage-cms-users/activationRpc.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const baseOperations = (overrides = {}) => ({
  readDatabaseActive: async () => true,
  setAuthBanned: async () => {},
  setDatabaseActive: async () => {},
  ...overrides,
});

test("dedicated activation updates Auth then CMS", async () => {
  const events = [];
  await synchronizeAccountActivation("user-1", false, {
    readDatabaseActive: async () => { events.push("read"); return true; },
    setAuthBanned: async (_id, banned) => { events.push(`auth:${banned}`); },
    setDatabaseActive: async (_id, active) => { events.push(`db:${active}`); },
  });
  assert.deepEqual(events, ["read", "auth:true", "db:false"]);
});

test("failed CMS activation transition restores Auth to persisted status", async () => {
  const authStates = [];
  await assert.rejects(() => synchronizeAccountActivation("user-1", false, {
    readDatabaseActive: async () => true,
    setAuthBanned: async (_id, banned) => authStates.push(banned),
    setDatabaseActive: async () => { throw new Error("safeguard denied"); },
  }), (error) => error instanceof AccountActivationError && !error.uncertain);
  assert.deepEqual(authStates, [true, false]);
});

test("profile edits preserve activation and dedicated status actions use synchronization", async () => {
  const handler = await read("../../../supabase/functions/manage-cms-users/index.ts");
  const migration = await read("../../../supabase/migrations/20261104110000_security_review_fixes.sql");
  const page = await read("../../src/pages/admin/UserManagement.tsx");
  assert.match(handler, /p_is_active: creating \? true : existingActive/);
  assert.match(migration, /member_id=excluded\.member_id,updated_at=now\(\)/);
  assert.doesNotMatch(page, /action: "update"[^\n]*isActive/);
  assert.match(handler, /synchronizeAccountActivation/);
  assert.match(handler, /action === "set-active"/);
});

test("the generated operation id is passed to every fenced database update", async () => {
  const databaseUpdates = [];
  let leasedOperationId;
  await synchronizeAccountActivation("user-1", false, baseOperations({
    acquireLease: async (_userId, operationId) => {
      leasedOperationId = operationId;
      return true;
    },
    renewLease: async () => true,
    releaseLease: async () => true,
    setDatabaseActive: async (_userId, active, operationId) => {
      databaseUpdates.push({ active, operationId });
    },
  }));

  assert.match(leasedOperationId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.deepEqual(databaseUpdates, [{ active: false, operationId: leasedOperationId }]);
});

test("the RPC payload carries the fenced operation id", () => {
  const params = buildSetActiveRpcParams({
    authUserId: "user-1",
    callerUserId: "caller-1",
    isActive: true,
    operationId: "operation-1",
  });
  assert.deepEqual(params, {
    p_auth_user_id: "user-1",
    p_caller_user_id: "caller-1",
    p_is_active: true,
    p_operation_id: "operation-1",
  });
});

test("a missing operation id is rejected before the RPC", () => {
  assert.throws(
    () => buildSetActiveRpcParams({
      authUserId: "user-1",
      callerUserId: "caller-1",
      isActive: true,
    }),
    (error) => error instanceof AccountActivationError && /operation id/i.test(error.message),
  );
});

test("a null operation id is rejected before the RPC", () => {
  assert.throws(
    () => buildSetActiveRpcParams({
      authUserId: "user-1",
      callerUserId: "caller-1",
      isActive: true,
      operationId: null,
    }),
    (error) => error instanceof AccountActivationError && /operation id/i.test(error.message),
  );
});

test("long-running Auth requests renew the lease while in flight", async () => {
  let renewals = 0;
  const events = [];
  await synchronizeAccountActivation("user-1", false, {
    leaseTtlSeconds: 5,
    renewalIntervalMs: 10,
    readDatabaseActive: async () => true,
    acquireLease: async () => true,
    renewLease: async () => {
      renewals += 1;
      events.push("renew");
      return true;
    },
    releaseLease: async () => true,
    setAuthBanned: async () => {
      events.push("auth:start");
      await delay(45);
      events.push("auth:end");
    },
    setDatabaseActive: async (_userId, _active, operationId) => {
      events.push(`db:${operationId ? "fenced" : "unfenced"}`);
    },
  });

  assert.ok(renewals >= 3, `expected heartbeat renewals, observed ${renewals}`);
  assert.deepEqual(events.filter((event) => event.startsWith("db:")), ["db:fenced"]);
});

test("a lease lost during a long Auth request prevents the database update", async () => {
  let renewals = 0;
  let databaseUpdates = 0;
  await assert.rejects(
    () => synchronizeAccountActivation("user-1", false, {
      leaseTtlSeconds: 5,
      renewalIntervalMs: 10,
      readDatabaseActive: async () => true,
      acquireLease: async () => true,
      renewLease: async () => {
        renewals += 1;
        return renewals === 1;
      },
      releaseLease: async () => true,
      setAuthBanned: async () => { await delay(45); },
      setDatabaseActive: async () => { databaseUpdates += 1; },
    }),
    (error) => error instanceof AccountActivationError && error.uncertain,
  );

  assert.equal(databaseUpdates, 0);
});

test("an ambiguous Auth timeout that actually landed continues to the fenced CMS update", async () => {
  const databaseUpdates = [];
  await synchronizeAccountActivation("user-1", false, baseOperations({
    acquireLease: async () => true,
    renewLease: async () => true,
    releaseLease: async () => true,
    readDatabaseActive: async () => true,
    setAuthBanned: async () => { throw new Error("Auth request timed out"); },
    readAuthBanned: async () => true,
    setDatabaseActive: async (_userId, active, operationId) => {
      databaseUpdates.push({ active, operationId });
    },
  }));

  assert.equal(databaseUpdates.length, 1);
  assert.equal(databaseUpdates[0].active, false);
});

test("an ambiguous Auth timeout with an unconfirmed state is preserved as uncertain", async () => {
  let databaseUpdates = 0;
  let releaseStatus = null;
  await assert.rejects(
    () => synchronizeAccountActivation("user-1", false, baseOperations({
      acquireLease: async () => true,
      renewLease: async () => true,
      releaseLease: async (_userId, _operationId, status) => { releaseStatus = status; return true; },
      setAuthBanned: async () => { throw new Error("Auth request timed out"); },
      readAuthBanned: async () => false,
      setDatabaseActive: async () => { databaseUpdates += 1; },
    })),
    (error) => error instanceof AccountActivationError && error.uncertain,
  );

  assert.equal(databaseUpdates, 0);
  assert.equal(releaseStatus, "uncertain");
});

test("an unreadable Auth state after a timeout is uncertain and blocks the CMS update", async () => {
  let databaseUpdates = 0;
  await assert.rejects(
    () => synchronizeAccountActivation("user-1", false, baseOperations({
      setAuthBanned: async () => { throw new Error("Auth request timed out"); },
      readAuthBanned: async () => { throw new Error("Auth read also timed out"); },
      setDatabaseActive: async () => { databaseUpdates += 1; },
    })),
    (error) => error instanceof AccountActivationError && error.uncertain,
  );
  assert.equal(databaseUpdates, 0);
});

test("a database timeout whose update committed is accepted as completed", async () => {
  let reads = 0;
  const authStates = [];
  let releaseStatus = null;
  await synchronizeAccountActivation("user-1", false, baseOperations({
    acquireLease: async () => true,
    renewLease: async () => true,
    releaseLease: async (_userId, _operationId, status) => { releaseStatus = status; return true; },
    readDatabaseActive: async () => {
      reads += 1;
      return reads === 1 ? true : false;
    },
    setAuthBanned: async (_userId, banned) => { authStates.push(banned); },
    setDatabaseActive: async () => { throw new Error("Database response timed out"); },
  }));

  assert.deepEqual(authStates, [true]);
  assert.equal(releaseStatus, "completed");
});

test("a database timeout whose update did not commit compensates Auth and reports failure", async () => {
  const authStates = [];
  let releaseStatus = null;
  await assert.rejects(
    () => synchronizeAccountActivation("user-1", false, baseOperations({
      acquireLease: async () => true,
      renewLease: async () => true,
      releaseLease: async (_userId, _operationId, status) => { releaseStatus = status; return true; },
      readDatabaseActive: async () => true,
      setAuthBanned: async (_userId, banned) => { authStates.push(banned); },
      setDatabaseActive: async () => { throw new Error("Database rejected the update"); },
    })),
    (error) => error instanceof AccountActivationError && !error.uncertain,
  );

  assert.deepEqual(authStates, [true, false]);
  assert.equal(releaseStatus, "failed");
});

test("failed Auth compensation preserves an uncertain lease", async () => {
  let releaseStatus = null;
  let authCalls = 0;
  await assert.rejects(
    () => synchronizeAccountActivation("user-1", false, baseOperations({
      acquireLease: async () => true,
      renewLease: async () => true,
      releaseLease: async (_userId, _operationId, status) => { releaseStatus = status; return true; },
      readDatabaseActive: async () => true,
      setAuthBanned: async () => {
        authCalls += 1;
        if (authCalls > 1) throw new Error("Compensation failed");
      },
      setDatabaseActive: async () => { throw new Error("Database rejected the update"); },
    })),
    (error) => error instanceof AccountActivationError && error.uncertain,
  );

  assert.equal(releaseStatus, "uncertain");
});

test("concurrent activation requests for the same user are serialized by the lease", async () => {
  let held = false;
  let databaseUpdates = 0;
  let resolveAcquired;
  const acquired = new Promise((resolve) => { resolveAcquired = resolve; });

  const first = synchronizeAccountActivation("user-1", false, baseOperations({
    acquireLease: async () => {
      if (held) return false;
      held = true;
      resolveAcquired();
      return true;
    },
    renewLease: async () => true,
    releaseLease: async () => { held = false; return true; },
    setAuthBanned: async () => { await delay(30); },
    setDatabaseActive: async () => { databaseUpdates += 1; },
  }));

  await acquired;

  await assert.rejects(
    () => synchronizeAccountActivation("user-1", true, baseOperations({
      acquireLease: async () => (held ? false : ((held = true), true)),
      renewLease: async () => true,
      releaseLease: async () => { held = false; return true; },
      setDatabaseActive: async () => { databaseUpdates += 1; },
    })),
    (error) => error instanceof AccountActivationError && error.uncertain,
  );

  await first;
  assert.equal(databaseUpdates, 1);
});

test("an expired or unreconciled lease cannot be silently replaced", async () => {
  let authCalls = 0;
  let databaseCalls = 0;
  await assert.rejects(
    () => synchronizeAccountActivation("user-1", true, baseOperations({
      acquireLease: async () => false,
      setAuthBanned: async () => { authCalls += 1; },
      setDatabaseActive: async () => { databaseCalls += 1; },
    })),
    (error) => error instanceof AccountActivationError && error.uncertain,
  );
  assert.equal(authCalls, 0);
  assert.equal(databaseCalls, 0);
});

test("migration removes the unfenced three-argument RPC and requires a fenced operation id", async () => {
  const migration = await read("../../../supabase/migrations/20261105000000_account_activation_leases.sql");

  assert.match(
    migration,
    /drop function if exists public\.admin_user_set_active\(uuid,\s*uuid,\s*boolean\)/i,
  );

  const signature = migration.match(
    /create or replace function public\.admin_user_set_active\(([\s\S]*?)\)\s*returns/i,
  );
  assert.ok(signature, "fenced admin_user_set_active definition is missing");
  assert.match(signature[1], /p_operation_id uuid/);
  assert.doesNotMatch(signature[1], /p_operation_id uuid\s+default/i);

  assert.match(migration, /for update/i);
  assert.match(migration, /reconciliation_id is null/i);
  assert.match(
    migration,
    /grant execute on function public\.admin_user_set_active\(uuid,\s*uuid,\s*boolean,\s*uuid\) to service_role/i,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.admin_user_set_active\(uuid,\s*uuid,\s*boolean\)\s+to/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.claim_account_activation_reconciliation\(uuid,\s*uuid,\s*boolean,\s*integer\) to service_role/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.finalize_account_activation_reconciliation\(uuid,\s*uuid,\s*boolean,\s*boolean,\s*text\) to service_role/i,
  );
});
