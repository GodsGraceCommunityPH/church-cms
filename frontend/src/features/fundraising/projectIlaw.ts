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
  description: string;
}

export type PaymentStatus = "awaiting_payment" | "payment_confirmed";
export type FulfillmentStatus =
  | "not_started"
  | "processing"
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
  fulfillmentStatus: FulfillmentStatus;
  paymentConfirmedAt: string | null;
  paymentConfirmedBy: string | null;
  paymentNote: string;
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
    | "payment_confirmed"
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
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  paymentStatus: PaymentStatus;
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

export function formatPeso(amount: number) {
  return `₱${new Intl.NumberFormat("en-PH").format(amount)}`;
}

export const T_SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

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

export const SHOP_PREVIEW = {
  title: "Project Ilaw Shop",
  description:
    "Two Project Ilaw pieces, ₱499 each, made to help light our church home.",
  cta: "Shop Now",
} as const;

export const SHOP_STATUS = {
  orderingOpen: true,
  notice:
    "Ordering is open. Payment is arranged manually with Bryan Castro on Facebook Messenger after your order is saved.",
  catalogNotice:
    "Both items are ₱499 each. Place your order here, then contact Bryan Castro on Facebook Messenger for payment instructions.",
  availabilityLabel: "Available to order",
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
    colors: ["Black", "White", "Maroon", "Green", "Blue"],
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
    colors: ["Maroon", "Green", "Blue"],
    colorLabel: "Handle colours",
  },
];

export const ORDER_STEPS: OrderStep[] = [
  {
    title: "Choose your items",
    description:
      "Pick the T-shirt or eco bag, choose a size for each T-shirt, and set the quantity.",
  },
  {
    title: "Submit your order",
    description:
      "Enter your name and mobile number. Your order is saved with a unique reference number.",
  },
  {
    title: "Message Bryan on Messenger",
    description:
      "Contact Bryan Castro on Facebook Messenger and share your order reference so he can give you payment instructions.",
  },
  {
    title: "Pay as instructed",
    description:
      "Follow the payment instructions Bryan gives you directly on Messenger. Payment details are not posted on this website.",
  },
  {
    title: "Wait for payment confirmation",
    description:
      "The Project Ilaw team confirms your payment manually in the church system. Your order is never marked paid automatically.",
  },
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  awaiting_payment: "Awaiting Payment",
  payment_confirmed: "Payment Confirmed",
};

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  not_started: "Not Started",
  processing: "Processing",
  ready_for_pickup: "Ready for Pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const FULFILLMENT_TRANSITIONS: Record<
  FulfillmentStatus,
  FulfillmentStatus[]
> = {
  not_started: ["processing", "ready_for_pickup"],
  processing: ["ready_for_pickup"],
  ready_for_pickup: ["completed"],
  completed: [],
  cancelled: [],
};

export function canCancelOrder(status: FulfillmentStatus) {
  return status === "not_started" || status === "processing" || status === "ready_for_pickup";
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

export function normalizeMessengerUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    const allowedHosts = new Set([
      "m.me",
      "messenger.com",
      "www.messenger.com",
      "facebook.com",
      "www.facebook.com",
    ]);
    if (!allowedHosts.has(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

/**
 * Configure Bryan Castro's real Messenger link with
 * VITE_PROJECT_ILAW_MESSENGER_URL (for example https://m.me/<username>).
 * When it is missing or invalid, the confirmation dialog keeps the payment
 * instructions but disables the Messenger button instead of inventing a link.
 */
export const PROJECT_ILAW_MESSENGER_URL = normalizeMessengerUrl(
  env.VITE_PROJECT_ILAW_MESSENGER_URL,
);

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
    if (
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > 99
    ) {
      errors.push(`Line ${line}: quantity must be a whole number from 1 to 99.`);
    }

    let size = item.size;
    if (product.id === "project-ilaw-eco-bag") {
      size = "One Size";
    } else if (!T_SHIRT_SIZES.includes(size)) {
      errors.push(`Line ${line}: choose a T-shirt size from XS to 3XL.`);
    }

    if (
      Number.isInteger(quantity) &&
      quantity > 0 &&
      quantity <= 99 &&
      !errors.some((error) => error.startsWith(`Line ${line}:`))
    ) {
      items.push({ productId: product.id, size, quantity });
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
