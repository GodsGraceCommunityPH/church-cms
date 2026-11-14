import {
  getShopItem,
  type NormalizedOrderItem,
  type ProjectIlawOrder,
} from "./projectIlaw.ts";

export type StaffPaymentMethod = "unpaid" | "gcash" | "cash";

export interface StaffOrderItemLike {
  productId: string;
  size: string;
  color: string;
  quantity: string | number;
}

export interface StaffOrderItemsValidation {
  ok: boolean;
  error: string;
  items: NormalizedOrderItem[];
}

export interface StaffPaymentAvailability {
  /** null means the public payment settings have not been read yet. */
  paymentsEnabled: boolean | null;
  canConfirmPayment: boolean;
}

export interface StaffPaymentOptionState {
  disabled: boolean;
  hint: string;
}

const INVALID_QUANTITY = "has an invalid quantity (1–99).";

/**
 * Validates staff-assisted order lines without dropping any of them.
 *
 * The public checkout rejects an invalid line with a form error. Staff orders
 * must behave the same way: silently removing a line would create a cheaper
 * order than the one the staff member thought they were saving.
 */
export function validateStaffOrderItems(
  items: StaffOrderItemLike[],
): StaffOrderItemsValidation {
  if (items.length === 0) {
    return {
      ok: false,
      error: "Add at least one order item before creating the order.",
      items: [],
    };
  }
  if (items.length > 20) {
    return {
      ok: false,
      error: "An order can contain at most 20 line items.",
      items: [],
    };
  }

  const normalized: NormalizedOrderItem[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const line = index + 1;
    const item = items[index];
    const product = getShopItem(item.productId);
    if (!product) {
      return { ok: false, error: `Item ${line}: choose a product.`, items: [] };
    }

    const size =
      product.id === "project-ilaw-eco-bag" ? "One Size" : item.size;
    if (!product.sizes.includes(size)) {
      return {
        ok: false,
        error: `Item ${line}: choose a valid ${product.sizeLabel
          .toLowerCase()
          .replace(/s$/, "")}.`,
        items: [],
      };
    }
    if (!product.colors.includes(item.color)) {
      return {
        ok: false,
        error: `Item ${line}: choose a valid ${product.colorLabel
          .toLowerCase()
          .replace(/s$/, "")}.`,
        items: [],
      };
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return { ok: false, error: `Item ${line} ${INVALID_QUANTITY}`, items: [] };
    }

    normalized.push({
      productId: product.id,
      size,
      color: item.color,
      quantity,
    });
  }

  return { ok: true, error: "", items: normalized };
}

/**
 * Explains why a payment method cannot be offered. An empty hint means the
 * method is available.
 */
export function staffPaymentOptionState(
  method: StaffPaymentMethod,
  availability: StaffPaymentAvailability,
): StaffPaymentOptionState {
  if (method === "gcash" && availability.paymentsEnabled !== true) {
    return {
      disabled: true,
      hint:
        availability.paymentsEnabled === false
          ? "Payment collection is currently closed. GCash receipts cannot be recorded until an authorised staff member enables payments."
          : "Payment collection settings could not be checked. Refresh the page before recording a GCash receipt.",
    };
  }

  if (method === "cash" && !availability.canConfirmPayment) {
    return {
      disabled: true,
      hint:
        "Cash is unavailable because your account does not have the Confirm payments permission. Create the order as Unpaid and ask an authorised staff member to record the cash.",
    };
  }

  return { disabled: false, hint: "" };
}

/**
 * Returns a blocking message before a staff order is created. An empty string
 * means the selected payment method can be recorded safely.
 */
export function staffPaymentBlockReason(input: {
  method: StaffPaymentMethod;
  paymentsEnabled: boolean | null;
  canConfirmPayment: boolean;
  cashConfirmed: boolean;
}): string {
  if (input.method === "gcash" && input.paymentsEnabled !== true) {
    return input.paymentsEnabled === false
      ? "Payment collection is currently closed. Create the order as Unpaid and record the GCash receipt once payments are enabled."
      : "Payment collection settings could not be checked. Refresh the page before recording a GCash receipt.";
  }

  if (input.method === "cash" && !input.canConfirmPayment) {
    return "You do not have permission to record cash payments. Create the order as Unpaid and ask an authorised staff member to record the cash.";
  }

  if (input.method === "cash" && !input.cashConfirmed) {
    return "Confirm that you have physically received the cash before creating a paid order.";
  }

  return "";
}

/**
 * A failed GCash upload leaves the order Awaiting Payment. Staff can retry from
 * the order page as long as payment collection is open and the order still has
 * the mobile number used by the public payment lookup.
 */
export function canRetryStaffGcashPayment(
  order: Pick<
    ProjectIlawOrder,
    | "source"
    | "paymentMethod"
    | "paymentStatus"
    | "fulfillmentStatus"
    | "mobile"
  >,
  paymentsEnabled: boolean | null,
): boolean {
  return (
    paymentsEnabled === true &&
    order.source === "staff" &&
    order.paymentMethod === "gcash" &&
    order.paymentStatus === "awaiting_payment" &&
    order.fulfillmentStatus !== "cancelled" &&
    order.mobile.trim().length > 0
  );
}

/**
 * Turns the technical error from the shared payment RPC or evidence bucket into
 * something staff can act on. Unrelated errors are returned unchanged.
 */
export function staffPaymentErrorMessage(
  message: string,
  method: StaffPaymentMethod,
): string {
  const normalized = message.toLowerCase();

  if (
    /payment collection is not open yet|payments?_enabled|payment collection is (currently )?closed|payment collection is not open/.test(
      normalized,
    )
  ) {
    return method === "gcash"
      ? "Payment collection is currently closed. The order was saved as Awaiting Payment; record the GCash receipt from the order page once payments are enabled."
      : "Payment collection is currently closed, so the cash payment could not be recorded.";
  }

  if (/already awaiting verification/.test(normalized)) {
    return "This order already has a GCash receipt awaiting verification.";
  }

  return message;
}
