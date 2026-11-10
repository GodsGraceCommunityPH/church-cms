export type ShopItemArt = "tee" | "tote" | "stickers";

export type OrderFieldControl = "text" | "tel" | "number" | "select" | "textarea";

export interface ShopItem {
  id: string;
  name: string;
  category: string;
  art: ShopItemArt;
  description: string;
}

export interface OrderStep {
  title: string;
  description: string;
}

export interface OrderFormField {
  id: string;
  label: string;
  control: OrderFieldControl;
  placeholder?: string;
  options?: string[];
  note?: string;
  wide?: boolean;
}

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
    "A first look at the merchandise we plan to offer in support of Project Ilaw.",
  cta: "Shop Now",
} as const;

export const SHOP_STATUS = {
  orderingOpen: false,
  notice:
    "Ordering is not yet open. The details below show how the process is planned to work.",
  placeholderNotice:
    "These are placeholder previews. Final designs, sizes, and prices are not yet confirmed.",
  priceLabel: "Price to be announced",
  availabilityLabel: "Ordering not yet open",
  previewOnlyNotice:
    "Preview only. This form is not connected and cannot submit or store any information.",
} as const;

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: "project-ilaw-tee",
    name: "Project Ilaw Tee",
    category: "Shirt",
    art: "tee",
    description:
      "An everyday shirt carrying a Project Ilaw design to be revealed. Final artwork is still in development.",
  },
  {
    id: "project-ilaw-tote",
    name: "Project Ilaw Tote",
    category: "Tote bag",
    art: "tote",
    description:
      "A reusable tote for books, groceries, and everyday carry. Final artwork and materials are not yet confirmed.",
  },
  {
    id: "project-ilaw-stickers",
    name: "Project Ilaw Sticker Set",
    category: "Sticker set",
    art: "stickers",
    description:
      "A small way to share the project and start conversations. Final artwork and pack contents are not yet confirmed.",
  },
];

export const ORDER_STEPS: OrderStep[] = [
  {
    title: "Select merchandise",
    description: "Choose the Project Ilaw item you would like to order.",
  },
  {
    title: "Fill out order details",
    description: "Provide your name, contact number, item, size, and quantity.",
  },
  {
    title: "Pay using the designated payment method",
    description:
      "The official payment method will be announced here once ordering opens.",
  },
  {
    title: "Submit proof of payment",
    description: "Send your proof of payment through the designated channel.",
  },
  {
    title: "Wait for payment verification",
    description:
      "The team will verify your payment and confirm your order details.",
  },
];

export const ORDER_FORM_NOTE =
  "The official order form will be made available when ordering opens. Fields below are a visual preview only.";

export const ORDER_FORM_FIELDS: OrderFormField[] = [
  {
    id: "customer-name",
    label: "Customer name",
    control: "text",
    placeholder: "Your full name",
  },
  {
    id: "mobile-number",
    label: "Mobile number",
    control: "tel",
    placeholder: "09XX XXX XXXX",
  },
  {
    id: "product",
    label: "Product",
    control: "select",
    placeholder: "Select a product",
    options: SHOP_ITEMS.map((item) => item.name),
  },
  {
    id: "size",
    label: "Size",
    control: "select",
    placeholder: "Select a size",
    options: ["Small", "Medium", "Large", "Extra Large", "One size"],
    note: "Sample sizes only. Final size options are not yet confirmed.",
  },
  {
    id: "quantity",
    label: "Quantity",
    control: "number",
    placeholder: "1",
  },
  {
    id: "notes",
    label: "Notes",
    control: "textarea",
    placeholder: "Anything we should know about your order?",
    wide: true,
  },
];
