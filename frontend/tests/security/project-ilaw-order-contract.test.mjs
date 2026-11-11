import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const MIGRATION =
  "../../../supabase/migrations/20261110090000_project_ilaw_ordering.sql";

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

test("order, line-item, and activity tables are RLS-protected and read-only to permitted staff", async () => {
  const source = await migrationSource();

  for (const table of [
    "project_ilaw_orders",
    "project_ilaw_order_items",
    "project_ilaw_order_events",
  ]) {
    assert.match(
      source,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }

  assert.match(
    source,
    /revoke all on public\.project_ilaw_orders, public\.project_ilaw_order_items, public\.project_ilaw_order_events from public, anon, authenticated/,
  );
  assert.match(
    source,
    /grant select on public\.project_ilaw_orders, public\.project_ilaw_order_items, public\.project_ilaw_order_events to authenticated/,
  );
  assert.doesNotMatch(
    source,
    /grant (insert|update|delete|all) on public\.project_ilaw_(orders|order_items|order_events).*to (anon|authenticated)/i,
  );

  for (const policy of [
    "Project Ilaw viewers read orders",
    "Project Ilaw viewers read order items",
    "Project Ilaw viewers read order activity",
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

  // Server-side catalogue validation rejects spoofed names and prices.
  const validation = functionBody(
    source,
    "create or replace function public.project_ilaw_validated_items(",
  );
  assert.match(validation, /product_id = 'project-ilaw-t-shirt'/);
  assert.match(validation, /size not in \('XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'\)/);
  assert.match(validation, /product_id = 'project-ilaw-eco-bag'/);
  assert.match(validation, /size <> 'One Size'/);
  assert.match(validation, /quantity_number <> trunc\(quantity_number\)/);
  assert.match(validation, /total_amount := total_amount \+ \(quantity \* 499\)/);
});

test("payment confirmation is manual, permission-checked, and never automatic", async () => {
  const source = await migrationSource();
  const confirm = functionBody(
    source,
    "create or replace function public.confirm_project_ilaw_payment(",
  );

  assert.match(confirm, /public\.has_permission\('project_ilaw\.orders\.confirm_payment'\)/);
  assert.match(confirm, /payment_status = 'payment_confirmed'/);
  assert.match(confirm, /payment_confirmed_at = now\(\)/);
  assert.match(confirm, /payment_confirmed_by = actor/);
  assert.match(confirm, /'payment_confirmed'/);
  assert.match(confirm, /actor_type/);
  assert.match(confirm, /A cancelled order cannot be confirmed as paid/);

  // No trigger, default, or submission path can confirm payment.
  const submit = functionBody(
    source,
    "create or replace function public.submit_project_ilaw_order(",
  );
  assert.doesNotMatch(submit, /payment_confirmed/);
  assert.match(source, /payment_status text not null default 'awaiting_payment'/);
  assert.match(source, /fulfillment_status text not null default 'not_started'/);
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
    /previous_status = 'not_started' and clean_status in \('processing', 'ready_for_pickup'\)/,
  );
  assert.match(fulfillment, /previous_status = 'processing' and clean_status = 'ready_for_pickup'/);
  assert.match(fulfillment, /previous_status = 'ready_for_pickup' and clean_status = 'completed'/);
  assert.match(fulfillment, /cannot be cancelled from its current status/);
  assert.doesNotMatch(fulfillment, /payment_status =/);

  assert.match(amend, /superseded_at = now\(\)/);
  assert.match(amend, /'order_amended'/);
  assert.match(amend, /previous_snapshot/);
  assert.doesNotMatch(amend, /delete from public\.project_ilaw_order_items/);
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
  assert.match(exportFn, /p_from/);
  assert.match(exportFn, /p_to/);
});

test("order notifications are scoped to holders of project_ilaw.orders.view", async () => {
  const source = await migrationSource();
  const submit = functionBody(
    source,
    "create or replace function public.submit_project_ilaw_order(",
  );

  assert.match(submit, /permissions\.code = 'project_ilaw\.orders\.view'/);
  assert.match(submit, /'project_ilaw_order_created'/);
  assert.match(submit, /related_order_id/);
  assert.match(
    source,
    /public\.has_permission\('members\.view'\)\s*or public\.has_permission\('project_ilaw\.orders\.view'\)/s,
  );
});

test("the order dashboard and detail page expose no direct table writes", async () => {
  const list = await read("../../src/pages/admin/ProjectIlawOrders.tsx");
  const detail = await read("../../src/pages/admin/ProjectIlawOrderDetail.tsx");

  for (const page of [list, detail]) {
    assert.doesNotMatch(page, /\.from\("project_ilaw_orders"\)\s*\.(insert|update|delete)/);
    assert.doesNotMatch(page, /\.from\("project_ilaw_order_items"\)\s*\.(insert|update|delete)/);
    assert.doesNotMatch(page, /\.from\("project_ilaw_order_events"\)\s*\.(insert|update|delete)/);
    assert.doesNotMatch(page, /service_role|SERVICE_ROLE/);
  }

  assert.match(detail, /hasPermission\(\s*"project_ilaw\.orders\.confirm_payment"/);
  assert.match(detail, /hasPermission\(\s*"project_ilaw\.orders\.manage"/);
  assert.match(list, /hasPermission\(\s*"project_ilaw\.orders\.export"/);
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
  "anonymous submission, RLS, and permission enforcement against a disposable Supabase project",
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

    // Public submission uses server-side pricing and rejects spoofed sizes.
    const bad = await anon.rpc("submit_project_ilaw_order", {
      p_request_id: crypto.randomUUID(),
      p_customer_name: "Integration Test",
      p_mobile: "09171234567",
      p_notes: null,
      p_items: [{ productId: "project-ilaw-eco-bag", size: "XL", quantity: 1 }],
    });
    assert.ok(bad.error, "an invalid size must be rejected");

    const requestId = crypto.randomUUID();
    const submitted = await anon.rpc("submit_project_ilaw_order", {
      p_request_id: requestId,
      p_customer_name: "Integration Test",
      p_mobile: "09171234567",
      p_notes: "created by the automated security test",
      p_items: [
        { productId: "project-ilaw-t-shirt", size: "M", quantity: 2 },
        { productId: "project-ilaw-eco-bag", size: "One Size", quantity: 1 },
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
      p_items: [{ productId: "project-ilaw-t-shirt", size: "M", quantity: 1 }],
    });
    assert.ifError(retry.error);
    assert.equal(retry.data.duplicate, true);
    assert.equal(retry.data.reference, submitted.data.reference);
    assert.equal(retry.data.total_amount, 1497);

    const orderId = submitted.data.order_id;

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

    const confirm = await confirmer.rpc("confirm_project_ilaw_payment", {
      p_order_id: orderId,
      p_note: "integration verification",
    });
    assert.ifError(confirm.error);
    assert.equal(confirm.data.payment_status, "payment_confirmed");

    const viewerFulfillment = await viewer.rpc(
      "update_project_ilaw_fulfillment",
      { p_order_id: orderId, p_status: "processing", p_note: null },
    );
    assert.ok(viewerFulfillment.error, "view-only access cannot change fulfillment");

    const managerFulfillment = await manager.rpc(
      "update_project_ilaw_fulfillment",
      { p_order_id: orderId, p_status: "processing", p_note: null },
    );
    assert.ifError(managerFulfillment.error);
    assert.equal(managerFulfillment.data.fulfillment_status, "processing");

    const invalidTransition = await manager.rpc(
      "update_project_ilaw_fulfillment",
      { p_order_id: orderId, p_status: "completed", p_note: null },
    );
    assert.ok(invalidTransition.error, "processing cannot jump to completed");

    const activity = await viewer.rpc("get_project_ilaw_order_activity", {
      p_order_id: orderId,
    });
    assert.ifError(activity.error);
    assert.ok(
      activity.data.some((event) => event.event_type === "payment_confirmed"),
    );

    const outsiderExport = await outsider.rpc("project_ilaw_export_rows", {});
    assert.ok(outsiderExport.error, "export requires its own permission");

    const viewerExport = await viewer.rpc("project_ilaw_export_rows", {});
    assert.ok(viewerExport.error, "view permission alone cannot export");

    const managerExport = await manager.rpc("project_ilaw_export_rows", {
      p_payment_status: "payment_confirmed",
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
