export type OrderFieldControl = "text" | "tel" | "number" | "select" | "textarea";

export interface ShopItemImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface ShopItem {
  id: string;
  name: string;
  category: string;
  price: number;
  image: ShopItemImage;
  description: string;
  sizes: string[];
  sizeLabel: string;
  colors: string[];
  colorLabel: string;
}

export interface OrderStep {
  title: string;
  description: string[];
}

export type PaymentStatus =
  | "awaiting_payment"
  | "payment_verification"
  | "paid";
export type FulfillmentStatus =
  | "not_started"
  | "in_production"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";
export type ProductType = "t_shirt" | "eco_bag";

export interface ProjectIlawOrderItem {
  id: string;
  orderId: string;
  revision: number;
  lineNumber: number;
  productId: string;
  productName: string;
  productType: ProductType;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ProjectIlawOrder {
  id: string;
  reference: string;
  customerName: string;
  mobile: string;
  notes: string;
  totalQuantity: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  paymentSubmittedAt: string | null;
  paymentEvidencePath: string | null;
  paymentRejectedAt: string | null;
  paymentRejectionReason: string;
  paymentConfirmedAt: string | null;
  paymentConfirmedBy: string | null;
  paymentMethod: "gcash" | "cash" | null;
  paymentAmountReceived: number | null;
  paymentNote: string;
  fulfillmentStatus: FulfillmentStatus;
  cancelledAt: string | null;
  cancelReason: string;
  createdAt: string;
  updatedAt: string;
  items: ProjectIlawOrderItem[];
}

export interface ProjectIlawOrderEvent {
  id: string;
  eventType:
    | "order_created"
    | "payment_submitted"
    | "payment_confirmed"
    | "payment_rejected"
    | "fulfillment_changed"
    | "order_amended"
    | "order_cancelled";
  actorType: "anonymous" | "user" | "system";
  actorName: string;
  previousValue: unknown;
  newValue: unknown;
  note: string;
  createdAt: string;
}

export interface OrderDraftItem {
  key: string;
  productId: string;
  size: string;
  color: string;
  quantity: string | number;
}

export interface OrderDraft {
  customerName: string;
  mobile: string;
  notes: string;
  items: OrderDraftItem[];
}

export interface NormalizedOrderItem {
  productId: string;
  size: string;
  color: string;
  quantity: number;
}

export interface OrderDraftValidation {
  ok: boolean;
  errors: string[];
  customerName: string;
  mobile: string;
  notes: string;
  items: NormalizedOrderItem[];
  totalQuantity: number;
  totalAmount: number;
}

export interface CreatedProjectIlawOrder {
  orderId: string;
  reference: string;
  paymentToken: string;
  totalQuantity: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  createdAt: string;
  duplicate: boolean;
}

export interface ProjectIlawExportRow {
  orderReference: string;
  orderCreatedAt: string;
  customerName: string;
  mobile: string;
  productName: string;
  productType: ProductType;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  paymentSubmittedAt: string | null;
  fulfillmentStatus: FulfillmentStatus;
  paymentConfirmedAt: string | null;
  paymentConfirmedBy: string | null;
}

export interface ProjectIlawOrderFilters {
  from: string;
  to: string;
  product: string;
  payment: string;
  fulfillment: string;
}

export interface ProjectIlawPaymentInstructions {
  enabled: boolean;
  gcashAccountName: string;
  gcashAccountNumber: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  paymentInstructions: string;
}

export interface ProjectIlawPaymentContext {
  orderId: string;
  reference: string;
  customerName: string;
  totalQuantity: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentToken: string;
  paymentReference: string;
  paymentSubmittedAt: string | null;
  paymentRejectedAt: string | null;
  paymentRejectionReason: string;
  fulfillmentStatus: FulfillmentStatus;
  instructions: ProjectIlawPaymentInstructions;
}

// Order context carried from an order confirmation into the payment step so
// the customer does not have to re-enter their details before paying.
export interface ProjectIlawPaymentSeed {
  reference: string;
  customerName: string;
  mobile: string;
}

export interface ProjectIlawSettings {
  ordersEnabled: boolean;
  paymentsEnabled: boolean;
  gcashAccountName: string;
  gcashAccountNumber: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  paymentInstructions: string;
  productionCutoff: string;
  updatedAt: string | null;
}

export interface ProjectIlawPublicSettings {
  ordersEnabled: boolean;
  paymentsEnabled: boolean;
}

export interface ProductionReportRow {
  productId: string;
  productName: string;
  productType: ProductType;
  size: string;
  color: string;
  quantity: number;
}

export interface ProductionReport {
  cutoff: string | null;
  generatedAt: string;
  rows: ProductionReportRow[];
  totalQuantity: number;
}

export function formatPeso(amount: number) {
  return `₱${new Intl.NumberFormat("en-PH").format(amount)}`;
}

export const T_SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
export const T_SHIRT_COLORS = ["Black", "White", "Maroon", "Green", "Blue"];
export const ECO_BAG_COLORS = ["Maroon", "Green", "Blue"];

export const PROJECT_ILAW = {
  eyebrow: "Fundraising · Project Ilaw",
  title: "Project Ilaw",
  summary:
    "Project Ilaw is a church fundraising initiative supporting repairs and improvements to our church lighting and the development of new lighting designs.",
  supportingText:
    "Every purchase from the Project Ilaw shop helps move this work forward so our church home can be better lit for worship, fellowship, and the ministries that gather here.",
  goals: [
    "Repairs and improvements to existing church lighting",
    "Development of new lighting designs for the church",
  ],
  shopCta: "Visit the Shop",
  processCta: "See how ordering will work",
} as const;

export const SHOP_STATUS = {
  defaultOrdersEnabled: false,
  openNotice:
    "Ordering is open. Submit your order here, then pay through the payment instructions on this page once they are available.",
  closedNotice:
    "Ordering is not open yet. The catalog is shown for preview only; no orders are being accepted.",
  openCatalogNotice:
    "Both items are ₱499 each. Choose a size and colour, submit your order, then follow the payment steps on this page.",
  closedCatalogNotice:
    "Both items are ₱499 each. Ordering will open once the church announces it.",
  availabilityLabel: "Available to order",
  closedLabel: "Ordering not open yet",
} as const;

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: "project-ilaw-t-shirt",
    name: "Project Ilaw T-shirt",
    category: "T-shirt",
    price: 499,
    image: {
      src: "/images/fundraising/project-ilaw-shirts.jpg",
      alt: "Project Ilaw T-shirt mockup showing the front logo and the back design in black, white, maroon, green, and blue",
      width: 1156,
      height: 800,
    },
    description:
      "Everyday T-shirt with the Project Ilaw logo on the front and “Let His Light Shine, Let His Glory Rise” (Haggai 2:9) on the back.",
    sizes: T_SHIRT_SIZES,
    sizeLabel: "Sizes",
    colors: T_SHIRT_COLORS,
    colorLabel: "Shirt colours",
  },
  {
    id: "project-ilaw-eco-bag",
    name: "Project Ilaw Eco Bag",
    category: "Eco bag",
    price: 499,
    image: {
      src: "/images/fundraising/project-ilaw-tote-bags.jpg",
      alt: "Project Ilaw eco bag mockup showing the front logo and back design with maroon, green, and blue handles",
      width: 2048,
      height: 822,
    },
    description:
      "Reusable eco bag with the Project Ilaw logo and the “Let His Light Shine, Let His Glory Rise” design. Available with maroon, green, or blue handles.",
    sizes: ["One Size"],
    sizeLabel: "Size",
    colors: ECO_BAG_COLORS,
    colorLabel: "Handle colours",
  },
];

export const ORDER_STEPS: OrderStep[] = [
  {
    title: "Choose your items",
    description: [
      "Piliin kung T-shirt o eco bag ang o-orderin mo. Select your preferred size and colour, then enter the quantity.",
    ],
  },
  {
    title: "Submit your order",
    description: [
      "Ilagay ang iyong name at mobile number. Once submitted, may unique order reference kang matatanggap.",
    ],
  },
  {
    title: "Check your payment options",
    description: [
      "Gamitin ang iyong order reference at mobile number para makita ang payment instructions. Choose between GCash or Cash, depending on your preferred payment method.",
    ],
  },
  {
    title: "Complete your payment",
    description: [
      "GCash: Magbayad using the official payment details, then enter your transaction reference and upload a screenshot of your receipt.",
      "Cash: Piliin ang cash payment option. Our team will record your payment once the cash has been received.",
    ],
  },
  {
    title: "Wait for confirmation",
    description: [
      "For GCash, ibe-verify ng Project Ilaw team ang iyong transaction.",
      "For Cash, our team will confirm once payment has been received.",
      "Your order will only be marked as paid after confirmation.",
    ],
  },
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  awaiting_payment: "Awaiting Payment",
  payment_verification: "Payment Verification",
  paid: "Paid",
};

// Customer-facing wording keeps the same status model without exposing the
// internal review terminology used by staff.
export const CUSTOMER_PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  awaiting_payment: "Awaiting Payment",
  payment_verification: "Payment Submitted",
  paid: "Payment Confirmed",
};

export const CUSTOMER_FULFILLMENT_STATUS_LABELS: Record<
  FulfillmentStatus,
  string
> = {
  not_started: "Order received",
  in_production: "Preparing",
  ready_for_pickup: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Project Ilaw merchandise is made to order and collected at the church.
// There is no delivery option in the current design.
export const ORDER_FULFILMENT = {
  label: "Fulfilment",
  method: "Pickup at God's Grace Community Covenant Church",
  note: "We will contact you when your order is ready for pickup.",
} as const;

// The confirmed GCash InstaPay QR is a public asset. It is the payment
// destination only; it never confirms a payment automatically.
export const PAYMENT_QR = {
  src: "/images/fundraising/gcash-instapay-qr.png",
  label: "GCash (InstaPay QR)",
  notice: "Transfer fees may apply.",
  alt: "GCash InstaPay QR code for Project Ilaw payments",
} as const;

export function normalizePhilippineMobile(value: string): string | null {
  if (/[a-zA-Z]/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return "0" + digits.slice(2);
  if (/^9\d{9}$/.test(digits)) return "0" + digits;
  return null;
}

export function normalizeCustomerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export interface ProjectIlawCustomerOrderMatch {
  reference: string;
  customerName: string;
  totalQuantity: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
}

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  not_started: "Not Started",
  in_production: "In Production",
  ready_for_pickup: "Ready for Pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const FULFILLMENT_TRANSITIONS: Record<
  FulfillmentStatus,
  FulfillmentStatus[]
> = {
  not_started: ["in_production", "ready_for_pickup"],
  in_production: ["ready_for_pickup"],
  ready_for_pickup: ["completed"],
  completed: [],
  cancelled: [],
};

export function canCancelOrder(status: FulfillmentStatus) {
  return (
    status === "not_started" ||
    status === "in_production" ||
    status === "ready_for_pickup"
  );
}

export function getShopItem(productId: string) {
  return SHOP_ITEMS.find((item) => item.id === productId);
}

export function isEcoBag(productId: string) {
  return productId === "project-ilaw-eco-bag";
}

export function defaultSizeForProduct(productId: string) {
  return isEcoBag(productId) ? "One Size" : "";
}

export function defaultColorForProduct(_productId: string) {
  return "";
}

export function createRequestId() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export function createDraftItem(productId = SHOP_ITEMS[0].id): OrderDraftItem {
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId,
    size: defaultSizeForProduct(productId),
    color: defaultColorForProduct(productId),
    quantity: 1,
  };
}

export function calculateDraftTotals(items: OrderDraftItem[]) {
  let totalQuantity = 0;
  let totalAmount = 0;

  for (const item of items) {
    const product = getShopItem(item.productId);
    const quantity = Number(item.quantity);
    if (!product || !Number.isInteger(quantity) || quantity <= 0) continue;
    totalQuantity += quantity;
    totalAmount += product.price * quantity;
  }

  return { totalQuantity, totalAmount };
}

export function validateOrderDraft(draft: OrderDraft): OrderDraftValidation {
  const errors: string[] = [];
  const customerName = draft.customerName.trim();
  const mobile = draft.mobile.trim();
  const notes = draft.notes.trim();
  const digits = mobile.replace(/\D/g, "");
  const items: NormalizedOrderItem[] = [];
  let totalQuantity = 0;
  let totalAmount = 0;

  if (!customerName) {
    errors.push("Enter the customer name.");
  } else if (customerName.length > 120) {
    errors.push("Customer name must be at most 120 characters.");
  }

  if (!mobile) {
    errors.push("Enter a mobile number.");
  } else if (digits.length < 10 || digits.length > 15) {
    errors.push("Enter a valid mobile number with 10 to 15 digits.");
  }

  if (notes.length > 1000) {
    errors.push("Order notes must be at most 1000 characters.");
  }

  if (draft.items.length < 1) {
    errors.push("Add at least one item to your order.");
  } else if (draft.items.length > 20) {
    errors.push("An order can contain at most 20 line items.");
  }

  draft.items.forEach((item, index) => {
    const line = index + 1;
    const product = getShopItem(item.productId);
    if (!product) {
      errors.push(`Line ${line}: choose a product.`);
      return;
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
      errors.push(`Line ${line}: quantity must be a whole number from 1 to 99.`);
    }

    let size = item.size;
    if (product.id === "project-ilaw-eco-bag") {
      size = "One Size";
    } else if (!T_SHIRT_SIZES.includes(size)) {
      errors.push(`Line ${line}: choose a T-shirt size from XS to 3XL.`);
    }

    const color = item.color;
    if (!product.colors.includes(color)) {
      errors.push(
        `Line ${line}: choose a ${product.colorLabel.toLowerCase().replace(/s$/, "")}.`,
      );
    }

    if (
      Number.isInteger(quantity) &&
      quantity > 0 &&
      quantity <= 99 &&
      !errors.some((error) => error.startsWith(`Line ${line}:`))
    ) {
      items.push({ productId: product.id, size, color, quantity });
      totalQuantity += quantity;
      totalAmount += product.price * quantity;
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    customerName,
    mobile,
    notes,
    items,
    totalQuantity,
    totalAmount,
  };
}
