import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { filterProjectIlawOrders } from "../../src/features/fundraising/orderAccounting.ts";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

const baseFilters = {
  from: "",
  to: "",
  product: "",
  payment: "",
  fulfillment: "",
  paymentMethod: "",
};

function makeOrder(id, paymentMethod) {
  return {
    id,
    createdAt: "2026-11-15T04:00:00.000Z",
    paymentStatus: "awaiting_payment",
    paymentMethod,
    fulfillmentStatus: "not_started",
    items: [],
  };
}

test("payment-method filter separates GCash, Cash, and unspecified orders", () => {
  const orders = [
    makeOrder("gcash-order", "gcash"),
    makeOrder("cash-order", "cash"),
    makeOrder("unspecified-order", null),
  ];

  assert.deepEqual(
    filterProjectIlawOrders(orders, { ...baseFilters, paymentMethod: "gcash" }).map((order) => order.id),
    ["gcash-order"],
  );
  assert.deepEqual(
    filterProjectIlawOrders(orders, { ...baseFilters, paymentMethod: "cash" }).map((order) => order.id),
    ["cash-order"],
  );
  assert.deepEqual(
    filterProjectIlawOrders(orders, { ...baseFilters, paymentMethod: "not_specified" }).map((order) => order.id),
    ["unspecified-order"],
  );
  assert.equal(filterProjectIlawOrders(orders, baseFilters).length, 3);
});

test("payment-method filter composes with payment-status and fulfillment filters", () => {
  const orders = [
    makeOrder("awaiting-cash", "cash"),
    { ...makeOrder("paid-cash", "cash"), paymentStatus: "paid" },
    makeOrder("awaiting-gcash", "gcash"),
  ];

  const filtered = filterProjectIlawOrders(orders, {
    ...baseFilters,
    payment: "awaiting_payment",
    paymentMethod: "cash",
  });

  assert.deepEqual(filtered.map((order) => order.id), ["awaiting-cash"]);
});

test("the desktop order row shows payment method and opens without a separate View Order link", async () => {
  const source = await readSource("../../src/pages/admin/ProjectIlawOrders.tsx");

  assert.match(source, /<th scope="col">Payment method<\/th>/);
  assert.match(source, /paymentMethodLabel\(order\.paymentMethod\)/);
  assert.match(source, /className="pilaw-order-row"/);
  assert.match(source, /onClick=\{\(event\) => handleOrderRowClick\(event, order\.id\)\}/);
  assert.doesNotMatch(source, /View Order/);
  assert.doesNotMatch(source, /<Link/);
});

test("payment-method dropdown offers GCash, Cash, and Not specified", async () => {
  const source = await readSource("../../src/pages/admin/ProjectIlawOrders.tsx");

  assert.match(source, /<span>Payment method<\/span>/);
  assert.match(source, /value="gcash">GCash<\/option>/);
  assert.match(source, /value="cash">Cash<\/option>/);
  assert.match(source, /value="not_specified">Not specified<\/option>/);
});

test("CSV export carries payment method and the export mapper applies the selected method", async () => {
  const accounting = await readSource("../../src/features/fundraising/orderAccounting.ts");
  const service = await readSource("../../src/features/fundraising/orderService.ts");
  const migration = await readSource("../../../supabase/migrations/20261115160000_project_ilaw_export_payment_method.sql");

  assert.match(accounting, /"Payment Method"/);
  assert.match(accounting, /row\.paymentMethod === "cash"/);
  assert.match(service, /paymentMethod: row\.payment_method \?\? null/);
  assert.match(service, /rows\.filter\(\(row\) => \(row\.paymentMethod \?\? "not_specified"\) === filters\.paymentMethod\)/);
  assert.match(migration, /'payment_method', orders\.payment_method/);
});
