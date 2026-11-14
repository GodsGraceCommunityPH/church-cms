import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  canRetryStaffGcashPayment,
  staffPaymentBlockReason,
  staffPaymentErrorMessage,
  staffPaymentOptionState,
  validateStaffOrderItems,
} from "../../src/features/fundraising/staffOrder.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const readSource = async (path) => read(`../../${path}`);

const GCASH_ORDER = {
  source: "staff",
  paymentMethod: "gcash",
  paymentStatus: "awaiting_payment",
  fulfillmentStatus: "not_started",
  mobile: "09171234567",
};

test("staff order validation rejects invalid quantities instead of filtering lines", () => {
  const valid = [
    {
      productId: "project-ilaw-t-shirt",
      size: "M",
      color: "Black",
      quantity: 2,
    },
    {
      productId: "project-ilaw-eco-bag",
      size: "One Size",
      color: "Maroon",
      quantity: 1,
    },
  ];
  const ok = validateStaffOrderItems(valid);
  assert.equal(ok.ok, true);
  assert.equal(ok.error, "");
  assert.equal(ok.items.length, 2);

  const invalid = [
    {
      productId: "project-ilaw-t-shirt",
      size: "M",
      color: "Black",
      quantity: 2,
    },
    {
      productId: "project-ilaw-eco-bag",
      size: "One Size",
      color: "Maroon",
      quantity: 0,
    },
  ];
  const result = validateStaffOrderItems(invalid);
  assert.equal(result.ok, false);
  assert.equal(
    result.error,
    "Item 2 has an invalid quantity (1–99).",
  );
  // Nothing is silently dropped: the whole draft is rejected for review.
  assert.equal(result.items.length, 0);
});

test("staff order validation accepts quantities from 1 through 99", () => {
  const draft = [
    {
      productId: "project-ilaw-t-shirt",
      size: "M",
      color: "Black",
      quantity: 99,
    },
  ];
  assert.equal(validateStaffOrderItems(draft).ok, true);

  const overLimit = [
    {
      productId: "project-ilaw-t-shirt",
      size: "M",
      color: "Black",
      quantity: 100,
    },
  ];
  assert.equal(validateStaffOrderItems(overLimit).ok, false);
});

test("cash is unavailable without the confirm payments permission", () => {
  const option = staffPaymentOptionState("cash", {
    paymentsEnabled: true,
    canConfirmPayment: false,
  });
  assert.equal(option.disabled, true);
  assert.match(option.hint, /Confirm payments permission/i);

  const blockReason = staffPaymentBlockReason({
    method: "cash",
    paymentsEnabled: true,
    canConfirmPayment: false,
    cashConfirmed: true,
  });
  // A staff member without the confirm permission must not be able to create
  // an order that would predictably fail at the cash recording step.
  assert.match(blockReason, /permission/i);
});

test("cash blocks order creation until physical receipt confirmation is explicit", () => {
  const blocked = staffPaymentBlockReason({
    method: "cash",
    paymentsEnabled: true,
    canConfirmPayment: true,
    cashConfirmed: false,
  });
  assert.match(blocked, /physically received/i);

  const allowed = staffPaymentBlockReason({
    method: "cash",
    paymentsEnabled: true,
    canConfirmPayment: true,
    cashConfirmed: true,
  });
  assert.equal(allowed, "");
});

test("cash option is offered only when the staff member can confirm payments", () => {
  const allowed = staffPaymentOptionState("cash", {
    paymentsEnabled: true,
    canConfirmPayment: true,
  });
  assert.equal(allowed.disabled, false);
  assert.equal(allowed.hint, "");

  const denied = staffPaymentOptionState("cash", {
    paymentsEnabled: true,
    canConfirmPayment: false,
  });
  assert.equal(denied.disabled, true);
});

test("cash block reason explains the permission failure for safer creation", () => {
  const reason = staffPaymentBlockReason({
    method: "cash",
    paymentsEnabled: true,
    canConfirmPayment: false,
    cashConfirmed: true,
  });
  assert.match(reason, /permission/i);
});

test("gcash is unavailable while public payment collection is disabled", () => {
  const option = staffPaymentOptionState("gcash", {
    paymentsEnabled: false,
    canConfirmPayment: true,
  });
  assert.equal(option.disabled, true);
  assert.match(option.hint, /closed/i);

  const blockReason = staffPaymentBlockReason({
    method: "gcash",
    paymentsEnabled: false,
    canConfirmPayment: true,
    cashConfirmed: false,
  });
  assert.match(blockReason, /closed/i);

  const allowed = staffPaymentOptionState("gcash", {
    paymentsEnabled: true,
    canConfirmPayment: true,
  });
  assert.equal(allowed.disabled, false);
  assert.equal(allowed.hint, "");
});

test("failed gcash submissions keep the order retryable through the retry action", () => {
  const awaitingStaffGcash = canRetryStaffGcashPayment(GCASH_ORDER, true);
  assert.equal(awaitingStaffGcash, true);

  const retryBlockedAfterPayment = canRetryStaffGcashPayment(
    { ...GCASH_ORDER, paymentStatus: "payment_verification" },
    true,
  );
  assert.equal(retryBlockedAfterPayment, false);

  const retryBlockedForOnlineOrder = canRetryStaffGcashPayment(
    { ...GCASH_ORDER, source: "online" },
    true,
  );
  assert.equal(retryBlockedForOnlineOrder, false);

  const retryBlockedWhenClosed = canRetryStaffGcashPayment(
    GCASH_ORDER,
    false,
  );
  assert.equal(retryBlockedWhenClosed, false);

  const retryBlockedWithoutMobile = canRetryStaffGcashPayment(
    { ...GCASH_ORDER, mobile: "" },
    true,
  );
  assert.equal(retryBlockedWithoutMobile, false);

  const retryBlockedForCancelledOrder = canRetryStaffGcashPayment(
    { ...GCASH_ORDER, fulfillmentStatus: "cancelled" },
    true,
  );
  assert.equal(retryBlockedForCancelledOrder, false);
});

test("payment errors surface a clear staff message instead of a storage error", () => {
  const closed = staffPaymentErrorMessage(
    "Project Ilaw payment collection is not open yet",
    "gcash",
  );
  assert.match(closed, /Payment collection is currently closed/i);

  const duplicate = staffPaymentErrorMessage(
    "This order already has a GCash receipt awaiting verification",
    "gcash",
  );
  assert.match(duplicate, /already has a GCash receipt/i);
});

test("the staff order dialog resets receipt fields on close and reopen", async () => {
  const source = await readSource(
    "src/pages/admin/ProjectIlawOrders.tsx",
  );
  assert.match(source, /function openStaffOrderDialog\(\)[\s\S]*?resetStaffPaymentFields\(\);/);
  assert.match(source, /function closeStaffOrderDialog\(\)[\s\S]*?resetStaffPaymentFields\(\);/);
  assert.match(source, /function changeStaffPaymentMethod\(method: StaffPaymentMethod\)[\s\S]*?if \(method !== "gcash"\)/);
  assert.match(source, /function changeStaffPaymentMethod[\s\S]*?setStaffEvidenceFile\(null\)/);
});

test("the staff order submit blocks invalid drafts and unsafe payment methods", async () => {
  const source = await readSource("src/pages/admin/ProjectIlawOrders.tsx");
  assert.match(source, /validateStaffOrderItems\(staffDraft\.items\)/);
  assert.match(source, /disabled=\{staffOrderSubmitting \|\| staffPaymentBlocked\}/);
  assert.match(source, /staffPaymentBlockReason\(\{/);
});

test("the cash create action requires explicit physical receipt confirmation", async () => {
  const source = await readSource("src/pages/admin/ProjectIlawOrders.tsx");
  assert.match(source, /staffCashConfirmed/);
  assert.match(source, /I have physically received the cash for this order/);
});

test("the order detail page offers the GCash retry without duplicating the order", async () => {
  const source = await readSource("src/pages/admin/ProjectIlawOrderDetail.tsx");
  assert.match(source, /Record GCash payment/);
  assert.match(source, /canRetryStaffGcashPayment\(/);
  assert.match(source, /handleRecordGcashReceipt/);
  assert.match(source, /getProjectIlawPaymentContext\(/);
  assert.match(source, /uploadProjectIlawPaymentEvidence\(/);
  assert.match(source, /submitProjectIlawPayment\(\{/);
  // Manual verification must stay a separate, staff-only action.
  assert.doesNotMatch(source, /submitProjectIlawPayment[\s\S]{0,200}confirmProjectIlawPayment/);
  assert.doesNotMatch(source, /await confirmProjectIlawPayment\(order\.id, gcash/);
});

test("the staff order dialog clears the cash note when switching payment methods", async () => {
  const source = await readSource("src/pages/admin/ProjectIlawOrders.tsx");
  assert.match(source, /if \(method !== "cash"\)/);
  assert.match(source, /setStaffCashNote\(""\);\s*\n\s*setStaffCashConfirmed\(false\);/);
});

test("evidence file reads are bounded before upload", async () => {
  const source = await readSource("src/pages/admin/ProjectIlawOrderDetail.tsx");
  assert.match(source, /MAX_EVIDENCE_BYTES/);
  assert.match(source, /gcashEvidence\.size > MAX_EVIDENCE_BYTES/);
});

test("staff order creation uses its dedicated permission instead of order management", async () => {
  const source = await readSource("src/pages/admin/ProjectIlawOrders.tsx");
  assert.match(source, /const canCreateStaffOrder = hasPermission\("project_ilaw\.orders\.create"\)/);
  assert.match(source, /\{canCreateStaffOrder && \([\s\S]*?Create Staff Order/);
  assert.doesNotMatch(source, /\{canManage && \([\s\S]*?Create Staff Order/);
  const migration = await readSource(
    "../supabase/migrations/20261114170000_project_ilaw_staff_order_create_permission.sql",
  ).catch(async () => "");
  // Backend authorization is also migrated to the dedicated create permission.
  assert.match(migration, /project_ilaw\.orders\.create/);
});

test("Project Ilaw staff fulfillment uses a dedicated permission", async () => {
  const source = await readSource("src/pages/admin/ProjectIlawOrderDetail.tsx");
  assert.match(source, /const canFulfill = hasPermission\("project_ilaw\.orders\.fulfill"\)/);
  assert.match(source, /if \(!order \|\| !canFulfill\) return \[\] as FulfillmentStatus\[\]/);
  assert.match(source, /aria-labelledby="fulfillment-title"[\s\S]*?\{canFulfill \?/);
  const migration = await readSource(
    "../supabase/migrations/20261114180000_project_ilaw_order_fulfill_permission.sql",
  );
  assert.match(migration, /project_ilaw\.orders\.fulfill/);
  assert.match(migration, /update_project_ilaw_fulfillment/);
});
