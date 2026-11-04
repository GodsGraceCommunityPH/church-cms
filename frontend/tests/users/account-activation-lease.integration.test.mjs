import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.ACTIVATION_TEST_SUPABASE_URL;
const serviceKey = process.env.ACTIVATION_TEST_SUPABASE_SERVICE_ROLE_KEY;
const testUserId = process.env.ACTIVATION_TEST_USER_ID;
const callerUserId = process.env.ACTIVATION_TEST_CALLER_USER_ID;

const missing = [
  !url && "ACTIVATION_TEST_SUPABASE_URL",
  !serviceKey && "ACTIVATION_TEST_SUPABASE_SERVICE_ROLE_KEY",
  !testUserId && "ACTIVATION_TEST_USER_ID",
  !callerUserId && "ACTIVATION_TEST_CALLER_USER_ID",
].filter(Boolean);

const skip = missing.length > 0
  ? `requires a disposable Supabase project: missing ${missing.join(", ")}`
  : false;

const client = skip ? null : createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const opId = () => crypto.randomUUID();

async function clearLease(userId) {
  if (!client) return;
  await client.from("account_activation_leases").delete().eq("user_id", userId);
}

async function expireLease(userId) {
  const { error } = await client
    .from("account_activation_leases")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("user_id", userId);
  assert.equal(error, null);
}

test("disposable Supabase activation lease suite", { skip }, async (t) => {
  assert.ok(client);

  const original = await client.from("users").select("is_active").eq("id", testUserId).maybeSingle();
  assert.equal(original.error, null);
  assert.ok(original.data, "ACTIVATION_TEST_USER_ID must exist in the disposable project");
  const originalActive = original.data.is_active === true;

  t.after(async () => {
    // Best-effort cleanup; the project is disposable.
    await clearLease(testUserId);
  });

  await t.test("the correct operation acquires and renews the lease", async () => {
    await clearLease(testUserId);
    const operation = opId();
    const acquired = await client.rpc("acquire_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: operation,
      p_requested_active: originalActive,
      p_ttl_seconds: 30,
    });
    assert.equal(acquired.error, null);
    assert.equal(acquired.data, true);

    const renewed = await client.rpc("renew_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: operation,
      p_ttl_seconds: 30,
    });
    assert.equal(renewed.error, null);
    assert.equal(renewed.data, true);

    const released = await client.rpc("release_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: operation,
      p_status: "completed",
      p_error: null,
    });
    assert.equal(released.error, null);
    assert.equal(released.data, true);
  });

  await t.test("concurrent requests for the same user serialize on the lease", async () => {
    await clearLease(testUserId);
    const first = opId();
    const second = opId();
    const [a, b] = await Promise.all([
      client.rpc("acquire_account_activation_lease", {
        p_user_id: testUserId,
        p_operation_id: first,
        p_requested_active: originalActive,
        p_ttl_seconds: 30,
      }),
      client.rpc("acquire_account_activation_lease", {
        p_user_id: testUserId,
        p_operation_id: second,
        p_requested_active: originalActive,
        p_ttl_seconds: 30,
      }),
    ]);
    assert.equal(a.error, null);
    assert.equal(b.error, null);
    assert.equal([a.data, b.data].filter(Boolean).length, 1);

    const owner = a.data === true ? first : second;
    await client.rpc("release_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: owner,
      p_status: "completed",
      p_error: null,
    });
  });

  await t.test("a wrong operation id cannot mutate CMS status", async () => {
    await clearLease(testUserId);
    const operation = opId();
    await client.rpc("acquire_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: operation,
      p_requested_active: !originalActive,
      p_ttl_seconds: 30,
    });

    const wrong = await client.rpc("admin_user_set_active", {
      p_auth_user_id: testUserId,
      p_caller_user_id: callerUserId,
      p_is_active: !originalActive,
      p_operation_id: opId(),
    });
    assert.ok(wrong.error, "a wrong operation id must be rejected");

    await client.rpc("release_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: operation,
      p_status: "completed",
      p_error: null,
    });
  });

  await t.test("the old three-argument RPC cannot bypass fencing", async () => {
    const result = await client.rpc("admin_user_set_active", {
      p_auth_user_id: testUserId,
      p_caller_user_id: callerUserId,
      p_is_active: !originalActive,
    });
    assert.ok(result.error, "the unfenced overload must not exist");
  });

  await t.test("an expired lease cannot mutate CMS status", async () => {
    await clearLease(testUserId);
    const operation = opId();
    await client.rpc("acquire_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: operation,
      p_requested_active: !originalActive,
      p_ttl_seconds: 30,
    });
    await expireLease(testUserId);

    const result = await client.rpc("admin_user_set_active", {
      p_auth_user_id: testUserId,
      p_caller_user_id: callerUserId,
      p_is_active: !originalActive,
      p_operation_id: operation,
    });
    assert.ok(result.error, "an expired lease must be rejected");

    await clearLease(testUserId);
  });

  await t.test("the correct operation id updates CMS status inside the fenced transaction", async () => {
    await clearLease(testUserId);
    const operation = opId();
    await client.rpc("acquire_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: operation,
      p_requested_active: !originalActive,
      p_ttl_seconds: 30,
    });

    const updated = await client.rpc("admin_user_set_active", {
      p_auth_user_id: testUserId,
      p_caller_user_id: callerUserId,
      p_is_active: !originalActive,
      p_operation_id: operation,
    });
    assert.equal(updated.error, null);
    assert.equal(updated.data?.verified, true);

    const released = await client.rpc("release_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: operation,
      p_status: "completed",
      p_error: null,
    });
    assert.equal(released.error, null);

    // Restore the disposable user with a fresh fenced operation.
    const restore = opId();
    await client.rpc("acquire_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: restore,
      p_requested_active: originalActive,
      p_ttl_seconds: 30,
    });
    const restored = await client.rpc("admin_user_set_active", {
      p_auth_user_id: testUserId,
      p_caller_user_id: callerUserId,
      p_is_active: originalActive,
      p_operation_id: restore,
    });
    assert.equal(restored.error, null);
    await client.rpc("release_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: restore,
      p_status: "completed",
      p_error: null,
    });
  });

  await t.test("reconciliation refuses a live operation", async () => {
    await clearLease(testUserId);
    const operation = opId();
    await client.rpc("acquire_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: operation,
      p_requested_active: originalActive,
      p_ttl_seconds: 30,
    });

    const claim = await client.rpc("claim_account_activation_reconciliation", {
      p_user_id: testUserId,
      p_reconciliation_id: opId(),
      p_requested_active: originalActive,
      p_claim_ttl_seconds: 300,
    });
    assert.equal(claim.error, null);
    assert.equal(claim.data?.claimed, false);
    assert.equal(claim.data?.reason, "live_operation");

    await client.rpc("release_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: operation,
      p_status: "completed",
      p_error: null,
    });
  });

  await t.test("reconciliation claims an expired operation, verifies, and releases idempotently", async () => {
    await clearLease(testUserId);
    const operation = opId();
    await client.rpc("acquire_account_activation_lease", {
      p_user_id: testUserId,
      p_operation_id: operation,
      p_requested_active: originalActive,
      p_ttl_seconds: 30,
    });
    await expireLease(testUserId);

    const reconciliation = opId();
    const claim = await client.rpc("claim_account_activation_reconciliation", {
      p_user_id: testUserId,
      p_reconciliation_id: reconciliation,
      p_requested_active: originalActive,
      p_claim_ttl_seconds: 300,
    });
    assert.equal(claim.error, null);
    assert.equal(claim.data?.claimed, true);
    assert.equal(claim.data?.lease?.operation_id, operation);
    assert.notEqual(claim.data?.lease?.reconciliation_id, operation);

    const finalize = await client.rpc("finalize_account_activation_reconciliation", {
      p_user_id: testUserId,
      p_reconciliation_id: reconciliation,
      p_verified: true,
      p_expected_active: originalActive,
      p_message: "disposable integration test",
    });
    assert.equal(finalize.error, null);
    assert.equal(finalize.data?.verified, true);
    assert.equal(finalize.data?.released, true);

    const after = await client.from("account_activation_leases").select("user_id").eq("user_id", testUserId).maybeSingle();
    assert.equal(after.error, null);
    assert.equal(after.data, null);

    // Repeating the reconciliation is idempotent and creates/releases a synthetic claim.
    const repeat = await client.rpc("claim_account_activation_reconciliation", {
      p_user_id: testUserId,
      p_reconciliation_id: opId(),
      p_requested_active: originalActive,
      p_claim_ttl_seconds: 300,
    });
    assert.equal(repeat.error, null);
    assert.equal(repeat.data?.claimed, true);
    assert.equal(repeat.data?.synthetic, true);

    const repeatFinalize = await client.rpc("finalize_account_activation_reconciliation", {
      p_user_id: testUserId,
      p_reconciliation_id: repeat.data?.lease?.reconciliation_id,
      p_verified: true,
      p_expected_active: originalActive,
      p_message: "repeat",
    });
    assert.equal(repeatFinalize.error, null);
    assert.equal(repeatFinalize.data?.released, true);

    const staleOperation = await client.rpc("admin_user_set_active", {
      p_auth_user_id: testUserId,
      p_caller_user_id: callerUserId,
      p_is_active: !originalActive,
      p_operation_id: operation,
    });
    assert.ok(staleOperation.error, "the stale operation must not regain authority");
  });
});
