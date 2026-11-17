import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const MIGRATION =
  "../../../supabase/migrations/20261117131848_project_ilaw_payment_details.sql";

function functionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `missing function ${signature}`);
  const end = source.indexOf("$function$;", start);
  assert.notEqual(end, -1, `unterminated function ${signature}`);
  return source.slice(start, end);
}

test("payment detail edits are authenticated, permission checked, and narrowly scoped", async () => {
  const migration = await read(MIGRATION);
  const fn = functionBody(
    migration,
    "create or replace function public.update_project_ilaw_payment_details(",
  );

  assert.match(fn, /security definer/);
  assert.match(fn, /set search_path = ''/);
  assert.match(fn, /actor uuid := auth\.uid\(\)/);
  assert.match(fn, /project_ilaw\.orders\.confirm_payment/);
  assert.match(fn, /project_ilaw\.orders\.manage/);
  assert.match(fn, /for update/);
  assert.match(fn, /p_total_amount is null/);
  assert.match(fn, /p_total_amount > 9999999/);
  assert.match(fn, /update public\.project_ilaw_orders/);
  assert.doesNotMatch(fn, /update public\.project_ilaw_order_items/);
  assert.match(
    migration,
    /revoke all on function public\.update_project_ilaw_payment_details\(uuid, text, integer\)\s+from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.update_project_ilaw_payment_details\(uuid, text, integer\)\s+to authenticated/,
  );
});

test("paid orders can be corrected but payment verification and cancelled orders stay locked", async () => {
  const migration = await read(MIGRATION);
  const fn = functionBody(
    migration,
    "create or replace function public.update_project_ilaw_payment_details(",
  );

  assert.match(fn, /target\.payment_status not in \('awaiting_payment', 'paid'\)/);
  assert.match(fn, /target\.fulfillment_status = 'cancelled'/);
  assert.match(fn, /target\.payment_status = 'awaiting_payment'/);
  assert.match(fn, /target\.fulfillment_status <> 'not_started'/);
  assert.match(fn, /payment_status = 'paid'/);
  assert.match(fn, /'payment_amount_received', target\.payment_amount_received/);
  assert.ok(fn.includes("payment_amount_received = case"));
  assert.ok(fn.includes("coalesce(payment_amount_received, target.total_amount)"));
  assert.doesNotMatch(fn, /payment_amount_received = p_total_amount/);
});

test("the amount due adjustment preserves item prices and remains auditable", async () => {
  const migration = await read(MIGRATION);
  const fn = functionBody(
    migration,
    "create or replace function public.update_project_ilaw_payment_details(",
  );
  const totals = functionBody(
    migration,
    "create or replace function public.verify_project_ilaw_order_totals()",
  );

  assert.match(fn, /active_subtotal/);
  assert.match(fn, /next_adjustment := p_total_amount - active_subtotal/);
  assert.match(fn, /total_amount_adjustment = next_adjustment/);
  assert.match(fn, /'payment_details_changed'/);
  assert.match(fn, /'total_amount_adjustment', target\.total_amount_adjustment/);
  assert.match(fn, /previous_value/);
  assert.match(totals, /total_amount <> active_amount \+ total_amount_adjustment/);
  assert.match(migration, /Payment method and\/or amount due changed by authorised staff/i);
  assert.match(migration, /total_amount_adjustment/);
});

test("Project Ilaw order amendment preserves existing price adjustments", async () => {
  const migration = await read(MIGRATION);

  assert.match(migration, /amend_project_ilaw_order\(uuid,text,text,text,jsonb,text\)/);
  assert.match(migration, /existing price adjustment would make the revised amount due invalid/);
  assert.match(migration, /total_amount = \(validated ->> 'total_amount'\)::integer \+ target\.total_amount_adjustment/);
});

test("the Payment card uses one compact pencil action for both editable fields", async () => {
  const page = await read("../../src/pages/admin/ProjectIlawOrderDetail.tsx");
  const service = await read("../../src/features/fundraising/orderService.ts");

  assert.match(page, /className="pilaw-card-edit-button"/);
  assert.match(page, /<PencilLine size=\{17\}/);
  assert.match(page, /aria-label="Edit payment details"/);
  assert.match(page, /editingPaymentDetails/);
  assert.match(page, /project-ilaw-payment-method-select/);
  assert.match(page, /project-ilaw-payment-amount/);
  assert.match(page, /updateProjectIlawPaymentDetails\(/);
  assert.match(page, /order\.paymentStatus === "awaiting_payment" \|\| paid/);
  assert.match(service, /supabase\.rpc\("update_project_ilaw_payment_details"/);
  assert.doesNotMatch(page, /updateProjectIlawPaymentMethod/);
});
