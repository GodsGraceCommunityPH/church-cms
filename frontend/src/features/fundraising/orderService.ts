import { supabase } from "../../lib/supabase";
import type {
  CreatedProjectIlawOrder,
  FulfillmentStatus,
  NormalizedOrderItem,
  PaymentStatus,
  ProductType,
  ProductionReport,
  ProjectIlawExportRow,
  ProjectIlawOrder,
  ProjectIlawOrderEvent,
  ProjectIlawOrderFilters,
  ProjectIlawOrderItem,
  ProjectIlawPaymentContext,
  ProjectIlawPaymentInstructions,
  ProjectIlawPublicSettings,
  ProjectIlawSettings,
} from "./projectIlaw";

export const PAYMENT_EVIDENCE_BUCKET = "project-ilaw-payment-evidence";

const ORDER_SELECT = `
  id,
  reference,
  customer_name,
  mobile,
  notes,
  total_quantity,
  total_amount,
  payment_status,
  payment_reference,
  payment_evidence_path,
  payment_submitted_at,
  payment_rejected_at,
  payment_rejection_reason,
  payment_confirmed_at,
  payment_confirmed_by,
  payment_note,
  fulfillment_status,
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
    color,
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
    color: row.color,
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
    paymentReference: row.payment_reference ?? "",
    paymentSubmittedAt: row.payment_submitted_at,
    paymentEvidencePath: row.payment_evidence_path,
    paymentRejectedAt: row.payment_rejected_at,
    paymentRejectionReason: row.payment_rejection_reason ?? "",
    paymentConfirmedAt: row.payment_confirmed_at,
    paymentConfirmedBy: row.payment_confirmed_by,
    paymentNote: row.payment_note ?? "",
    fulfillmentStatus: row.fulfillment_status as FulfillmentStatus,
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

function mapInstructions(row: any): ProjectIlawPaymentInstructions {
  return {
    enabled: row?.enabled === true,
    gcashAccountName: row?.gcash_account_name ?? "",
    gcashAccountNumber: row?.gcash_account_number ?? "",
    bankName: row?.bank_name ?? "",
    bankAccountName: row?.bank_account_name ?? "",
    bankAccountNumber: row?.bank_account_number ?? "",
    paymentInstructions: row?.payment_instructions ?? "",
  };
}

function mapSettings(row: any): ProjectIlawSettings {
  return {
    ordersEnabled: row?.orders_enabled === true,
    paymentsEnabled: row?.payments_enabled === true,
    gcashAccountName: row?.gcash_account_name ?? "",
    gcashAccountNumber: row?.gcash_account_number ?? "",
    bankName: row?.bank_name ?? "",
    bankAccountName: row?.bank_account_name ?? "",
    bankAccountNumber: row?.bank_account_number ?? "",
    paymentInstructions: row?.payment_instructions ?? "",
    productionCutoff: row?.production_cutoff ?? "",
    updatedAt: row?.updated_at ?? null,
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
    paymentToken: data.payment_token,
    totalQuantity: data.total_quantity,
    totalAmount: data.total_amount,
    paymentStatus: data.payment_status,
    fulfillmentStatus: data.fulfillment_status,
    createdAt: data.created_at,
    duplicate: data.duplicate === true,
  };
}

export async function getProjectIlawPaymentContext(
  reference: string,
  mobile: string,
): Promise<ProjectIlawPaymentContext> {
  const { data, error } = await supabase.rpc(
    "get_project_ilaw_payment_context",
    { p_reference: reference, p_mobile: mobile },
  );

  if (error) throw error;
  return {
    orderId: data.order_id,
    reference: data.reference,
    customerName: data.customer_name,
    totalQuantity: data.total_quantity,
    totalAmount: data.total_amount,
    paymentStatus: data.payment_status,
    paymentToken: data.payment_token,
    paymentReference: data.payment_reference ?? "",
    paymentSubmittedAt: data.payment_submitted_at,
    paymentRejectedAt: data.payment_rejected_at,
    paymentRejectionReason: data.payment_rejection_reason ?? "",
    fulfillmentStatus: data.fulfillment_status,
    instructions: mapInstructions(data.instructions),
  };
}

export async function uploadProjectIlawPaymentEvidence(
  orderId: string,
  paymentToken: string,
  file: File,
): Promise<string> {
  const extension =
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
    }[file.type] ?? "bin";

  const path = `orders/${orderId}/${paymentToken}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(PAYMENT_EVIDENCE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw error;
  return path;
}

export async function submitProjectIlawPayment(input: {
  reference: string;
  mobile: string;
  paymentToken: string;
  paymentReference: string;
  evidencePath: string;
}) {
  const { data, error } = await supabase.rpc("submit_project_ilaw_payment", {
    p_reference: input.reference,
    p_mobile: input.mobile,
    p_payment_token: input.paymentToken,
    p_payment_reference: input.paymentReference,
    p_evidence_path: input.evidencePath,
  });

  if (error) throw error;
  return data;
}

export async function getPaymentEvidenceUrl(
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PAYMENT_EVIDENCE_BUCKET)
    .createSignedUrl(path, 600);

  if (error) throw error;
  return data.signedUrl;
}

export async function confirmProjectIlawPayment(id: string, note: string) {
  const { data, error } = await supabase.rpc("confirm_project_ilaw_payment", {
    p_order_id: id,
    p_note: note.trim() || null,
  });

  if (error) throw error;
  return data;
}

export async function rejectProjectIlawPayment(id: string, reason: string) {
  const { data, error } = await supabase.rpc("reject_project_ilaw_payment", {
    p_order_id: id,
    p_reason: reason.trim() || null,
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
    color: row.color,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
    paymentStatus: row.payment_status,
    paymentReference: row.payment_reference ?? "",
    paymentSubmittedAt: row.payment_submitted_at,
    fulfillmentStatus: row.fulfillment_status,
    paymentConfirmedAt: row.payment_confirmed_at,
    paymentConfirmedBy: row.payment_confirmed_by,
  }));
}

export async function getProjectIlawProductionReport(): Promise<ProductionReport> {
  const { data, error } = await supabase.rpc(
    "project_ilaw_production_report",
    { p_cutoff: null },
  );

  if (error) throw error;
  return {
    cutoff: data.cutoff,
    generatedAt: data.generated_at,
    rows: ((data.rows ?? []) as any[]).map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      productType: row.product_type,
      size: row.size,
      color: row.color,
      quantity: row.quantity,
    })),
    totalQuantity: data.total_quantity,
  };
}

export async function getProjectIlawSettings(): Promise<ProjectIlawSettings> {
  const { data, error } = await supabase.rpc("get_project_ilaw_settings");
  if (error) throw error;
  return mapSettings(data);
}

export async function getProjectIlawPublicSettings(): Promise<ProjectIlawPublicSettings> {
  const { data, error } = await supabase.rpc("get_project_ilaw_public_settings");
  if (error) throw error;
  return {
    ordersEnabled: data?.orders_enabled === true,
    paymentsEnabled: data?.payments_enabled === true,
  };
}

export async function updateProjectIlawSettings(
  input: Omit<ProjectIlawSettings, "updatedAt">,
): Promise<ProjectIlawSettings> {
  const { data, error } = await supabase.rpc("update_project_ilaw_settings", {
    p_orders_enabled: input.ordersEnabled,
    p_payments_enabled: input.paymentsEnabled,
    p_gcash_account_name: input.gcashAccountName || null,
    p_gcash_account_number: input.gcashAccountNumber || null,
    p_bank_name: input.bankName || null,
    p_bank_account_name: input.bankAccountName || null,
    p_bank_account_number: input.bankAccountNumber || null,
    p_payment_instructions: input.paymentInstructions || null,
    p_production_cutoff: input.productionCutoff || null,
  });

  if (error) throw error;
  return mapSettings(data);
}
