import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePhilippineMobile,
  normalizeCustomerName,
} from "../../src/features/fundraising/projectIlaw.ts";

test("normalizePhilippineMobile accepts 09, +63, and 9 forms", () => {
  assert.equal(normalizePhilippineMobile("09171234567"), "09171234567");
  assert.equal(normalizePhilippineMobile("+639171234567"), "09171234567");
  assert.equal(normalizePhilippineMobile("639171234567"), "09171234567");
  assert.equal(normalizePhilippineMobile("9171234567"), "09171234567");
  assert.equal(normalizePhilippineMobile("0917 123 4567"), "09171234567");
  assert.equal(normalizePhilippineMobile("0917-123-4567"), "09171234567");
});

test("normalizePhilippineMobile rejects invalid numbers", () => {
  assert.equal(normalizePhilippineMobile(""), null);
  assert.equal(normalizePhilippineMobile("123"), null);
  assert.equal(normalizePhilippineMobile("08171234567"), null);
  assert.equal(normalizePhilippineMobile("0917123456"), null);
  assert.equal(normalizePhilippineMobile("091712345678"), null);
  assert.equal(normalizePhilippineMobile("0917 123 4567 extra"), null);
});

test("normalizeCustomerName trims, collapses whitespace, and lowercases", () => {
  assert.equal(normalizeCustomerName("  Alvin   Calma  "), "alvin calma");
  assert.equal(normalizeCustomerName("ALVIN CALMA"), "alvin calma");
  assert.equal(normalizeCustomerName("Alvin\tCalma"), "alvin calma");
  assert.equal(normalizeCustomerName("Alvin Calma"), "alvin calma");
});
