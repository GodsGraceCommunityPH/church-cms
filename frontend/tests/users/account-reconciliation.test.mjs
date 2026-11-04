import test from "node:test";
import assert from "node:assert/strict";
import { reconcileAccountActivation } from "../../../supabase/functions/manage-cms-users/reconcileActivation.ts";

const lease = (overrides = {}) => ({
  user_id: "user-1",
  operation_id: "original-operation",
  requested_active: false,
  started_at: new Date(0).toISOString(),
  expires_at: new Date(1).toISOString(),
  status: "uncertain",
  source: "activation",
  reconciliation_id: null,
  reconciliation_started_at: null,
  last_error: null,
  ...overrides,
});

const baseOperations = (overrides = {}) => ({
  claim: async () => ({
    claimed: true,
    reason: null,
    leaseState: "uncertain",
    synthetic: false,
    lease: lease(),
  }),
  readAuthBanned: async () => false,
  readDatabaseActive: async () => true,
  setAuthBanned: async () => {},
  finalize: async () => ({ verified: true, released: true, alreadyFinalized: false, reason: null }),
  ...overrides,
});

test("reconciliation refuses to take ownership of a live activation", async () => {
  let reads = 0;
  let repairs = 0;
  let finalizations = 0;
  const result = await reconcileAccountActivation("user-1", baseOperations({
    claim: async () => ({
      claimed: false,
      reason: "live_operation",
      leaseState: "live",
      lease: lease({ status: "started", expires_at: new Date(Date.now() + 30_000).toISOString() }),
    }),
    readAuthBanned: async () => { reads += 1; return false; },
    readDatabaseActive: async () => { reads += 1; return true; },
    setAuthBanned: async () => { repairs += 1; },
    finalize: async () => { finalizations += 1; return { verified: true, released: true }; },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.state, "blocked");
  assert.equal(result.leaseState, "live");
  assert.equal(result.claimed, false);
  assert.equal(reads, 0);
  assert.equal(repairs, 0);
  assert.equal(finalizations, 0);
});

test("reconciliation refuses to steal another reconciliation's claim", async () => {
  const result = await reconcileAccountActivation("user-1", baseOperations({
    claim: async () => ({
      claimed: false,
      reason: "reconciliation_in_progress",
      leaseState: "uncertain",
      lease: lease({ reconciliation_id: "another-reconciliation" }),
    }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.state, "blocked");
  assert.equal(result.leaseState, "uncertain");
  assert.match(result.message, /another reconciliation/i);
});

test("reconciliation claims an expired unresolved operation and releases it when consistent", async () => {
  let finalized = null;
  const result = await reconcileAccountActivation("user-1", baseOperations({
    finalize: async (input) => {
      finalized = input;
      return { verified: true, released: true, alreadyFinalized: false, reason: null };
    },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.state, "consistent");
  assert.equal(result.reconciled, true);
  assert.equal(result.released, true);
  assert.equal(result.originalOperationId, "original-operation");
  assert.notEqual(result.reconciliationId, "original-operation");
  assert.equal(finalized.verified, true);
  assert.equal(finalized.expectedActive, true);
});

test("reconciliation repairs an inconsistent Auth/CMS state and verifies before release", async () => {
  const authReads = [true, false];
  const repairs = [];
  let finalized = null;
  const result = await reconcileAccountActivation("user-1", baseOperations({
    readAuthBanned: async () => authReads.shift(),
    readDatabaseActive: async () => true,
    setAuthBanned: async (_userId, banned) => { repairs.push(banned); },
    finalize: async (input) => {
      finalized = input;
      return { verified: true, released: true, alreadyFinalized: false, reason: null };
    },
  }));

  assert.deepEqual(repairs, [false]);
  assert.deepEqual(authReads, []);
  assert.equal(result.ok, true);
  assert.equal(result.state, "consistent");
  assert.equal(result.reconciled, true);
  assert.equal(result.released, true);
  assert.equal(finalized.verified, true);
  assert.equal(finalized.expectedActive, true);
});

test("a delayed Auth result observed after repair prevents lease release", async () => {
  const authReads = [true, true];
  let finalized = null;
  const result = await reconcileAccountActivation("user-1", baseOperations({
    readAuthBanned: async () => authReads.shift(),
    readDatabaseActive: async () => true,
    setAuthBanned: async () => {},
    finalize: async (input) => {
      finalized = input;
      return { verified: false, released: false, reason: "not_verified" };
    },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.state, "inconsistent");
  assert.equal(result.consistent, false);
  assert.equal(result.released, false);
  assert.equal(finalized.verified, false);
  assert.match(result.message, /delayed Auth result|preserved/i);
});

test("a CMS change during finalization keeps the uncertain lease", async () => {
  let finalized = null;
  const result = await reconcileAccountActivation("user-1", baseOperations({
    finalize: async (input) => {
      finalized = input;
      return { verified: false, released: false, reason: "cms_state_changed" };
    },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.state, "inconsistent");
  assert.equal(result.released, false);
  assert.equal(finalized.verified, true);
  assert.match(result.message, /cms_state_changed/);
});

test("unreadable Auth state records diagnostics and preserves the lease", async () => {
  let finalized = null;
  const result = await reconcileAccountActivation("user-1", baseOperations({
    readAuthBanned: async () => { throw new Error("Auth is unavailable"); },
    finalize: async (input) => {
      finalized = input;
      return { verified: false, released: false, reason: "not_verified" };
    },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.state, "unreadable");
  assert.equal(result.released, false);
  assert.equal(finalized.verified, false);
  assert.match(result.message, /Auth is unavailable/);
});

test("a failed lease claim is reported without reading or modifying account state", async () => {
  let reads = 0;
  let finalizations = 0;
  const result = await reconcileAccountActivation("user-1", baseOperations({
    claim: async () => { throw new Error("lease query failed"); },
    readAuthBanned: async () => { reads += 1; return false; },
    readDatabaseActive: async () => { reads += 1; return true; },
    finalize: async () => { finalizations += 1; return { verified: true, released: true }; },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.state, "unreadable");
  assert.equal(result.claimed, false);
  assert.match(result.message, /lease query failed/);
  assert.equal(reads, 0);
  assert.equal(finalizations, 0);
});

test("repeated reconciliation requests are idempotent", async () => {
  let finalizations = 0;
  const operations = baseOperations({
    claim: async () => ({
      claimed: true,
      reason: null,
      leaseState: "missing",
      synthetic: true,
      lease: lease({
        operation_id: "reconciliation-placeholder",
        source: "reconciliation",
      }),
    }),
    finalize: async () => {
      finalizations += 1;
      return { verified: true, released: true, alreadyFinalized: finalizations > 1, reason: null };
    },
  });

  const first = await reconcileAccountActivation("user-1", operations);
  const second = await reconcileAccountActivation("user-1", operations);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.state, "consistent");
  assert.equal(second.state, "consistent");
  assert.equal(finalizations, 2);
  assert.equal(second.synthetic, true);
});
