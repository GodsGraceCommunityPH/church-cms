import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOrderSummary,
  filterProjectIlawOrders,
  projectIlawExportRowsToCsv,
} from "../../src/features/fundraising/orderAccounting.ts";

let nextId = 0;

function item(overrides = {}) {
  nextId += 1;
  return {
    id: `item-${nextId}`,
    orderId: "order",
    revision: 1,
    lineNumber: 1,
    productId: "project-ilaw-t-shirt",
    productName: "Project Ilaw T-shirt",
    productType: "t_shirt",
    size: "M",
    quantity: 1,
    unitPrice: 499,
    lineTotal: 499,
    ...overrides,
  };
}

function order(overrides = {}) {
  nextId += 1;
  const items = overrides.items ?? [item()];
  const totalQuantity = items.reduce((total, entry) => total + entry.quantity, 0);
  const totalAmount = items.reduce((total, entry) => total + entry.lineTotal, 0);

  return {
    id: `order-${nextId}`,
    reference: `PI-20261110-${String(nextId).padStart(6, "0")}`,
    customerName: "Grace Member",
    mobile: "09171234567",
    notes: "",
    totalQuantity,
    totalAmount,
    paymentStatus: "awaiting_payment",
    fulfillmentStatus: "not_started",
    paymentConfirmedAt: null,
    paymentConfirmedBy: null,
    paymentNote: "",
    cancelledAt: null,
    cancelReason: "",
    createdAt: "2026-11-10T09:00:00+08:00",
    updatedAt: "2026-11-10T09:00:00+08:00",
    items,
    ...overrides,
  };
}

test("expected sales exclude cancelled orders while confirmed collections do not", () => {
  const active = order({
    totalAmount: 1497,
    paymentStatus: "payment_confirmed",
    paymentConfirmedAt: "2026-11-10T10:00:00+08:00",
    items: [
      item({ quantity: 2, lineTotal: 998 }),
      item({
        productId: "project-ilaw-eco-bag",
        productName: "Project Ilaw Eco Bag",
        productType: "eco_bag",
        size: "One Size",
        quantity: 1,
        lineTotal: 499,
      }),
    ],
  });
  const cancelledUnpaid = order({
    totalAmount: 499,
    fulfillmentStatus: "cancelled",
    cancelledAt: "2026-11-10T11:00:00+08:00",
  });
  const cancelledPaid = order({
    totalAmount: 998,
    paymentStatus: "payment_confirmed",
    paymentConfirmedAt: "2026-11-10T10:30:00+08:00",
    fulfillmentStatus: "cancelled",
    cancelledAt: "2026-11-10T11:30:00+08:00",
    items: [item({ quantity: 2, lineTotal: 998 })],
  });

  const summary = buildOrderSummary([active, cancelledUnpaid, cancelledPaid]);

  assert.equal(summary.totalOrders, 3);
  assert.equal(summary.totalUnits, 3 + 1 + 2);
  assert.equal(summary.activeUnits, 3);
  assert.equal(summary.cancelledUnits, 3);
  assert.equal(summary.expectedSales, 1497);
  assert.equal(summary.confirmedCollections, 1497 + 998);
  assert.equal(summary.paymentConfirmedOrders, 2);
  assert.equal(summary.awaitingPaymentOrders, 0);
  assert.equal(summary.cancelledPaidOrders, 1);
  assert.equal(summary.cancelledPaidAmount, 998);

  // Product and size quantities ignore cancelled orders.
  assert.equal(summary.tshirtQuantity, 2);
  assert.equal(summary.ecoBagQuantity, 1);
  assert.equal(summary.sizeQuantities.M, 2);
  assert.equal(summary.cancelledTshirtQuantity, 3);
  assert.equal(summary.cancelledEcoBagQuantity, 0);
});

test("awaiting payment counts exclude cancelled orders", () => {
  const awaiting = order();
  const cancelled = order({ fulfillmentStatus: "cancelled" });
  const paid = order({ paymentStatus: "payment_confirmed" });

  const summary = buildOrderSummary([awaiting, cancelled, paid]);
  assert.equal(summary.awaitingPaymentOrders, 1);
  assert.equal(summary.paymentConfirmedOrders, 1);
  assert.equal(summary.expectedSales, 998);
  assert.equal(summary.confirmedCollections, 499);
});

test("filters match Manila dates, products, and both statuses", () => {
  const shirt = order({ createdAt: "2026-11-09T23:30:00+08:00" });
  const bag = order({
    createdAt: "2026-11-10T00:30:00+08:00",
    paymentStatus: "payment_confirmed",
    fulfillmentStatus: "processing",
    items: [
      item({
        productId: "project-ilaw-eco-bag",
        productName: "Project Ilaw Eco Bag",
        productType: "eco_bag",
        size: "One Size",
      }),
    ],
  });

  assert.deepEqual(
    filterProjectIlawOrders([shirt, bag], {
      from: "2026-11-10",
      to: "",
      product: "",
      payment: "",
      fulfillment: "",
    }).map((entry) => entry.id),
    [bag.id],
  );

  assert.deepEqual(
    filterProjectIlawOrders([shirt, bag], {
      from: "",
      to: "2026-11-09",
      product: "",
      payment: "",
      fulfillment: "",
    }).map((entry) => entry.id),
    [shirt.id],
  );

  assert.deepEqual(
    filterProjectIlawOrders([shirt, bag], {
      from: "",
      to: "",
      product: "project-ilaw-eco-bag",
      payment: "payment_confirmed",
      fulfillment: "processing",
    }).map((entry) => entry.id),
    [bag.id],
  );

  assert.deepEqual(
    filterProjectIlawOrders([shirt, bag], {
      from: "",
      to: "",
      product: "",
      payment: "awaiting_payment",
      fulfillment: "",
    }).map((entry) => entry.id),
    [shirt.id],
  );
});

test("CSV export keeps the accounting columns and escapes customer text", () => {
  const rows = [
    {
      orderReference: "PI-20261110-000001",
      orderCreatedAt: "2026-11-10T09:00:00+08:00",
      customerName: 'Grace, "G" Member',
      mobile: "09171234567",
      productName: "Project Ilaw T-shirt",
      productType: "t_shirt",
      size: "M",
      quantity: 2,
      unitPrice: 499,
      lineTotal: 998,
      paymentStatus: "payment_confirmed",
      fulfillmentStatus: "cancelled",
      paymentConfirmedAt: "2026-11-10T10:00:00+08:00",
      paymentConfirmedBy: "Bryan Castro",
    },
  ];

  const csv = projectIlawExportRowsToCsv(rows);
  const [header, line] = csv.split("\r\n");

  assert.equal(header.split(",")[0], "Order Reference");
  assert.match(header, /Payment Status/);
  assert.match(header, /Fulfillment Status/);
  assert.match(header, /Payment Confirmed By/);

  assert.match(line, /PI-20261110-000001/);
  assert.match(line, /"Grace, ""G"" Member"/);
  assert.match(line, /Project Ilaw T-shirt/);
  assert.match(line, /Payment Confirmed/);
  assert.match(line, /Cancelled/);
  assert.ok(csv.endsWith("\r\n"));
});
