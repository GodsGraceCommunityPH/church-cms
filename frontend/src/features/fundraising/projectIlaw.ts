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

export interface OrderFormField {
  id: string;
  label: string;
  control: OrderFieldControl;
  placeholder?: string;
  options?: string[];
  note?: string;
  wide?: boolean;
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
  orderingOpen: false,
  notice:
    "Ordering is not yet open. The details below show how the process is planned to work.",
  catalogNotice:
    "Both items are ₱499 each. Ordering is not yet open, so purchases cannot be completed yet.",
  availabilityLabel: "Ordering not yet open",
  previewOnlyNotice:
    "Preview only. This form is not connected and cannot submit or store any information.",
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
      "Everyday T-shirt with the Project Ilaw logo on the front and \u201cLet His Light Shine, Let His Glory Rise\u201d (Haggai 2:9) on the back.",
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
      "Reusable eco bag with the Project Ilaw logo and the \u201cLet His Light Shine, Let His Glory Rise\u201d design. Available with maroon, green, or blue handles.",
    sizes: ["One Size"],
    sizeLabel: "Size",
    colors: ["Maroon", "Green", "Blue"],
    colorLabel: "Handle colours",
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
    options: [...T_SHIRT_SIZES, "One Size"],
    note: "T-shirt sizes: XS, S, M, L, XL, 2XL, 3XL. Eco bag: One Size only.",
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
