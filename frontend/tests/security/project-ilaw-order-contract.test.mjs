import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const MIGRATION =
  "../../../supabase/migrations/20261110090000_project_ilaw_ordering.sql";

const LOOKUP_MIGRATION =
  "../../../supabase/migrations/20261113120000_project_ilaw_customer_lookup.sql";

const CASH_MIGRATION =
  "../../../supabase/migrations/20261114090000_project_ilaw_cash_payment.sql";

async function cashMigrationSource() {
  return read(CASH_MIGRATION);
}

async function lookupMigrationSource() {
  return read(LOOKUP_MIGRATION);
}

async function migrationSource() {
  return read(MIGRATION);
}

function functionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `missing function ${signature}`);
  const end = source.indexOf("$$;", start);
  assert.notEqual(end, -1, `unterminated function ${signature}`);
  return source.slice(start, end);
}

test("only the documented permissions and least-privilege role are created", async () => {
  const source = await migrationSource();

  for (const code of [
    "project_ilaw.orders.view",
    "project_ilaw.orders.confirm_payment",
    "project_ilaw.orders.manage",
    "project_ilaw.orders.export",
  ]) {
    assert.ok(source.includes(`'${code}'`), `missing permission ${code}`);
  }

  assert.match(
    source,
    /insert into public\.roles[\s\S]*?'project_ilaw_orders_staff'/,
  );

  const grantBlock = source.slice(
    source.indexOf("insert into public.role_permissions"),
    source.indexOf("create sequence"),
  );
  assert.match(grantBlock, /role\.code = 'administrator'/);
  assert.match(grantBlock, /role\.code = 'project_ilaw_orders_staff'/);
  assert.match(
    grantBlock,
    /'project_ilaw\.orders\.view',\s*'project_ilaw\.orders\.confirm_payment'/s,
  );
  assert.doesNotMatch(
    grantBlock,
    /role\.code = '(member|cell_leader|finance|pastor|trainer|ministry_leader)'/,
  );
});

test("order, line-item, activity, and settings tables are RLS-protected and read-only", async () => {
  const source = await migrationSource();

  for (const table of [
    "project_ilaw_orders",
    "project_ilaw_order_items",
    "project_ilaw_order_events",
    "project_ilaw_settings",
  ]) {
    assert.match(
      source,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }

  assert.match(
    source,
    /revoke all on public\.project_ilaw_orders, public\.project_ilaw_order_items, public\.project_ilaw_order_events, public\.project_ilaw_settings from public, anon, authenticated/,
  );
  assert.match(
    source,
    /grant select on public\.project_ilaw_orders, public\.project_ilaw_order_items, public\.project_ilaw_order_events, public\.project_ilaw_settings to authenticated/,
  );
  assert.doesNotMatch(
    source,
    /grant (insert|update|delete|all) on public\.project_ilaw_(orders|order_items|order_events|settings).*to (anon|authenticated)/i,
  );

  for (const policy of [
    "Project Ilaw viewers read orders",
    "Project Ilaw viewers read order items",
    "Project Ilaw viewers read order activity",
    "Project Ilaw viewers read settings",
  ]) {
    const start = source.indexOf(`create policy "${policy}"`);
    assert.notEqual(start, -1, `missing policy ${policy}`);
    const block = source.slice(start, start + 400);
    assert.match(block, /for select to authenticated/);
    assert.match(block, /has_permission\('project_ilaw\.orders\.view'\)/);
    assert.doesNotMatch(block, /for (insert|update|delete)/i);
  }
});

test("anonymous customers may only submit through a validating security-definer function", async () => {
  const source = await migrationSource();
  const submit = functionBody(
    source,
    "create or replace function public.submit_project_ilaw_order(",
  );

  assert.match(submit, /security definer/);
  assert.match(submit, /set search_path = ''/);
  assert.match(
    source,
    /grant execute on function public\.submit_project_ilaw_order\(uuid, text, text, text, jsonb\) to anon, authenticated/,
  );
  assert.match(submit, /project_ilaw_validated_items\(p_items\)/);
  assert.match(submit, /499/);
  assert.match(submit, /actor_type,[\s\S]*?'anonymous'/);
  assert.match(submit, /pg_advisory_xact_lock/);
  assert.match(submit, /client_request_id = p_request_id/);
  assert.doesNotMatch(submit, /has_permission/);

  // Server-side catalogue validation rejects spoofed names, sizes, and colours.
  const validation = functionBody(
    source,
    "create or replace function public.project_ilaw_validated_items(",
  );
  assert.match(validation, /product_id = 'project-ilaw-t-shirt'/);
  assert.match(validation, /size not in \('XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'\)/);
  assert.match(validation, /color not in \('Black', 'White', 'Maroon', 'Green', 'Blue'\)/);
  assert.match(validation, /product_id = 'project-ilaw-eco-bag'/);
  assert.match(validation, /size <> 'One Size'/);
  assert.match(validation, /color not in \('Maroon', 'Green', 'Blue'\)/);
  assert.match(validation, /quantity_number <> trunc\(quantity_number\)/);
  assert.match(validation, /total_amount := total_amount \+ \(quantity \* 499\)/);
});

test("payment statuses, fulfilment statuses, and colours match the contract", async () => {
  const source = await migrationSource();

  assert.match(
    source,
    /payment_status in \('awaiting_payment', 'payment_verification', 'paid'\)/,
  );
  assert.match(
    source,
    /fulfillment_status in \('not_started', 'in_production', 'ready_for_pickup', 'completed', 'cancelled'\)/,
  );
  assert.match(source, /color text not null/);
  assert.match(source, /'payment_verification'/);
  assert.match(source, /'paid'/);
  assert.match(source, /'in_production'/);
  assert.match(source, /payment_status text not null default 'awaiting_payment'/);
  assert.match(source, /fulfillment_status text not null default 'not_started'/);
});

test("public ordering and payments start disabled and are separate switches", async () => {
  const source = await migrationSource();

  assert.match(source, /create table if not exists public\.project_ilaw_settings/);
  assert.match(source, /orders_enabled boolean not null default false/);
  assert.match(source, /payments_enabled boolean not null default false/);
  assert.match(source, /production_cutoff date/);
  assert.match(source, /insert into public\.project_ilaw_settings \(id\)/);

  // Nothing invents an account or a cutoff date.
  assert.doesNotMatch(source, /gcash_account_number text not null/i);
  assert.doesNotMatch(source, /production_cutoff date not null/i);
  assert.doesNotMatch(source, /values \([^)]*'09\d{9}'/);
  assert.doesNotMatch(source, /insert into public\.project_ilaw_settings[^;]*production_cutoff[^;]*\d{4}-\d{2}-\d{2}/i);

  // The security-definer submission function rejects orders while the server
  // switch is off, before it inserts or stores anything.
  const submit = functionBody(
    source,
    "create or replace function public.submit_project_ilaw_order(",
  );
  assert.match(submit, /select \* into settings\s+from public\.project_ilaw_settings/);
  assert.match(submit, /not settings\.orders_enabled/);
  assert.match(submit, /Project Ilaw ordering is not open yet/);
  assert.ok(
    submit.indexOf("orders_enabled") <
      submit.indexOf("insert into public.project_ilaw_orders"),
    "the ordering gate must run before the order insert",
  );

  const getSettings = functionBody(
    source,
    "create or replace function public.get_project_ilaw_settings(",
  );
  assert.match(getSettings, /'orders_enabled', settings\.orders_enabled/);
  assert.match(getSettings, /'payments_enabled', settings\.payments_enabled/);

  const updateSettings = functionBody(
    source,
    "create or replace function public.update_project_ilaw_settings(",
  );
  assert.match(updateSettings, /p_orders_enabled boolean/);
  assert.match(updateSettings, /orders_enabled = coalesce\(p_orders_enabled, false\)/);
  assert.match(
    updateSettings,
    /public\.has_permission\('project_ilaw\.orders\.manage'\)/,
  );

  // The public status RPC exposes only the two switches, never account details.
  const publicSettings = functionBody(
    source,
    "create or replace function public.get_project_ilaw_public_settings(",
  );
  assert.match(publicSettings, /'orders_enabled', settings\.orders_enabled/);
  assert.match(publicSettings, /'payments_enabled', settings\.payments_enabled/);
  assert.doesNotMatch(publicSettings, /gcash|bank_account|payment_instructions/i);
  assert.match(
    source,
    /grant execute on function public\.get_project_ilaw_public_settings\(\) to anon, authenticated/,
  );
});

test("payment confirmation is manual, permission-checked, and never automatic", async () => {
  const source = await migrationSource();
  const confirm = functionBody(
    source,
    "create or replace function public.confirm_project_ilaw_payment(",
  );

  assert.match(confirm, /public\.has_permission\('project_ilaw\.orders\.confirm_payment'\)/);
  assert.match(confirm, /payment_status = 'paid'/);
  assert.match(confirm, /payment_confirmed_at = now\(\)/);
  assert.match(confirm, /payment_confirmed_by = actor/);
  assert.match(confirm, /'payment_confirmed'/);
  assert.match(confirm, /actor_type/);
  assert.match(confirm, /A cancelled order cannot be confirmed as paid/);

  // A payment can only be confirmed after the customer has submitted a
  // transaction reference and evidence for manual review.
  assert.match(
    confirm,
    /target\.payment_status <> 'payment_verification'/,
  );
  assert.match(confirm, /Only a payment awaiting verification can be confirmed/);
  assert.match(confirm, /Payment evidence is required before confirming/);
  assert.match(confirm, /target\.payment_evidence_path is null/);

  // No trigger, default, or submission path can confirm payment.
  const submit = functionBody(
    source,
    "create or replace function public.submit_project_ilaw_order(",
  );
  assert.doesNotMatch(submit, /payment_confirmed/);
  assert.doesNotMatch(submit, /payment_status = 'paid'/);
});

test("customer payment lookup requires the reference and mobile number", async () => {
  const source = await migrationSource();
  const context = functionBody(
    source,
    "create or replace function public.get_project_ilaw_payment_context(",
  );

  assert.match(context, /regexp_replace\(target\.mobile, '\[\^0-9\]', '', 'g'\) <> digits/);
  assert.match(context, /raise exception 'Order not found'/);
  assert.match(context, /'payment_token', target\.payment_token/);
  assert.match(
    source,
    /grant execute on function public\.get_project_ilaw_payment_context\(text, text\) to anon, authenticated/,
  );

  // Instructions are only returned when payments are enabled.
  assert.match(context, /when settings\.payments_enabled then/);
  assert.match(context, /jsonb_build_object\('enabled', false\)/);
});

test("payment evidence submission is token-scoped and cannot confirm payment", async () => {
  const source = await migrationSource();
  const submit = functionBody(
    source,
    "create or replace function public.submit_project_ilaw_payment(",
  );

  assert.match(submit, /target\.payment_token <> p_payment_token/);
  assert.match(
    submit,
    /'orders\/' \|\| target\.id::text \|\| '\/' \|\| target\.payment_token::text \|\| '\/%'/,
  );
  assert.match(submit, /payment_status = 'payment_verification'/);
  assert.match(submit, /payment_evidence_path = clean_evidence_path/);
  assert.doesNotMatch(submit, /set payment_status = 'paid'/);
  assert.doesNotMatch(submit, /has_permission/);

  // Payments are a separate switch: while disabled, no evidence is accepted
  // even if the caller knows the reference, mobile number, and token.
  assert.match(submit, /select \* into settings\s+from public\.project_ilaw_settings/);
  assert.match(submit, /not settings\.payments_enabled/);
  assert.match(submit, /Project Ilaw payment collection is not open yet/);
  assert.ok(
    submit.indexOf("payments_enabled") <
      submit.indexOf("update public.project_ilaw_orders"),
    "the payment gate must run before the order update",
  );

  const uploadCheck = functionBody(
    source,
    "create or replace function public.project_ilaw_can_upload_payment_evidence(",
  );
  assert.match(uploadCheck, /array_length\(parts, 1\) is distinct from 4/);
  assert.match(uploadCheck, /parts\[1\] <> 'orders'/);
  assert.match(uploadCheck, /target\.payment_token::text <> parts\[3\]/);
  assert.match(uploadCheck, /target\.payment_status = 'paid'/);
  assert.match(uploadCheck, /target\.fulfillment_status = 'cancelled'/);
  assert.match(uploadCheck, /select \* into settings\s+from public\.project_ilaw_settings/);
  assert.match(uploadCheck, /not settings\.payments_enabled/);
});

test("payment evidence lives in a private bucket with scoped storage policies", async () => {
  const source = await migrationSource();

  assert.match(source, /'project-ilaw-payment-evidence'/);
  assert.match(
    source,
    /insert into storage\.buckets[\s\S]*?'project-ilaw-payment-evidence',[\s\S]*?false,/,
  );
  assert.match(
    source,
    /create policy "Project Ilaw payment evidence upload" on storage\.objects[\s\S]*?for insert to anon, authenticated/,
  );
  assert.match(
    source,
    /create policy "Project Ilaw staff read payment evidence" on storage\.objects[\s\S]*?public\.has_permission\('project_ilaw\.orders\.view'\)/,
  );
  assert.match(source, /project_ilaw_can_upload_payment_evidence\(name\)/);
});

test("rejecting a payment returns the order to awaiting payment without deleting history", async () => {
  const source = await migrationSource();
  const reject = functionBody(
    source,
    "create or replace function public.reject_project_ilaw_payment(",
  );

  assert.match(reject, /public\.has_permission\('project_ilaw\.orders\.confirm_payment'\)/);
  assert.match(reject, /payment_status <> 'payment_verification'/);
  assert.match(reject, /payment_status = 'awaiting_payment'/);
  assert.match(reject, /payment_rejected_at = now\(\)/);
  assert.match(reject, /'payment_rejected'/);
  assert.doesNotMatch(reject, /delete from/);

  // A meaningful reason is required so the customer can correct the submission.
  assert.match(reject, /clean_reason is null or char_length\(clean_reason\) < 5/);
  assert.match(reject, /Enter a rejection reason of at least 5 characters/);
});

test("fulfilment changes and amendments require project_ilaw.orders.manage", async () => {
  const source = await migrationSource();
  const fulfillment = functionBody(
    source,
    "create or replace function public.update_project_ilaw_fulfillment(",
  );
  const amend = functionBody(
    source,
    "create or replace function public.amend_project_ilaw_order(",
  );

  for (const body of [fulfillment, amend]) {
    assert.match(body, /public\.has_permission\('project_ilaw\.orders\.manage'\)/);
    assert.match(body, /actor uuid := auth\.uid\(\)/);
  }

  assert.match(
    fulfillment,
    /previous_status = 'not_started' and clean_status in \('in_production', 'ready_for_pickup'\)/,
  );
  assert.match(fulfillment, /previous_status = 'in_production' and clean_status = 'ready_for_pickup'/);
  assert.match(fulfillment, /previous_status = 'ready_for_pickup' and clean_status = 'completed'/);
  assert.match(fulfillment, /cannot be cancelled from its current status/);
  assert.doesNotMatch(fulfillment, /payment_status =/);

  assert.match(amend, /superseded_at = now\(\)/);
  assert.match(amend, /'order_amended'/);
  assert.match(amend, /previous_snapshot/);
  assert.doesNotMatch(amend, /delete from public\.project_ilaw_order_items/);
});

test("production reports count only paid, non-cancelled orders by product, size, and colour", async () => {
  const source = await migrationSource();
  const report = functionBody(
    source,
    "create or replace function public.project_ilaw_production_report(",
  );

  assert.match(report, /public\.has_permission\('project_ilaw\.orders\.view'\)/);
  assert.match(report, /orders\.payment_status = 'paid'/);
  assert.match(report, /orders\.fulfillment_status <> 'cancelled'/);
  assert.match(report, /group by items\.product_id, items\.product_name, items\.product_type, items\.size, items\.color/);
  assert.match(report, /coalesce\(p_cutoff, settings\.production_cutoff\)/);
  assert.match(report, /'cutoff', effective_cutoff/);
  assert.match(report, /'total_quantity', total_quantity/);
});

test("settings can only be changed with project_ilaw.orders.manage", async () => {
  const source = await migrationSource();
  const update = functionBody(
    source,
    "create or replace function public.update_project_ilaw_settings(",
  );

  assert.match(update, /public\.has_permission\('project_ilaw\.orders\.manage'\)/);
  assert.match(update, /actor uuid := auth\.uid\(\)/);
  assert.match(update, /updated_by = actor/);

  // The confirmed QR is shipped with the storefront, so payments can be opened
  // without inventing text account details. Supplied details are still
  // validated as complete pairs when present.
  assert.doesNotMatch(
    update,
    /not \(gcash_complete or bank_complete\)/,
  );
  assert.match(update, /confirmed GCash InstaPay QR/);
});

test("activity history is append-only and requires view permission to read", async () => {
  const source = await migrationSource();
  const activity = functionBody(
    source,
    "create or replace function public.get_project_ilaw_order_activity(",
  );

  assert.match(activity, /public\.has_permission\('project_ilaw\.orders\.view'\)/);
  assert.match(source, /create trigger project_ilaw_order_events_append_only/);
  assert.match(source, /before update or delete on public\.project_ilaw_order_events/);
  assert.match(source, /append-only/);
});

test("CSV export is permission-checked on the server and scoped to filters", async () => {
  const source = await migrationSource();
  const exportFn = functionBody(
    source,
    "create or replace function public.project_ilaw_export_rows(",
  );

  assert.match(exportFn, /public\.has_permission\('project_ilaw\.orders\.export'\)/);
  assert.match(exportFn, /orders\.payment_status = p_payment_status/);
  assert.match(exportFn, /orders\.fulfillment_status = p_fulfillment_status/);
  assert.match(exportFn, /items\.superseded_at is null/);
  assert.match(exportFn, /items\.color/);
  assert.match(exportFn, /p_from/);
  assert.match(exportFn, /p_to/);
});

test("order notifications are scoped to the correct permission holders", async () => {
  const source = await migrationSource();
  const submit = functionBody(
    source,
    "create or replace function public.submit_project_ilaw_order(",
  );
  const payment = functionBody(
    source,
    "create or replace function public.submit_project_ilaw_payment(",
  );

  assert.match(submit, /permissions\.code = 'project_ilaw\.orders\.view'/);
  assert.match(submit, /'project_ilaw_order_created'/);
  assert.match(submit, /related_order_id/);
  assert.match(payment, /permissions\.code = 'project_ilaw\.orders\.confirm_payment'/);
  assert.match(payment, /'project_ilaw_payment_submitted'/);
  assert.match(
    source,
    /public\.has_permission\('members\.view'\)\s*or public\.has_permission\('project_ilaw\.orders\.view'\)/s,
  );
});

test("the order dashboard and detail page expose no direct table writes", async () => {
  const list = await read("../../src/pages/admin/ProjectIlawOrders.tsx");
  const detail = await read("../../src/pages/admin/ProjectIlawOrderDetail.tsx");
  const settings = await read(
    "../../src/components/fundraising/ProjectIlawSettingsPanel.tsx",
  );
  const production = await read(
    "../../src/components/fundraising/ProductionReportPanel.tsx",
  );

  for (const page of [list, detail, settings, production]) {
    assert.doesNotMatch(page, /\.from\("project_ilaw_orders"\)\s*\.(insert|update|delete)/);
    assert.doesNotMatch(page, /\.from\("project_ilaw_order_items"\)\s*\.(insert|update|delete)/);
    assert.doesNotMatch(page, /\.from\("project_ilaw_order_events"\)\s*\.(insert|update|delete)/);
    assert.doesNotMatch(page, /\.from\("project_ilaw_settings"\)\s*\.(insert|update|delete)/);
    assert.doesNotMatch(page, /service_role|SERVICE_ROLE/);
  }

  assert.match(detail, /hasPermission\(\s*"project_ilaw\.orders\.confirm_payment"/);
  assert.match(detail, /hasPermission\(\s*"project_ilaw\.orders\.manage"/);
  assert.match(list, /hasPermission\(\s*"project_ilaw\.orders\.export"/);
  assert.match(settings, /hasPermission\(\s*"project_ilaw\.orders\.manage"/);
  assert.match(production, /hasPermission\(\s*"project_ilaw\.orders\.export"/);

  // Staff can confirm only after evidence is under verification, and a
  // rejection cannot be submitted without a meaningful reason.
  assert.match(detail, /Rejection reason \(required\)/);
  assert.match(
    detail,
    /Enter a rejection reason of at least 5 characters/,
  );
  assert.match(detail, /rejectReason\.trim\(\)\.length < 5/);
  assert.match(detail, /awaitingVerification && \(\s*<Button/s);
  assert.match(detail, /disabled=\{Boolean\(busy\) \|\| !evidencePath\}/);

  // Evidence is opened through a short-lived signed URL, never a public URL.
  assert.match(detail, /getPaymentEvidenceUrl/);
  assert.doesNotMatch(detail, /getPublicUrl/);
});

const required = [
  "PILAW_TEST_SUPABASE_URL",
  "PILAW_TEST_SUPABASE_ANON_KEY",
  "PILAW_TEST_SERVICE_ROLE_KEY",
  "PILAW_TEST_VIEWER_EMAIL",
  "PILAW_TEST_VIEWER_PASSWORD",
  "PILAW_TEST_CONFIRM_EMAIL",
  "PILAW_TEST_CONFIRM_PASSWORD",
  "PILAW_TEST_MANAGER_EMAIL",
  "PILAW_TEST_MANAGER_PASSWORD",
  "PILAW_TEST_OUTSIDER_EMAIL",
  "PILAW_TEST_OUTSIDER_PASSWORD",
];
const missing = required.filter((key) => !process.env[key]);
const integration = (name, run) =>
  missing.length
    ? test(
        name,
        {
          skip: `Missing disposable Supabase authorization fixture: ${missing.join(", ")}`,
        },
        run,
      )
    : test(name, run);

integration(
  "anonymous submission, payment evidence, RLS, and permission enforcement against a disposable Supabase project",
  async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.PILAW_TEST_SUPABASE_URL;
    const anonKey = process.env.PILAW_TEST_SUPABASE_ANON_KEY;
    const client = (key = anonKey) =>
      createClient(url, key, { auth: { persistSession: false } });

    const anon = client();
    const viewer = client();
    const confirmer = client();
    const manager = client();
    const outsider = client();
    const service = client(process.env.PILAW_TEST_SERVICE_ROLE_KEY);

    for (const [key, instance] of [
      ["VIEWER", viewer],
      ["CONFIRM", confirmer],
      ["MANAGER", manager],
      ["OUTSIDER", outsider],
    ]) {
      const { error } = await instance.auth.signInWithPassword({
        email: process.env[`PILAW_TEST_${key}_EMAIL`],
        password: process.env[`PILAW_TEST_${key}_PASSWORD`],
      });
      assert.ifError(error);
    }

    // Public ordering starts closed and the server function rejects orders even
    // when the caller bypasses the Shop interface.
    const publicStatus = await anon.rpc("get_project_ilaw_public_settings");
    assert.ifError(publicStatus.error);
    assert.deepEqual(Object.keys(publicStatus.data).sort(), [
      "orders_enabled",
      "payments_enabled",
    ]);
    assert.equal(publicStatus.data.orders_enabled, false);
    assert.equal(publicStatus.data.payments_enabled, false);

    const closedSubmission = await anon.rpc("submit_project_ilaw_order", {
      p_request_id: crypto.randomUUID(),
      p_customer_name: "Integration Test",
      p_mobile: "09171234567",
      p_notes: null,
      p_items: [
        {
          productId: "project-ilaw-t-shirt",
          size: "M",
          color: "Black",
          quantity: 1,
        },
      ],
    });
    assert.ok(closedSubmission.error, "ordering is closed by default");
    assert.match(closedSubmission.error.message, /not open/i);

    const publicInstructions = await anon.rpc(
      "get_project_ilaw_payment_instructions",
    );
    assert.ifError(publicInstructions.error);
    assert.equal(publicInstructions.data.enabled, false);
    assert.equal(publicInstructions.data.gcash_account_number, undefined);

    // Only a manager may open public ordering. Payment details stay disabled.
    const opened = await manager.rpc("update_project_ilaw_settings", {
      p_orders_enabled: true,
      p_payments_enabled: false,
      p_gcash_account_name: null,
      p_gcash_account_number: null,
      p_bank_name: null,
      p_bank_account_name: null,
      p_bank_account_number: null,
      p_payment_instructions: null,
      p_production_cutoff: null,
    });
    assert.ifError(opened.error);
    assert.equal(opened.data.orders_enabled, true);
    assert.equal(opened.data.payments_enabled, false);

    // Public submission uses server-side pricing and rejects spoofed sizes.
    const bad = await anon.rpc("submit_project_ilaw_order", {
      p_request_id: crypto.randomUUID(),
      p_customer_name: "Integration Test",
      p_mobile: "09171234567",
      p_notes: null,
      p_items: [{ productId: "project-ilaw-eco-bag", size: "XL", quantity: 1 }],
    });
    assert.ok(bad.error, "an invalid size must be rejected");

    const badColour = await anon.rpc("submit_project_ilaw_order", {
      p_request_id: crypto.randomUUID(),
      p_customer_name: "Integration Test",
      p_mobile: "09171234567",
      p_notes: null,
      p_items: [
        {
          productId: "project-ilaw-eco-bag",
          size: "One Size",
          color: "Black",
          quantity: 1,
        },
      ],
    });
    assert.ok(badColour.error, "an invalid eco bag handle colour must be rejected");

    const requestId = crypto.randomUUID();
    const submitted = await anon.rpc("submit_project_ilaw_order", {
      p_request_id: requestId,
      p_customer_name: "Integration Test",
      p_mobile: "09171234567",
      p_notes: "created by the automated security test",
      p_items: [
        {
          productId: "project-ilaw-t-shirt",
          size: "M",
          color: "Black",
          quantity: 2,
        },
        {
          productId: "project-ilaw-eco-bag",
          size: "One Size",
          color: "Green",
          quantity: 1,
        },
      ],
    });
    assert.ifError(submitted.error);
    assert.equal(submitted.data.total_quantity, 3);
    assert.equal(submitted.data.total_amount, 1497);
    assert.equal(submitted.data.payment_status, "awaiting_payment");
    assert.equal(submitted.data.fulfillment_status, "not_started");

    const retry = await anon.rpc("submit_project_ilaw_order", {
      p_request_id: requestId,
      p_customer_name: "Integration Test",
      p_mobile: "09171234567",
      p_notes: null,
      p_items: [
        {
          productId: "project-ilaw-t-shirt",
          size: "M",
          color: "Black",
          quantity: 1,
        },
      ],
    });
    assert.ifError(retry.error);
    assert.equal(retry.data.duplicate, true);
    assert.equal(retry.data.reference, submitted.data.reference);
    assert.equal(retry.data.total_amount, 1497);

    const orderId = submitted.data.order_id;

    // Reference alone is not enough; the mobile number must match too.
    const wrongMobile = await anon.rpc("get_project_ilaw_payment_context", {
      p_reference: submitted.data.reference,
      p_mobile: "09999999999",
    });
    assert.ok(wrongMobile.error, "reference alone must not reveal the order");

    const context = await anon.rpc("get_project_ilaw_payment_context", {
      p_reference: submitted.data.reference,
      p_mobile: "09171234567",
    });
    assert.ifError(context.error);
    assert.equal(context.data.payment_token, submitted.data.payment_token);
    assert.equal(context.data.instructions.enabled, false);

    const anonymousRead = await anon
      .from("project_ilaw_orders")
      .select("id")
      .eq("id", orderId);
    assert.ok(anonymousRead.error, "anonymous customers cannot read orders");

    const anonymousItems = await anon
      .from("project_ilaw_order_items")
      .select("id")
      .eq("order_id", orderId);
    assert.ok(anonymousItems.error, "anonymous customers cannot read items");

    const anonymousActivity = await anon
      .from("project_ilaw_order_events")
      .select("id")
      .eq("order_id", orderId);
    assert.ok(anonymousActivity.error, "anonymous customers cannot read activity");

    const outsiderRead = await outsider
      .from("project_ilaw_orders")
      .select("id")
      .eq("id", orderId);
    assert.ifError(outsiderRead.error);
    assert.equal(outsiderRead.data.length, 0, "RLS hides orders from other roles");

    const viewerRead = await viewer
      .from("project_ilaw_orders")
      .select("id,reference")
      .eq("id", orderId)
      .single();
    assert.ifError(viewerRead.error);
    assert.equal(viewerRead.data.id, orderId);

    const viewerConfirm = await viewer.rpc("confirm_project_ilaw_payment", {
      p_order_id: orderId,
      p_note: null,
    });
    assert.ok(viewerConfirm.error, "view-only access cannot confirm payment");

    const viewerReject = await viewer.rpc("reject_project_ilaw_payment", {
      p_order_id: orderId,
      p_reason: null,
    });
    assert.ok(viewerReject.error, "view-only access cannot reject payment");

    const viewerSettings = await viewer.rpc("update_project_ilaw_settings", {
      p_orders_enabled: false,
      p_payments_enabled: false,
      p_gcash_account_name: null,
      p_gcash_account_number: null,
      p_bank_name: null,
      p_bank_account_name: null,
      p_bank_account_number: null,
      p_payment_instructions: null,
      p_production_cutoff: null,
    });
    assert.ok(viewerSettings.error, "view-only access cannot change settings");

    const confirmerSettings = await confirmer.rpc(
      "update_project_ilaw_settings",
      {
        p_orders_enabled: false,
        p_payments_enabled: false,
        p_gcash_account_name: null,
        p_gcash_account_number: null,
        p_bank_name: null,
        p_bank_account_name: null,
        p_bank_account_number: null,
        p_payment_instructions: null,
        p_production_cutoff: null,
      },
    );
    assert.ok(
      confirmerSettings.error,
      "payment confirmation does not grant settings management",
    );

    // Payment evidence upload is restricted to the order's token-scoped path.
    const evidencePath = `orders/${orderId}/${submitted.data.payment_token}/evidence.png`;

    // Payments are still disabled even though ordering is open. The correct
    // token-scoped path must still be rejected, and the payment RPC must not
    // accept evidence as though collection were active.
    const disabledUpload = await anon.storage
      .from("project-ilaw-payment-evidence")
      .upload(evidencePath, new Blob(["x"]), { contentType: "image/png" });
    assert.ok(
      disabledUpload.error,
      "evidence uploads stay closed while payments are disabled",
    );

    const disabledPayment = await anon.rpc("submit_project_ilaw_payment", {
      p_reference: submitted.data.reference,
      p_mobile: "09171234567",
      p_payment_token: submitted.data.payment_token,
      p_payment_reference: "GC-DISABLED-001",
      p_evidence_path: evidencePath,
    });
    assert.ok(
      disabledPayment.error,
      "payment evidence is rejected while payments are disabled",
    );
    assert.match(disabledPayment.error.message, /payment collection is not open/i);

    // A manager opens payments with a test-only receiving account in the
    // disposable project. Ordering and payments are separate switches.
    const paymentsOpened = await manager.rpc("update_project_ilaw_settings", {
      p_orders_enabled: true,
      p_payments_enabled: true,
      p_gcash_account_name: "Integration Test",
      p_gcash_account_number: "09170000000",
      p_bank_name: null,
      p_bank_account_name: null,
      p_bank_account_number: null,
      p_payment_instructions: null,
      p_production_cutoff: null,
    });
    assert.ifError(paymentsOpened.error);
    assert.equal(paymentsOpened.data.orders_enabled, true);
    assert.equal(paymentsOpened.data.payments_enabled, true);

    const wrongPathUpload = await anon.storage
      .from("project-ilaw-payment-evidence")
      .upload(`orders/${orderId}/${crypto.randomUUID()}/evidence.png`, new Blob(["x"]), {
        contentType: "image/png",
      });
    assert.ok(wrongPathUpload.error, "evidence upload needs the order token");

    // Confirmation is impossible until the customer submits evidence.
    const prematureConfirm = await confirmer.rpc(
      "confirm_project_ilaw_payment",
      { p_order_id: orderId, p_note: null },
    );
    assert.ok(
      prematureConfirm.error,
      "payment cannot be confirmed before evidence is submitted",
    );

    const payment = await anon.rpc("submit_project_ilaw_payment", {
      p_reference: submitted.data.reference,
      p_mobile: "09171234567",
      p_payment_token: submitted.data.payment_token,
      p_payment_reference: "GC-INTEGRATION-001",
      p_evidence_path: evidencePath,
    });
    assert.ifError(payment.error);
    assert.equal(payment.data.payment_status, "payment_verification");

    const viewerEvidence = await viewer.storage
      .from("project-ilaw-payment-evidence")
      .createSignedUrl(evidencePath, 60);
    // The fixture uploads no real object, so a missing object is acceptable;
    // the call must not fail for lack of permission.
    assert.ok(
      !viewerEvidence.error || /not found/i.test(viewerEvidence.error.message),
      "viewers may request evidence URLs",
    );

    const outsiderEvidence = await outsider.storage
      .from("project-ilaw-payment-evidence")
      .createSignedUrl(evidencePath, 60);
    assert.ok(outsiderEvidence.error, "outsiders cannot read evidence");

    // A rejection must carry a meaningful reason.
    const shortReject = await confirmer.rpc("reject_project_ilaw_payment", {
      p_order_id: orderId,
      p_reason: "no",
    });
    assert.ok(shortReject.error, "rejections require a real reason");

    const reject = await confirmer.rpc("reject_project_ilaw_payment", {
      p_order_id: orderId,
      p_reason: "integration rejection",
    });
    assert.ifError(reject.error);
    assert.equal(reject.data.payment_status, "awaiting_payment");

    // The customer resubmits after the rejection, then staff confirm manually.
    const resubmitted = await anon.rpc("submit_project_ilaw_payment", {
      p_reference: submitted.data.reference,
      p_mobile: "09171234567",
      p_payment_token: submitted.data.payment_token,
      p_payment_reference: "GC-INTEGRATION-002",
      p_evidence_path: evidencePath,
    });
    assert.ifError(resubmitted.error);
    assert.equal(resubmitted.data.payment_status, "payment_verification");

    const confirm = await confirmer.rpc("confirm_project_ilaw_payment", {
      p_order_id: orderId,
      p_note: "integration verification",
    });
    assert.ifError(confirm.error);
    assert.equal(confirm.data.payment_status, "paid");

    const viewerFulfillment = await viewer.rpc(
      "update_project_ilaw_fulfillment",
      { p_order_id: orderId, p_status: "in_production", p_note: null },
    );
    assert.ok(viewerFulfillment.error, "view-only access cannot change fulfillment");

    const managerFulfillment = await manager.rpc(
      "update_project_ilaw_fulfillment",
      { p_order_id: orderId, p_status: "in_production", p_note: null },
    );
    assert.ifError(managerFulfillment.error);
    assert.equal(managerFulfillment.data.fulfillment_status, "in_production");

    const invalidTransition = await manager.rpc(
      "update_project_ilaw_fulfillment",
      { p_order_id: orderId, p_status: "completed", p_note: null },
    );
    assert.ok(invalidTransition.error, "in_production cannot jump to completed");

    const activity = await viewer.rpc("get_project_ilaw_order_activity", {
      p_order_id: orderId,
    });
    assert.ifError(activity.error);
    assert.ok(
      activity.data.some((event) => event.event_type === "payment_submitted"),
    );
    assert.ok(
      activity.data.some((event) => event.event_type === "payment_rejected"),
    );
    assert.ok(
      activity.data.some((event) => event.event_type === "payment_confirmed"),
    );

    const unpaid = await anon.rpc("submit_project_ilaw_order", {
      p_request_id: crypto.randomUUID(),
      p_customer_name: "Integration Test",
      p_mobile: "09171234567",
      p_notes: "awaiting payment; must not count as production",
      p_items: [
        {
          productId: "project-ilaw-t-shirt",
          size: "3XL",
          color: "Blue",
          quantity: 1,
        },
      ],
    });
    assert.ifError(unpaid.error);

    const production = await viewer.rpc("project_ilaw_production_report", {});
    assert.ifError(production.error);
    assert.ok(
      production.data.rows.some(
        (row) =>
          row.product_id === "project-ilaw-t-shirt" &&
          row.size === "M" &&
          row.color === "Black" &&
          row.quantity >= 2,
      ),
    );
    assert.ok(
      !production.data.rows.some(
        (row) => row.size === "3XL" && row.color === "Blue",
      ),
      "orders that are not paid never count as confirmed production",
    );

    const outsiderExport = await outsider.rpc("project_ilaw_export_rows", {});
    assert.ok(outsiderExport.error, "export requires its own permission");

    const viewerExport = await viewer.rpc("project_ilaw_export_rows", {});
    assert.ok(viewerExport.error, "view permission alone cannot export");

    const managerExport = await manager.rpc("project_ilaw_export_rows", {
      p_payment_status: "paid",
    });
    assert.ifError(managerExport.error);
    assert.ok(
      managerExport.data.some((row) => row.order_reference === submitted.data.reference),
    );

    const directWrite = await manager
      .from("project_ilaw_orders")
      .update({ total_amount: 1 })
      .eq("id", orderId);
    assert.ok(directWrite.error, "authenticated table writes are revoked");

    // Append-only activity cannot be modified even with the service role.
    const events = await service
      .from("project_ilaw_order_events")
      .select("id")
      .eq("order_id", orderId)
      .limit(1);
    assert.ifError(events.error);
    if (events.data.length) {
      const mutation = await service
        .from("project_ilaw_order_events")
        .update({ note: "tampered" })
        .eq("id", events.data[0].id);
      assert.ok(mutation.error, "activity rows are append-only");
    }
  },
);
test("customer lookup by name and mobile requires both and normalizes inputs", async () => {
  const source = await lookupMigrationSource();
  const fn = functionBody(
    source,
    "create or replace function public.get_project_ilaw_payment_contexts_by_customer(",
  );

  assert.match(fn, /p_name text/);
  assert.match(fn, /p_mobile text/);
  assert.match(fn, /clean_name text := lower\(trim\(regexp_replace/);
  assert.match(fn, /norm_mobile text := public\.normalize_project_ilaw_mobile\(p_mobile\)/);
  assert.match(fn, /if clean_name = '' or norm_mobile is null then/);
  assert.match(fn, /Name and mobile number are required/);
  assert.match(fn, /public\.normalize_project_ilaw_mobile\(o\.mobile\) = norm_mobile/);
  assert.match(fn, /lower\(trim\(regexp_replace\(o\.customer_name/);
  assert.match(
    fn,
    /jsonb_build_object\([\s\S]*?'reference', o\.reference[\s\S]*?'payment_status', o\.payment_status/,
  );
  assert.doesNotMatch(fn, /'payment_token'/);
});

test("customer lookup is rate limited per normalised mobile number", async () => {
  const source = await lookupMigrationSource();

  assert.match(source, /create table if not exists public\.project_ilaw_customer_lookup_attempts/);
  assert.match(source, /mobile_hash text not null/);
  assert.match(source, /attempted_at timestamptz not null default now\(\)/);
  assert.match(source, /project_ilaw_customer_lookup_attempts_mobile_hash_idx/);

  const fn = functionBody(
    source,
    "create or replace function public.get_project_ilaw_payment_contexts_by_customer(",
  );
  assert.match(fn, /select count\(\*\) into attempt_count/);
  assert.match(fn, /mobile_hash = v_mobile_hash/);
  assert.match(fn, /attempted_at > now\(\) - interval '15 minutes'/);
  assert.match(fn, /if attempt_count >= 10 then/);
  assert.match(fn, /Too many lookup attempts/);
  assert.match(fn, /insert into public\.project_ilaw_customer_lookup_attempts/);
});

test("customer lookup and normaliser are granted to anonymous customers", async () => {
  const source = await lookupMigrationSource();

  assert.match(
    source,
    /grant execute on function public\.get_project_ilaw_payment_contexts_by_customer\(text, text\) to anon, authenticated/,
  );
  assert.match(
    source,
    /revoke all on function public\.get_project_ilaw_payment_contexts_by_customer\(text, text\) from public/,
  );
  assert.match(
    source,
    /grant execute on function public\.normalize_project_ilaw_mobile\(text\) to anon, authenticated/,
  );
});

test("the customer payment panel uses name plus mobile lookup", async () => {
  const panel = await read("../../src/components/fundraising/PaymentPanel.tsx");
  const service = await read("../../src/features/fundraising/orderService.ts");

  assert.match(panel, /getProjectIlawPaymentContextsByCustomer/);
  assert.match(service, /getProjectIlawPaymentContextsByCustomer/);
  assert.match(panel, /id="payment-name"/);
  assert.match(panel, /id="payment-mobile"/);
  assert.doesNotMatch(panel, /id="payment-reference"/);
  assert.match(panel, /required/);
  assert.match(panel, /openOrder/);
});
test("cash payment recording is a secure, separate path that still marks orders paid", async () => {
  const source = await cashMigrationSource();
  const fn = functionBody(
    source,
    "create or replace function public.record_project_ilaw_cash_payment(",
  );

  assert.match(fn, /public\.has_permission\('project_ilaw\.orders\.confirm_payment'\)/);
  assert.match(fn, /actor uuid := auth\.uid\(\)/);
  assert.match(fn, /if actor is null then/);
  assert.match(fn, /if not coalesce\(p_confirmed_received, false\) then/);
  assert.match(fn, /Confirm that the cash was physically received/);
  assert.match(fn, /if p_amount <> target\.total_amount then/);
  assert.match(fn, /The amount received must match the order total/);
  assert.match(fn, /if target\.payment_status = 'paid' then/);
  assert.match(fn, /Payment is already confirmed/);
  assert.match(fn, /if target\.fulfillment_status = 'cancelled' then/);
  assert.match(fn, /payment_method = 'cash'/);
  assert.match(fn, /payment_amount_received = p_amount/);
  assert.match(fn, /'payment_confirmed'/);

  // Cash must not require evidence; GCash confirmation still does.
  const confirm = functionBody(
    source,
    "create or replace function public.confirm_project_ilaw_payment(",
  );
  assert.match(confirm, /payment_evidence_path is null/);
  assert.match(confirm, /Payment evidence is required before confirming/);
  assert.match(confirm, /payment_method = 'gcash'/);
});

test("cash payment adds columns without removing existing payment data", async () => {
  const source = await cashMigrationSource();

  assert.match(source, /add column if not exists payment_method text/);
  assert.match(source, /add column if not exists payment_amount_received integer/);
  assert.match(source, /payment_method is null or payment_method in \('gcash', 'cash'\)/);
  assert.match(
    source,
    /revoke all on function public\.record_project_ilaw_cash_payment/,
  );
  assert.match(
    source,
    /grant execute on function public\.record_project_ilaw_cash_payment\(uuid, integer, boolean, text\) to authenticated/,
  );
});

test("the order management page no longer renders the settings panel", async () => {
  const page = await read("../../src/pages/admin/ProjectIlawOrders.tsx");

  assert.doesNotMatch(page, /ProjectIlawSettingsPanel/);
  assert.doesNotMatch(page, /ProductionReportPanel/);
});
