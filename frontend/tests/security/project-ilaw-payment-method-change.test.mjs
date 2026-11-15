import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function functionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `missing function ${signature}`);
  const end = source.indexOf("$$;", start);
  assert.notEqual(end, -1, `unterminated function ${signature}`);
  return source.slice(start, end);
}

test("payment method changes use an authenticated, permission-checked RPC", async () => {
  const migration = await read(
    "../../../supabase/migrations/20261115131500_project_ilaw_payment_method_change.sql",
  );
  const fn = functionBody(
    migration,
    "create or replace function public.update_project_ilaw_payment_method(",
  );

  assert.match(fn, /security definer/);
  assert.match(fn, /set search_path = ''/);
  assert.match(fn, /actor uuid := auth\.uid\(\)/);
  assert.match(fn, /project_ilaw\.orders\.confirm_payment/);
  assert.match(fn, /project_ilaw\.orders\.manage/);
  assert.match(fn, /clean_payment_method not in \('gcash', 'cash'\)/);
  assert.match(fn, /for update/);
  assert.match(
    migration,
    /revoke all on function public\.update_project_ilaw_payment_method\(uuid, text\)\s+from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.update_project_ilaw_payment_method\(uuid, text\)\s+to authenticated/,
  );
});

test("payment method is locked after payment submission or fulfillment starts", async () => {
  const migration = await read(
    "../../../supabase/migrations/20261115131500_project_ilaw_payment_method_change.sql",
  );
  const fn = functionBody(
    migration,
    "create or replace function public.update_project_ilaw_payment_method(",
  );

  assert.match(fn, /target\.payment_status <> 'awaiting_payment'/);
  assert.match(fn, /target\.fulfillment_status <> 'not_started'/);
  assert.match(fn, /target\.payment_method is not distinct from clean_payment_method/);
  assert.match(fn, /A valid customer mobile number is required for GCash/);
  assert.doesNotMatch(fn, /set payment_status\s*=/);
});

test("changing method clears stale rejected receipt fields but records them in history", async () => {
  const migration = await read(
    "../../../supabase/migrations/20261115131500_project_ilaw_payment_method_change.sql",
  );
  const fn = functionBody(
    migration,
    "create or replace function public.update_project_ilaw_payment_method(",
  );

  assert.match(fn, /'payment_reference', target\.payment_reference/);
  assert.match(fn, /'payment_evidence_path', target\.payment_evidence_path/);
  assert.match(fn, /'payment_rejected_at', target\.payment_rejected_at/);
  assert.match(fn, /payment_reference = null/);
  assert.match(fn, /payment_evidence_path = null/);
  assert.match(fn, /payment_rejected_at = null/);
  assert.match(fn, /'payment_method_changed'/);
  assert.match(
    migration,
    /'payment_method_changed'[\s\S]*?'order_cancelled'/,
  );
});

test("order detail exposes Edit only for authorised, not-yet-paid orders", async () => {
  const page = await read("../../src/pages/admin/ProjectIlawOrderDetail.tsx");
  const service = await read("../../src/features/fundraising/orderService.ts");
  const model = await read("../../src/features/fundraising/projectIlaw.ts");

  assert.match(page, /payment_method_changed: "Payment method changed"/);
  assert.match(page, /\(canConfirmPayment \|\| canManage\)/);
  assert.match(page, /order\.paymentStatus === "awaiting_payment"/);
  assert.match(page, /order\.fulfillmentStatus === "not_started"/);
  assert.match(page, /<option value="gcash">GCash<\/option>/);
  assert.match(page, /<option value="cash">Cash<\/option>/);
  assert.match(page, /Save payment method/);
  assert.match(page, /await updateProjectIlawPaymentMethod\(order\.id, paymentMethodDraft\)/);
  assert.match(service, /supabase\.rpc\("update_project_ilaw_payment_method"/);
  assert.match(model, /"payment_method_changed"/);
  assert.match(page, /Payment method changed/);
});
