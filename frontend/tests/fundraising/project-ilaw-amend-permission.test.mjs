import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("Project Ilaw Orders Staff receives a dedicated line-item amendment permission", async () => {
  const migration = await readSource(
    "../../../supabase/migrations/20261115140000_project_ilaw_order_amend_items_permission.sql",
  );
  assert.match(migration, /project_ilaw\.orders\.amend_items/);
  assert.match(migration, /project_ilaw_orders_staff/);
  assert.match(migration, /cannot change customer details or order notes/i);
  assert.match(migration, /cannot add or remove order lines/i);
  assert.match(migration, /cannot change existing products/i);
  assert.match(migration, /project_ilaw\.orders\.manage/);
});

test("Project Ilaw Orders Staff can see Amend order without broad order-management access", async () => {
  const source = await readSource(
    "../../src/pages/admin/ProjectIlawOrderDetail.tsx",
  );
  assert.match(
    source,
    /const canAmendItems = hasPermission\("project_ilaw\.orders\.amend_items"\)/,
  );
  assert.match(source, /\(canManage \|\| canAmendItems\)/);
  assert.match(source, /restricted=\{restrictedAmendment\}/);
  assert.match(source, /validateStaffOrderItems\(amendDraft\.items\)/);
});

test("restricted order editor exposes only quantity, colour, and applicable size controls", async () => {
  const source = await readSource(
    "../../src/components/fundraising/OrderLineItemsEditor.tsx",
  );
  assert.match(source, /restricted\?: boolean/);
  assert.match(source, /!restricted && \(/);
  assert.match(source, /value=\{item\.quantity\}/);
  assert.match(source, /value=\{item\.color\}/);
  assert.match(source, /value=\{item\.size\}/);
  assert.match(source, /Product/);
  assert.match(source, /Add item/);
  assert.match(source, /Remove/);
});
