import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("public duplicate matches are queued and cannot update Members", async () => {
  const migration = await read("../../../supabase/migrations/20261104065645_security_review_fixes.sql");
  const publicFn = migration.split("create or replace function public.submit_cell_group_member_registration")[1].split("$$;")[0];
  assert.match(publicFn, /if candidate_count > 0 then[\s\S]*insert into public\.member_registration_reviews/);
  assert.match(publicFn, /return jsonb_build_object\('status','needs_review'\)/);
  assert.doesNotMatch(publicFn, /update public\.members/i);
  assert.doesNotMatch(publicFn, /return jsonb_build_object\([^;]*(candidate_json|display_name)/is);
  assert.match(publicFn, /pg_advisory_xact_lock\(731004220118\)/);
});

test("review status changes are identity-derived, pending-only, and column protected", async () => {
  const migration = await read("../../../supabase/migrations/20261104065645_security_review_fixes.sql");
  const statusFn = migration.split("create or replace function public.set_member_registration_review_status")[1].split("$$;")[0];
  const page = await read("../../src/pages/admin/MemberRegistrationReviews.tsx");
  assert.match(migration, /revoke update on public\.member_registration_reviews from public, anon, authenticated/);
  assert.match(statusFn, /actor_id uuid := auth\.uid\(\)/);
  assert.match(statusFn, /where r\.id=p_review_id and r\.status='pending' for update/);
  assert.match(statusFn, /public\.has_permission\('admin\.users'\)/);
  assert.match(statusFn, /join public\.cell_groups cg on cg\.leader_member_id=u\.member_id/);
  assert.match(statusFn, /reviewed_by=actor_id/);
  assert.doesNotMatch(statusFn, /p_reviewer|p_reviewed_by/);
  assert.match(page, /rpc\("set_member_registration_review_status"/);
  assert.doesNotMatch(page, /\.from\("member_registration_reviews"\)\s*\.update/);
});

const required = ["SEC_TEST_SUPABASE_URL", "SEC_TEST_SUPABASE_ANON_KEY", "SEC_TEST_SERVICE_ROLE_KEY", "SEC_TEST_ADMIN_EMAIL", "SEC_TEST_ADMIN_PASSWORD", "SEC_TEST_CELL_LEADER_EMAIL", "SEC_TEST_CELL_LEADER_PASSWORD", "SEC_TEST_CELL_GROUP_ID", "SEC_TEST_OTHER_CELL_GROUP_ID", "SEC_TEST_EXISTING_MEMBER_ID", "SEC_TEST_REGISTRATION_SLUG"];
const missing = required.filter((key) => !process.env[key]);
const integration = (name, run) => missing.length
  ? test(name, { skip: `Missing disposable Supabase authorization fixture: ${missing.join(", ")}` }, run)
  : test(name, run);

integration("public profile ownership and review authorization integration", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SEC_TEST_SUPABASE_URL;
  const anonKey = process.env.SEC_TEST_SUPABASE_ANON_KEY;
  const service = createClient(url, process.env.SEC_TEST_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const admin = createClient(url, anonKey, { auth: { persistSession: false } });
  const leader = createClient(url, anonKey, { auth: { persistSession: false } });
  const adminLogin = await admin.auth.signInWithPassword({ email: process.env.SEC_TEST_ADMIN_EMAIL, password: process.env.SEC_TEST_ADMIN_PASSWORD });
  const leaderLogin = await leader.auth.signInWithPassword({ email: process.env.SEC_TEST_CELL_LEADER_EMAIL, password: process.env.SEC_TEST_CELL_LEADER_PASSWORD });
  assert.ifError(adminLogin.error);
  assert.ifError(leaderLogin.error);

  const { data: original, error: readError } = await admin.from("members").select("id,first_name,last_name,birthday,mobile,email,address").eq("id", process.env.SEC_TEST_EXISTING_MEMBER_ID).single();
  assert.ifError(readError);
  const { data: inviteData, error: inviteError } = await admin.rpc("resolve_cell_group_registration_identifier", { p_identifier: process.env.SEC_TEST_REGISTRATION_SLUG });
  assert.ifError(inviteError);
  const publicClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const submitted = await publicClient.rpc("submit_cell_group_member_registration", {
    p_request_id: crypto.randomUUID(), p_invite_token: inviteData[0].registration_token,
    p_first_name: original.first_name, p_last_name: original.last_name, p_nickname: "spoof",
    p_gender: "Female", p_birthday: "1980-01-01", p_mobile: "09123456789",
    p_email: "spoof@example.invalid", p_address: "spoof address", p_match_decision: "confirm_existing",
  });
  assert.ifError(submitted.error);
  assert.equal(submitted.data.status, "needs_review");
  assert.equal("display_name" in submitted.data, false);
  assert.equal("candidates" in submitted.data, false);
  const { data: after, error: afterError } = await admin.from("members").select("id,first_name,last_name,birthday,mobile,email,address").eq("id", original.id).single();
  assert.ifError(afterError);
  assert.deepEqual(after, original);

  const reviewIds = [crypto.randomUUID(), crypto.randomUUID()];
  const { data: actor } = await admin.auth.getUser();
  const { error: insertError } = await service.from("member_registration_reviews").insert(reviewIds.map((id, index) => ({
    id, request_id: crypto.randomUUID(), cell_group_id: index ? process.env.SEC_TEST_OTHER_CELL_GROUP_ID : process.env.SEC_TEST_CELL_GROUP_ID,
    normalized_first_name: "test", normalized_last_name: "review", submitted_profile: { duplicate_candidates: [{ id: "unchanged" }] }, matched_profile_count: 1,
  })));
  assert.ifError(insertError);
  try {
    const resolved = await admin.rpc("set_member_registration_review_status", { p_review_id: reviewIds[0], p_status: "resolved" });
    assert.ifError(resolved.error);
    const denied = await leader.rpc("set_member_registration_review_status", { p_review_id: reviewIds[1], p_status: "dismissed" });
    assert.ok(denied.error, "Cell Leader cannot update another Cell Group's review");
    const protectedWrite = await admin.from("member_registration_reviews").update({ submitted_profile: { tampered: true } }).eq("id", reviewIds[0]);
    assert.ok(protectedWrite.error, "authenticated table UPDATE is revoked");
    const reopened = await admin.rpc("set_member_registration_review_status", { p_review_id: reviewIds[0], p_status: "dismissed" });
    assert.ok(reopened.error, "closed review cannot be transitioned again");
    const { data: unchanged } = await service.from("member_registration_reviews").select("status,submitted_profile,reviewed_by").eq("id", reviewIds[0]).single();
    assert.equal(unchanged.status, "resolved");
    assert.deepEqual(unchanged.submitted_profile, { duplicate_candidates: [{ id: "unchanged" }] });
    assert.equal(unchanged.reviewed_by, actor.user.id);
  } finally {
    await service.from("member_registration_reviews").delete().in("id", reviewIds);
  }
});
