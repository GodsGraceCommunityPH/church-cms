import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AccountActivationError, synchronizeAccountActivation } from "../../../supabase/functions/manage-cms-users/accountActivation.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

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
