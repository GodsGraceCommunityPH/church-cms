import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const required = ["SEC_TEST_SUPABASE_URL", "SEC_TEST_SUPABASE_ANON_KEY", "SEC_TEST_REGISTRATION_SLUG"];
const integrationTest = required.some((key) => !process.env[key]) ? test.skip : test;

integrationTest("member registration serializes duplicate checks and preserves distinct people", async () => {
  const anon = createClient(process.env.SEC_TEST_SUPABASE_URL, process.env.SEC_TEST_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: resolved, error: resolveError } = await anon.rpc("resolve_cell_group_registration_identifier", {
    p_identifier: process.env.SEC_TEST_REGISTRATION_SLUG,
  });
  assert.ifError(resolveError);
  const token = resolved[0].registration_token;
  const unique = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const mobileDigits = crypto.randomUUID().replace(/\D/g, "").slice(0, 9).padEnd(9, "1");
  const sharedPhone = `09${mobileDigits}`;
  const submit = (requestId, first, mobile, decision = null) => anon.rpc("submit_cell_group_member_registration", {
    p_request_id: requestId,
    p_invite_token: token,
    p_first_name: first,
    p_last_name: `DuplicateTest${unique}`,
    p_nickname: "",
    p_gender: "Female",
    p_birthday: "1990-01-01",
    p_mobile: mobile,
    p_email: "",
    p_address: "",
    p_match_decision: decision,
  });

  // Simultaneous requests using different formatting must serialize: only one
  // inserts; the second observes the newly committed likely match.
  const [first, second] = await Promise.all([
    submit(crypto.randomUUID(), "Concurrent", sharedPhone),
    submit(crypto.randomUUID(), "Concurrent", `+63 ${sharedPhone.slice(1, 4)} ${sharedPhone.slice(4, 7)} ${sharedPhone.slice(7)}`),
  ]);
  assert.ifError(first.error);
  assert.ifError(second.error);
  assert.deepEqual([first.data.status, second.data.status].sort(), ["created", "needs_confirmation"]);

  // A different person sharing a household phone is sent to staff review.
  const shared = await submit(crypto.randomUUID(), "HouseholdMember", sharedPhone);
  assert.ifError(shared.error);
  assert.equal(shared.data.status, "needs_review");

  // Matching names can still represent distinct people after an explicit
  // registrant decision; names and mobile numbers are not globally unique.
  const distinctPhone = `09${crypto.randomUUID().replace(/\D/g, "").slice(0, 9).padEnd(9, "2")}`;
  const distinctFirst = `Distinct${unique}`;
  const distinctFirstSubmission = await submit(crypto.randomUUID(), distinctFirst, distinctPhone);
  assert.ifError(distinctFirstSubmission.error);
  assert.equal(distinctFirstSubmission.data.status, "created");
  const distinct = await submit(crypto.randomUUID(), distinctFirst, distinctPhone, "create_new");
  assert.ifError(distinct.error);
  assert.equal(distinct.data.status, "created");
});
