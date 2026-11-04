import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

/**
 * Real PostgreSQL concurrency regression tests for activation lease timing.
 *
 * These tests need two independent database sessions, so PGlite (single
 * connection) cannot exercise them faithfully. They run only when
 * ACTIVATION_CONCURRENCY_DATABASE_URL points at an EMPTY, DISPOSABLE
 * PostgreSQL database: the suite creates the minimal CMS tables in `public`
 * and applies the pending migration.
 *
 * Run (for example with a disposable local/embedded PostgreSQL server):
 *   ACTIVATION_CONCURRENCY_DATABASE_URL=postgres://... \
 *     node --test tests/users/account-activation-concurrency.test.mjs
 *
 * The tests deliberately wait for pg_stat_activity to report a lock wait
 * before allowing the lease to expire. That makes them real lock-wait timing
 * tests rather than sleeps that merely assume a block happened.
 */

const databaseUrl = process.env.ACTIVATION_CONCURRENCY_DATABASE_URL;

const skip = databaseUrl
  ? false
  : "requires ACTIVATION_CONCURRENCY_DATABASE_URL pointing at an empty disposable PostgreSQL database";

const pg = skip ? null : await import("pg");

const migrationUrl = new URL(
  "../../../supabase/migrations/20261104065657_account_activation_leases.sql",
  import.meta.url,
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

/** Settle a query without leaving an unhandled rejection while we sleep. */
function settle(promise) {
  return promise.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", reason }),
  );
}

/** Wait until PostgreSQL reports that this backend is blocked on a lock. */
async function waitForLockWait(observer, pid, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const { rows } = await observer.query(
      "select wait_event_type, wait_event, state from pg_stat_activity where pid = $1",
      [pid],
    );
    last = rows[0] ?? null;
    if (last?.wait_event_type === "Lock") return last;
    await sleep(25);
  }
  throw new Error(`session ${pid} did not block on a lock within ${timeoutMs}ms (last=${JSON.stringify(last)})`);
}

async function bootstrap(admin) {
  await admin.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
    end
    $$;
  `);

  await admin.query(`
    create table if not exists public.users (
      id uuid primary key,
      is_active boolean not null default true,
      updated_at timestamptz not null default now()
    );
    create table if not exists public.roles (
      id uuid primary key,
      code text not null unique
    );
    create table if not exists public.permissions (
      id uuid primary key,
      code text not null unique
    );
    create table if not exists public.user_roles (
      user_id uuid not null references public.users(id) on delete cascade,
      role_id uuid not null references public.roles(id) on delete cascade,
      primary key (user_id, role_id)
    );
    create table if not exists public.role_permissions (
      role_id uuid not null references public.roles(id) on delete cascade,
      permission_id uuid not null references public.permissions(id) on delete cascade,
      primary key (role_id, permission_id)
    );
  `);

  const migration = await readFile(migrationUrl, "utf8");
  await admin.query(migration);
}

async function seed(admin) {
  const callerId = randomUUID();
  const targetId = randomUUID();
  const roleId = randomUUID();
  const permissionId = randomUUID();

  await admin.query(
    `insert into public.users (id, is_active) values ($1, true), ($2, true)`,
    [callerId, targetId],
  );
  await admin.query(`insert into public.roles (id, code) values ($1, 'administrator')`, [roleId]);
  await admin.query(`insert into public.permissions (id, code) values ($1, 'admin.users')`, [permissionId]);
  await admin.query(`insert into public.user_roles (user_id, role_id) values ($1, $2)`, [callerId, roleId]);
  await admin.query(`insert into public.role_permissions (role_id, permission_id) values ($1, $2)`, [roleId, permissionId]);

  return { callerId, targetId };
}

async function clearLeases(admin, userId) {
  await admin.query("delete from public.account_activation_leases where user_id = $1", [userId]);
}

async function acquireLease(admin, userId, operationId, ttlSeconds = 60) {
  const { rows } = await admin.query(
    "select public.acquire_account_activation_lease($1, $2, true, $3) as acquired",
    [userId, operationId, ttlSeconds],
  );
  assert.equal(rows[0].acquired, true, "the lease must be acquired before the timing test");
}

async function setExpiry(admin, userId, milliseconds) {
  const { rows } = await admin.query(
    `update public.account_activation_leases
     set expires_at = clock_timestamp() + make_interval(secs => $2 / 1000.0)
     where user_id = $1
     returning expires_at`,
    [userId, milliseconds],
  );
  assert.equal(rows.length, 1);
  return rows[0].expires_at;
}

test("PostgreSQL activation lease concurrency", { skip }, async (t) => {
  const admin = await connect();

  try {
    await bootstrap(admin);
  } catch (error) {
    await admin.end();
    throw error;
  }

  const ids = await seed(admin);
  const { callerId, targetId } = ids;

  t.after(async () => {
    try {
      await clearLeases(admin, targetId);
      await admin.query("delete from public.users where id = any($1::uuid[])", [[callerId, targetId]]);
    } catch {
      // Disposable database; best-effort cleanup only.
    }
    await admin.end();
  });

  const freshTarget = async () => {
    await clearLeases(admin, targetId);
    await admin.query("update public.users set is_active = true where id = $1", [targetId]);
  };

  await t.test("a status update waiting on the advisory lock is rejected after the lease expires", async () => {
    await freshTarget();
    const operationId = randomUUID();
    await acquireLease(admin, targetId, operationId);
    const expiresAt = await setExpiry(admin, targetId, 2_000);

    const locker = await connect();
    const txn = await connect();
    let outcome;

    try {
      // Session A holds the same global advisory lock used by admin_user_set_active.
      await locker.query("begin");
      await locker.query("select pg_advisory_xact_lock(hashtext('ggccc-active-administrator'))");

      // Session B starts before expiry and records its transaction-start time.
      await txn.query("begin");
      const started = await txn.query(
        "select now() as transaction_started_at, clock_timestamp() as wall_now, pg_backend_pid() as pid",
      );
      assert.ok(
        new Date(started.rows[0].transaction_started_at) < new Date(expiresAt),
        "the fenced update must begin before the lease expires",
      );

      // This call blocks on the advisory lock before it ever reaches the lease row.
      outcome = settle(
        txn.query(
          "select public.admin_user_set_active($1, $2, $3, $4) as result",
          [targetId, callerId, false, operationId],
        ),
      );

      await waitForLockWait(admin, started.rows[0].pid);

      // Let the lease expire while session B is still waiting.
      await sleep(2_500);
      const expired = await admin.query(
        "select clock_timestamp() > $1::timestamptz as expired",
        [expiresAt],
      );
      assert.equal(expired.rows[0].expired, true, "the lease must actually expire during the lock wait");

      // Release the advisory lock. Session B now evaluates the lease using
      // wall-clock time and must reject the operation.
      await locker.query("rollback");

      const settled = await outcome;
      assert.equal(settled.status, "rejected", "the expired operation must be rejected");
      assert.equal(settled.reason.code, "42501");
      assert.match(settled.reason.message, /lease is missing, expired/i);
    } finally {
      await txn.query("rollback").catch(() => {});
      await locker.query("rollback").catch(() => {});
      await txn.end().catch(() => {});
      await locker.end().catch(() => {});
    }

    const after = await admin.query("select is_active from public.users where id = $1", [targetId]);
    assert.equal(after.rows[0].is_active, true, "an expired operation must not change users.is_active");

    // The expired unresolved lease stays recoverable rather than being deleted.
    const lease = await admin.query(
      "select status, operation_id from public.account_activation_leases where user_id = $1",
      [targetId],
    );
    assert.equal(lease.rows.length, 1);
    assert.equal(lease.rows[0].operation_id, operationId);
  });

  await t.test("a renewal waiting on the lease row cannot renew after actual expiry", async () => {
    await freshTarget();
    const operationId = randomUUID();
    await acquireLease(admin, targetId, operationId);
    const expiresAt = await setExpiry(admin, targetId, 2_000);

    const lockHolder = await connect();
    const txn = await connect();
    let outcome;

    try {
      // Session A holds the lease row lock.
      await lockHolder.query("begin");
      await lockHolder.query(
        "select * from public.account_activation_leases where user_id = $1 for update",
        [targetId],
      );

      // Session B starts a renewal before expiry; it blocks inside the
      // function's SELECT ... FOR UPDATE.
      await txn.query("begin");
      const started = await txn.query(
        "select now() as transaction_started_at, pg_backend_pid() as pid",
      );
      assert.ok(
        new Date(started.rows[0].transaction_started_at) < new Date(expiresAt),
        "the renewal must begin before the lease expires",
      );

      outcome = settle(
        txn.query(
          "select public.renew_account_activation_lease($1, $2, $3) as renewed",
          [targetId, operationId, 60],
        ),
      );

      await waitForLockWait(admin, started.rows[0].pid);

      // Let the lease expire while the renewal waits for the row lock.
      await sleep(2_500);
      const expired = await admin.query(
        "select clock_timestamp() > $1::timestamptz as expired",
        [expiresAt],
      );
      assert.equal(expired.rows[0].expired, true, "the lease must actually expire during the row-lock wait");

      await lockHolder.query("rollback");

      const settled = await outcome;
      assert.equal(settled.status, "fulfilled");
      assert.equal(settled.value.rows[0].renewed, false, "an expired lease must not be renewed");
    } finally {
      await txn.query("rollback").catch(() => {});
      await lockHolder.query("rollback").catch(() => {});
      await txn.end().catch(() => {});
      await lockHolder.end().catch(() => {});
    }

    const lease = await admin.query(
      `select expires_at <= clock_timestamp() as still_expired
       from public.account_activation_leases where user_id = $1`,
      [targetId],
    );
    assert.equal(lease.rows.length, 1);
    assert.equal(lease.rows[0].still_expired, true, "the failed renewal must not extend the lease");
  });

  await t.test("an expired lease cannot be reported completed and is not deleted", async () => {
    await freshTarget();
    const operationId = randomUUID();
    await acquireLease(admin, targetId, operationId);
    await setExpiry(admin, targetId, -1_000);

    const released = await admin.query(
      "select public.release_account_activation_lease($1, $2, 'completed', null) as released",
      [targetId, operationId],
    );
    assert.equal(released.rows[0].released, false);

    const lease = await admin.query(
      "select status from public.account_activation_leases where user_id = $1",
      [targetId],
    );
    assert.equal(lease.rows.length, 1, "an expired unresolved lease must remain recoverable");
    assert.equal(lease.rows[0].status, "started");
  });

  await t.test("an expired reconciliation claim cannot finalize, and a later reconciler can reclaim it", async () => {
    await freshTarget();
    const reconciliationId = randomUUID();
    const originalOperationId = randomUUID();

    await admin.query(
      `insert into public.account_activation_leases
         (user_id, operation_id, requested_active, started_at, expires_at, status, source,
          reconciliation_id, reconciliation_started_at, last_error)
       values
         ($1, $2, true, clock_timestamp() - interval '10 minutes',
          clock_timestamp() - interval '5 minutes', 'uncertain', 'reconciliation',
          $3, clock_timestamp() - interval '5 minutes', null)`,
      [targetId, originalOperationId, reconciliationId],
    );

    const finalized = await admin.query(
      `select public.finalize_account_activation_reconciliation($1, $2, true, true, null) as result`,
      [targetId, reconciliationId],
    );
    assert.equal(finalized.rows[0].result.released, false);
    assert.equal(finalized.rows[0].result.reason, "claim_expired");

    const surviving = await admin.query(
      "select reconciliation_id, status from public.account_activation_leases where user_id = $1",
      [targetId],
    );
    assert.equal(surviving.rows.length, 1);
    assert.equal(surviving.rows[0].status, "uncertain");

    // The unresolved row is still recoverable by a new reconciliation.
    const nextReconciliationId = randomUUID();
    const claimed = await admin.query(
      `select public.claim_account_activation_reconciliation($1, $2, true, 60) as result`,
      [targetId, nextReconciliationId],
    );
    assert.equal(claimed.rows[0].result.claimed, true);
    assert.equal(claimed.rows[0].result.lease.reconciliation_id, nextReconciliationId);
  });

  await t.test("reconciliation cannot steal a live activation", async () => {
    await freshTarget();
    const operationId = randomUUID();
    await acquireLease(admin, targetId, operationId);

    const claimed = await admin.query(
      `select public.claim_account_activation_reconciliation($1, $2, true, 30) as result`,
      [targetId, randomUUID()],
    );
    assert.equal(claimed.rows[0].result.claimed, false);
    assert.equal(claimed.rows[0].result.reason, "live_operation");

    const owner = await admin.query(
      "select public.account_activation_lease_owner($1, $2) as owned",
      [targetId, operationId],
    );
    assert.equal(owner.rows[0].owned, true);
  });

  await t.test("the production RLS migration enables RLS on the lease table", async () => {
    const rls = await readFile(
      new URL("../../../supabase/migrations/20261104065810_enable_account_activation_leases_rls.sql", import.meta.url),
      "utf8",
    );
    await admin.query(rls);

    const { rows } = await admin.query(
      "select relrowsecurity from pg_class where oid = 'public.account_activation_leases'::regclass",
    );
    assert.equal(rows[0].relrowsecurity, true);
  });
});
