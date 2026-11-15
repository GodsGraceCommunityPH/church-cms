import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { filterProjectIlawOrders } from "../../src/features/fundraising/orderAccounting.ts";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

const order = (id, paymentMethod) => ({
  id,
  reference: id,
  createdAt: "2026-11-15T09:00:00.000Z",
  paymentStatus: "awaiting_payment",
  paymentMethod,
  fulfillmentStatus: "not_started",
  items: [],
});

const filters = (paymentMethod = "") => ({
  from: "",
  to: "",
  product: "",
  payment: "",
  paymentMethod,
  fulfillment: "",
});

test("payment method filter returns only GCash or cash orders", () => {
  const orders = [
    order("gcash-order", "gcash"),
    order("cash-order", "cash"),
    order("unspecified-order", null),
  ];

  assert.deepEqual(
    filterProjectIlawOrders(orders, filters("gcash")).map((item) => item.id),
    ["gcash-order"],
  );
  assert.deepEqual(
    filterProjectIlawOrders(orders, filters("cash")).map((item) => item.id),
    ["cash-order"],
  );
  assert.deepEqual(
    filterProjectIlawOrders(orders, filters("not_set")).map((item) => item.id),
    ["unspecified-order"],
  );
  assert.equal(filterProjectIlawOrders(orders, filters()).length, 3);
});

test("desktop order rows show the payment method and navigate as a whole row", async () => {
  const source = await readSource("../../src/pages/admin/ProjectIlawOrders.tsx");

  assert.match(source, /className="pilaw-order-row"/);
  assert.ok(source.includes('aria-label={`Open order ${order.reference}`}'));
  assert.match(source, /onClick=\{\(event\) => \{/);
  assert.match(source, /event\.target\.closest\("button, input, select, textarea"\)/);
  assert.match(source, /paymentMethodLabel\(order\.paymentMethod\)/);
  assert.doesNotMatch(source, />\s*View Order\s*</);
});

test("mobile order cards also open the order and display payment method", async () => {
  const source = await readSource("../../src/pages/admin/ProjectIlawOrders.tsx");

  assert.match(source, /className="pilaw-order-card"/);
  assert.match(source, /className="pilaw-order-card-payment-method"/);
  assert.match(source, /onKeyDown=\{\(event\) => \{/);
});

test("payment method is a distinct filter and applies to exports too", async () => {
  const page = await readSource("../../src/pages/admin/ProjectIlawOrders.tsx");
  const model = await readSource("../../src/features/fundraising/projectIlaw.ts");
  const accounting = await readSource("../../src/features/fundraising/orderAccounting.ts");

  assert.match(model, /paymentMethod\?: string/);
  assert.match(page, /<span>Payment method<\/span>/);
  assert.match(page, /<option value="gcash">GCash<\/option>/);
  assert.match(page, /<option value="cash">Cash<\/option>/);
  assert.match(accounting, /filters\.paymentMethod/);
  assert.match(page, /const exportRows = filters\.paymentMethod/);
});
