import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyMemberDuplicate,
  normalizeMemberMobile,
} from "../../src/features/members/memberDuplicateDetection.ts";

test("Philippine mobile formatting resolves to one canonical value", () => {
  const expected = "639616071685";
  assert.equal(normalizeMemberMobile("0961-607-1685"), expected);
  assert.equal(normalizeMemberMobile("09616071685"), expected);
  assert.equal(normalizeMemberMobile("+63 961 607 1685"), expected);
  assert.equal(normalizeMemberMobile("9616071685"), expected);
});

test("an added trailing first-name token with the same surname is a likely match", () => {
  assert.equal(classifyMemberDuplicate(
    { first_name: "Jesmer Christian", last_name: "Antipatia", mobile: null },
    { firstName: "Jesmer", lastName: "Antipatia", mobile: "" },
  ), "likely_same_person");
});

test("a shared phone with a different name is a shared-contact review, not an identity match", () => {
  assert.equal(classifyMemberDuplicate(
    { first_name: "Maria", last_name: "Santos", mobile: "+63 961 607 1685" },
    { firstName: "Jose", lastName: "Santos", mobile: "0961-607-1685" },
  ), "possible_shared_contact");
});

test("different people with different contact details do not match", () => {
  assert.equal(classifyMemberDuplicate(
    { first_name: "Maria", last_name: "Santos", mobile: "09171234567" },
    { firstName: "Jose", lastName: "Santos", mobile: "09981234567" },
  ), null);
});
