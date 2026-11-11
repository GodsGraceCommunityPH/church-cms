import { supabase } from "../../lib/supabase";
import type {
  CreatedProjectIlawOrder,
  FulfillmentStatus,
  PaymentStatus,
  ProductType,
  ProjectIlawExportRow,
  ProjectIlawOrder,
  ProjectIlawOrderEvent,
  ProjectIlawOrderFilters,
  ProjectIlawOrderItem,
  NormalizedOrderItem,
} from "./projectIlaw";

const ORDER_SELECT = `
  id,
  reference,
  customer_name,
  mobile,
  notes,
  total_quantity,
  total_amount,
  payment_status,
  fulfillment_status,
  payment_confirmed_at,
  payment_confirmed_by,
  payment_note,
  cancelled_at,
  cancel_reason,
  created_at,
  updated_at,
  items:project_ilaw_order_items(
    id,
    order_id,
    revision,
    line_number,
    product_id,
    product_name,
    product_type,
    size,
    quantity,
    unit_price,
    line_total,
    superseded_at
  )
`;

function mapItem(row: any): ProjectIlawOrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    revision: row.revision,
    lineNumber: row.line_number,
    productId: row.product_id,
    productName: row.product_name,
    productType: row.product_type as ProductType,
    size: row.size,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
  };
}

function mapOrder(row: any): ProjectIlawOrder {
  return {
    id: row.id,
    reference: row.reference,
    customerName: row.customer_name,
    mobile: row.mobile,
    notes: row.notes ?? "",
    totalQuantity: row.total_quantity,
    totalAmount: row.total_amount,
    paymentStatus: row.payment_status as PaymentStatus,
    fulfillmentStatus: row.fulfillment_status as FulfillmentStatus,
    paymentConfirmedAt: row.payment_confirmed_at,
    paymentConfirmedBy: row.payment_confirmed_by,
    paymentNote: row.payment_note ?? "",
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.items ?? [])
      .filter((item: any) => !item.superseded_at)
      .sort((a: any, b: any) => a.line_number - b.line_number)
      .map(mapItem),
  };
}

export async function getProjectIlawOrders(): Promise<ProjectIlawOrder[]> {
  const { data, error } = await supabase
    .from("project_ilaw_orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

export async function getProjectIlawOrder(
  id: string,
): Promise<ProjectIlawOrder> {
  const { data, error } = await supabase
    .from("project_ilaw_orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;
  return mapOrder(data);
}

export async function getProjectIlawOrderActivity(
  id: string,
): Promise<ProjectIlawOrderEvent[]> {
  const { data, error } = await supabase.rpc(
    "get_project_ilaw_order_activity",
    { p_order_id: id },
  );

  if (error) throw error;
  return ((data ?? []) as any[]).map((event) => ({
    id: event.id,
    eventType: event.event_type,
    actorType: event.actor_type,
    actorName: event.actor_name,
    previousValue: event.previous_value,
    newValue: event.new_value,
    note: event.note ?? "",
    createdAt: event.created_at,
  }));
}

export interface CreateOrderInput {
  requestId: string;
  customerName: string;
  mobile: string;
  notes: string;
  items: NormalizedOrderItem[];
}

export async function createProjectIlawOrder(
  input: CreateOrderInput,
): Promise<CreatedProjectIlawOrder> {
  const { data, error } = await supabase.rpc("submit_project_ilaw_order", {
    p_request_id: input.requestId,
    p_customer_name: input.customerName,
    p_mobile: input.mobile,
    p_notes: input.notes || null,
    p_items: input.items,
  });

  if (error) throw error;
  return {
    orderId: data.order_id,
    reference: data.reference,
    totalQuantity: data.total_quantity,
    totalAmount: data.total_amount,
    paymentStatus: data.payment_status,
    fulfillmentStatus: data.fulfillment_status,
    createdAt: data.created_at,
    duplicate: data.duplicate === true,
  };
}

export async function confirmProjectIlawPayment(id: string, note: string) {
  const { data, error } = await supabase.rpc("confirm_project_ilaw_payment", {
    p_order_id: id,
    p_note: note.trim() || null,
  });

  if (error) throw error;
  return data;
}

export async function updateProjectIlawFulfillment(
  id: string,
  status: FulfillmentStatus,
  note: string,
) {
  const { data, error } = await supabase.rpc(
    "update_project_ilaw_fulfillment",
    {
      p_order_id: id,
      p_status: status,
      p_note: note.trim() || null,
    },
  );

  if (error) throw error;
  return data;
}

export async function amendProjectIlawOrder(
  id: string,
  input: {
    customerName: string;
    mobile: string;
    notes: string;
    items: NormalizedOrderItem[];
    note: string;
  },
) {
  const { data, error } = await supabase.rpc("amend_project_ilaw_order", {
    p_order_id: id,
    p_customer_name: input.customerName,
    p_mobile: input.mobile,
    p_notes: input.notes || null,
    p_items: input.items,
    p_note: input.note.trim() || null,
  });

  if (error) throw error;
  return data;
}

export async function getProjectIlawExportRows(
  filters: ProjectIlawOrderFilters,
): Promise<ProjectIlawExportRow[]> {
  const { data, error } = await supabase.rpc("project_ilaw_export_rows", {
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_product: filters.product || null,
    p_payment_status: filters.payment || null,
    p_fulfillment_status: filters.fulfillment || null,
  });

  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    orderReference: row.order_reference,
    orderCreatedAt: row.order_created_at,
    customerName: row.customer_name,
    mobile: row.mobile,
    productName: row.product_name,
    productType: row.product_type,
    size: row.size,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    paymentConfirmedAt: row.payment_confirmed_at,
    paymentConfirmedBy: row.payment_confirmed_by,
  }));
}
