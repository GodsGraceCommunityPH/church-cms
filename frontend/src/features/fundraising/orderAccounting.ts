import {
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  T_SHIRT_COLORS,
  T_SHIRT_SIZES,
  type ProductionReportRow,
  type ProjectIlawExportRow,
  type ProjectIlawOrder,
  type ProjectIlawOrderFilters,
} from "./projectIlaw.ts";

export interface ProjectIlawOrderSummary {
  totalOrders: number;
  totalUnits: number;
  activeUnits: number;
  cancelledUnits: number;
  awaitingPaymentOrders: number;
  paymentVerificationOrders: number;
  paidOrders: number;
  expectedSales: number;
  confirmedCollections: number;
  cancelledPaidOrders: number;
  cancelledPaidAmount: number;
  completedUnits: number;
  tshirtQuantity: number;
  ecoBagQuantity: number;
  sizeQuantities: Record<string, number>;
  tshirtColorQuantities: Record<string, number>;
  ecoBagColorQuantities: Record<string, number>;
  cancelledTshirtQuantity: number;
  cancelledEcoBagQuantity: number;
}

function manilaDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatOrderDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function filterProjectIlawOrders(
  orders: ProjectIlawOrder[],
  filters: ProjectIlawOrderFilters,
) {
  return orders.filter((order) => {
    const orderDate = manilaDate(order.createdAt);

    if (filters.from && orderDate < filters.from) return false;
    if (filters.to && orderDate > filters.to) return false;
    if (filters.payment && order.paymentStatus !== filters.payment) return false;
    if (
      filters.fulfillment &&
      order.fulfillmentStatus !== filters.fulfillment
    ) {
      return false;
    }
    if (
      filters.product &&
      !order.items.some((item) => item.productId === filters.product)
    ) {
      return false;
    }

    return true;
  });
}

export function buildOrderSummary(
  orders: ProjectIlawOrder[],
): ProjectIlawOrderSummary {
  const summary: ProjectIlawOrderSummary = {
    totalOrders: orders.length,
    totalUnits: 0,
    activeUnits: 0,
    cancelledUnits: 0,
    awaitingPaymentOrders: 0,
    paymentVerificationOrders: 0,
    paidOrders: 0,
    expectedSales: 0,
    confirmedCollections: 0,
    cancelledPaidOrders: 0,
    cancelledPaidAmount: 0,
    completedUnits: 0,
    tshirtQuantity: 0,
    ecoBagQuantity: 0,
    sizeQuantities: Object.fromEntries(T_SHIRT_SIZES.map((size) => [size, 0])),
    tshirtColorQuantities: Object.fromEntries(
      T_SHIRT_COLORS.map((color) => [color, 0]),
    ),
    ecoBagColorQuantities: Object.fromEntries(
      ["Maroon", "Green", "Blue"].map((color) => [color, 0]),
    ),
    cancelledTshirtQuantity: 0,
    cancelledEcoBagQuantity: 0,
  };

  for (const order of orders) {
    const cancelled = order.fulfillmentStatus === "cancelled";
    const orderUnits = order.items.reduce(
      (total, item) => total + item.quantity,
      0,
    );
    summary.totalUnits += orderUnits;

    if (cancelled) {
      summary.cancelledUnits += orderUnits;
    } else {
      summary.activeUnits += orderUnits;
      summary.expectedSales += order.totalAmount;
    }

    if (order.fulfillmentStatus === "completed") {
      summary.completedUnits += orderUnits;
    }

    if (!cancelled && order.paymentStatus === "awaiting_payment") {
      summary.awaitingPaymentOrders += 1;
    }
    if (!cancelled && order.paymentStatus === "payment_verification") {
      summary.paymentVerificationOrders += 1;
    }

    if (order.paymentStatus === "paid") {
      summary.paidOrders += 1;
      summary.confirmedCollections += order.totalAmount;
      if (cancelled) {
        summary.cancelledPaidOrders += 1;
        summary.cancelledPaidAmount += order.totalAmount;
      }
    }

    for (const item of order.items) {
      if (cancelled) {
        if (item.productType === "t_shirt") {
          summary.cancelledTshirtQuantity += item.quantity;
        } else {
          summary.cancelledEcoBagQuantity += item.quantity;
        }
        continue;
      }

      if (item.productType === "t_shirt") {
        summary.tshirtQuantity += item.quantity;
        if (item.size in summary.sizeQuantities) {
          summary.sizeQuantities[item.size] += item.quantity;
        }
        if (item.color in summary.tshirtColorQuantities) {
          summary.tshirtColorQuantities[item.color] += item.quantity;
        }
      } else {
        summary.ecoBagQuantity += item.quantity;
        if (item.color in summary.ecoBagColorQuantities) {
          summary.ecoBagColorQuantities[item.color] += item.quantity;
        }
      }
    }
  }

  return summary;
}

/**
 * Confirmed production quantities: only paid, non-cancelled orders count.
 * When a cutoff is supplied, only orders created on or before that Manila date
 * are included.
 */
export function buildProductionReport(
  orders: ProjectIlawOrder[],
  cutoff: string | null,
): ProductionReportRow[] {
  const buckets = new Map<string, ProductionReportRow>();

  for (const order of orders) {
    if (order.paymentStatus !== "paid") continue;
    if (order.fulfillmentStatus === "cancelled") continue;
    if (cutoff && manilaDate(order.createdAt) > cutoff) continue;

    for (const item of order.items) {
      const key = [
        item.productId,
        item.size,
        item.color,
      ].join("|");
      const existing = buckets.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        buckets.set(key, {
          productId: item.productId,
          productName: item.productName,
          productType: item.productType,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
        });
      }
    }
  }

  return [...buckets.values()].sort((a, b) =>
    [a.productName, a.size, a.color]
      .join("|")
      .localeCompare([b.productName, b.size, b.color].join("|")),
  );
}

function csvValue(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

const CSV_HEADERS = [
  "Order Reference",
  "Order Date/Time",
  "Customer Name",
  "Mobile Number",
  "Product",
  "Size",
  "Color",
  "Quantity",
  "Unit Price",
  "Line Total",
  "Payment Status",
  "Payment Reference",
  "Payment Submitted At",
  "Fulfillment Status",
  "Payment Confirmed At",
  "Payment Confirmed By",
];

export function projectIlawExportRowsToCsv(rows: ProjectIlawExportRow[]) {
  const lines = [CSV_HEADERS.map(csvValue).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.orderReference,
        formatOrderDateTime(row.orderCreatedAt),
        row.customerName,
        row.mobile,
        row.productName,
        row.size,
        row.color,
        row.quantity,
        row.unitPrice,
        row.lineTotal,
        PAYMENT_STATUS_LABELS[row.paymentStatus] ?? row.paymentStatus,
        row.paymentReference,
        formatOrderDateTime(row.paymentSubmittedAt),
        FULFILLMENT_STATUS_LABELS[row.fulfillmentStatus] ??
          row.fulfillmentStatus,
        formatOrderDateTime(row.paymentConfirmedAt),
        row.paymentConfirmedBy ?? "",
      ]
        .map(csvValue)
        .join(","),
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

export function productionReportRowsToCsv(rows: ProductionReportRow[]) {
  const headers = [
    "Product",
    "Size",
    "Color",
    "Confirmed Quantity",
  ];
  const lines = [headers.map(csvValue).join(",")];

  for (const row of rows) {
    lines.push(
      [row.productName, row.size, row.color, row.quantity]
        .map(csvValue)
        .join(","),
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function csvFilename() {
  const date = manilaDate(new Date().toISOString());
  return `project-ilaw-orders-${date}.csv`;
}

export function productionCsvFilename() {
  const date = manilaDate(new Date().toISOString());
  return `project-ilaw-production-${date}.csv`;
}
