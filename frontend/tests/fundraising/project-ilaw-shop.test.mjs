import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  FULFILLMENT_STATUS_LABELS,
  FULFILLMENT_TRANSITIONS,
  ORDER_STEPS,
  PAYMENT_STATUS_LABELS,
  PROJECT_ILAW,
  SHOP_ITEMS,
  SHOP_STATUS,
  T_SHIRT_SIZES,
  canCancelOrder,
  calculateDraftTotals,
  createDraftItem,
  defaultSizeForProduct,
  formatPeso,
  normalizeMessengerUrl,
  validateOrderDraft,
} from "../../src/features/fundraising/projectIlaw.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Project Ilaw describes the lighting work without invented figures", () => {
  assert.match(PROJECT_ILAW.summary, /repairs and improvements/i);
  assert.match(PROJECT_ILAW.summary, /lighting/i);
  assert.match(PROJECT_ILAW.summary, /new lighting designs/i);
  assert.equal(PROJECT_ILAW.goals.length, 2);

  const content = JSON.stringify({ PROJECT_ILAW, SHOP_STATUS });
  assert.doesNotMatch(content, /GCash|bank account|account number/i);
  assert.doesNotMatch(content, /\b\d{2,3}%/);
  assert.doesNotMatch(content, /raised so far|fundraising target/i);
});

test("the catalog offers only the T-shirt and eco bag at ₱499 each", () => {
  assert.equal(SHOP_ITEMS.length, 2);
  assert.deepEqual(
    SHOP_ITEMS.map((item) => item.name),
    ["Project Ilaw T-shirt", "Project Ilaw Eco Bag"],
  );
  assert.deepEqual(
    SHOP_ITEMS.map((item) => item.category),
    ["T-shirt", "Eco bag"],
  );
  assert.equal(SHOP_ITEMS.some((item) => /sticker/i.test(item.name)), false);

  for (const item of SHOP_ITEMS) {
    assert.equal(item.price, 499, `${item.name} must cost ₱499`);
    assert.equal(formatPeso(item.price), "₱499");
    assert.ok(item.description);
  }
});

test("the T-shirt lists XS through 3XL and shows the mockup colours", () => {
  const shirt = SHOP_ITEMS.find((item) => item.id === "project-ilaw-t-shirt");

  assert.ok(shirt);
  assert.deepEqual(shirt.sizes, ["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
  assert.deepEqual(shirt.sizes, T_SHIRT_SIZES);
  assert.equal(shirt.sizeLabel, "Sizes");
  assert.deepEqual(shirt.colors, ["Black", "White", "Maroon", "Green", "Blue"]);
  assert.match(shirt.description, /front/i);
  assert.match(shirt.description, /Let His Light Shine, Let His Glory Rise/);
  assert.match(shirt.description, /Haggai 2:9/);
});

test("the eco bag is one size with maroon, green, and blue handles", async () => {
  const bag = SHOP_ITEMS.find((item) => item.id === "project-ilaw-eco-bag");

  assert.ok(bag);
  assert.deepEqual(bag.sizes, ["One Size"]);
  assert.equal(bag.sizeLabel, "Size");
  assert.deepEqual(bag.colors, ["Maroon", "Green", "Blue"]);
  assert.equal(bag.colorLabel, "Handle colours");
  assert.match(bag.description, /Let His Light Shine, Let His Glory Rise/);

  // The public product card hides the redundant single "One Size" chip.
  const card = await read(
    "../../src/components/fundraising/MerchandiseCard.tsx",
  );
  assert.match(card, /hasSizeChoice/);
  assert.match(card, /hasSizeChoice &&/);

  const editor = await read(
    "../../src/components/fundraising/OrderLineItemsEditor.tsx",
  );
  assert.doesNotMatch(editor, /One Size/);
  assert.match(editor, /isEcoBag\(item\.productId\)/);
});

test("the catalog renders the supplied mockup images without distortion", async () => {
  const expectedImages = [
    ["Project Ilaw T-shirt", "/images/fundraising/project-ilaw-shirts.jpg"],
    ["Project Ilaw Eco Bag", "/images/fundraising/project-ilaw-tote-bags.jpg"],
  ];

  assert.deepEqual(
    SHOP_ITEMS.map((item) => [item.name, item.image.src]),
    expectedImages,
  );

  for (const item of SHOP_ITEMS) {
    assert.ok(item.image.alt);
    assert.ok(item.image.width > 0 && item.image.height > 0);

    const image = await readFile(
      new URL(`../../public${item.image.src}`, import.meta.url),
    );
    assert.ok(image.length > 50_000, `${item.image.src} looks too small`);
    assert.deepEqual(
      [...image.subarray(0, 3)],
      [0xff, 0xd8, 0xff],
      `${item.image.src} must be the supplied JPEG mockup`,
    );
  }

  const card = await read(
    "../../src/components/fundraising/MerchandiseCard.tsx",
  );
  assert.match(card, /<img/);
  assert.match(card, /src=\{item\.image\.src\}/);
  assert.match(card, /alt=\{item\.image\.alt\}/);
  assert.match(card, /formatPeso\(item\.price\)/);

  const css = await read("../../src/features/fundraising/Fundraising.css");
  assert.match(css, /\.merch-art img \{[^}]*object-fit: contain/s);
});

test("ordering is open and payment is arranged manually on Messenger", () => {
  assert.equal(SHOP_STATUS.orderingOpen, true);
  assert.match(SHOP_STATUS.notice, /Messenger/i);
  assert.match(SHOP_STATUS.notice, /Bryan Castro/);
  assert.match(SHOP_STATUS.catalogNotice, /₱499/);
  assert.match(SHOP_STATUS.availabilityLabel, /available/i);
});

test("the ordering process keeps the required manual-payment steps in order", () => {
  assert.deepEqual(
    ORDER_STEPS.map((step) => step.title),
    [
      "Choose your items",
      "Submit your order",
      "Message Bryan on Messenger",
      "Pay as instructed",
      "Wait for payment confirmation",
    ],
  );

  const content = JSON.stringify(ORDER_STEPS);
  assert.doesNotMatch(content, /GCash|bank account|account number/i);
  assert.doesNotMatch(content, /upload|proof of payment|receipt/i);
});

test("draft validation enforces required fields, whole quantities, and sizes", () => {
  const base = {
    customerName: "",
    mobile: "",
    notes: "",
    items: [createDraftItem()],
  };

  const missing = validateOrderDraft(base);
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((error) => /customer name/i.test(error)));
  assert.ok(missing.errors.some((error) => /mobile number/i.test(error)));

  const shirt = createDraftItem("project-ilaw-t-shirt");
  const noSize = validateOrderDraft({
    ...base,
    customerName: "Grace Member",
    mobile: "09171234567",
    items: [shirt],
  });
  assert.equal(noSize.ok, false);
  assert.ok(noSize.errors.some((error) => /T-shirt size/i.test(error)));

  const fractional = validateOrderDraft({
    ...base,
    customerName: "Grace Member",
    mobile: "09171234567",
    items: [{ ...shirt, size: "M", quantity: "1.5" }],
  });
  assert.equal(fractional.ok, false);

  const valid = validateOrderDraft({
    ...base,
    customerName: "  Grace Member  ",
    mobile: "0917 123 4567",
    notes: "  Please prepare two  ",
    items: [
      { ...shirt, size: "M", quantity: "2" },
      { ...createDraftItem("project-ilaw-eco-bag"), quantity: 1 },
    ],
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.customerName, "Grace Member");
  assert.equal(valid.notes, "Please prepare two");
  assert.equal(valid.totalQuantity, 3);
  assert.equal(valid.totalAmount, 1497);
  assert.deepEqual(valid.items, [
    { productId: "project-ilaw-t-shirt", size: "M", quantity: 2 },
    { productId: "project-ilaw-eco-bag", size: "One Size", quantity: 1 },
  ]);
});

test("the eco bag is always normalized to One Size and never needs a size choice", () => {
  assert.equal(defaultSizeForProduct("project-ilaw-eco-bag"), "One Size");
  assert.equal(defaultSizeForProduct("project-ilaw-t-shirt"), "");

  const bag = createDraftItem("project-ilaw-eco-bag");
  assert.equal(bag.size, "One Size");

  const validation = validateOrderDraft({
    customerName: "Grace Member",
    mobile: "09171234567",
    notes: "",
    items: [{ ...bag, size: "" }],
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.items[0].size, "One Size");
});

test("draft totals only count valid quantities at ₱499 each", () => {
  const items = [
    { key: "a", productId: "project-ilaw-t-shirt", size: "S", quantity: 2 },
    { key: "b", productId: "project-ilaw-eco-bag", size: "One Size", quantity: 3 },
    { key: "c", productId: "project-ilaw-t-shirt", size: "M", quantity: "0" },
  ];
  assert.deepEqual(calculateDraftTotals(items), {
    totalQuantity: 5,
    totalAmount: 2495,
  });
});

test("status labels and transitions match the documented order workflow", () => {
  assert.deepEqual(PAYMENT_STATUS_LABELS, {
    awaiting_payment: "Awaiting Payment",
    payment_confirmed: "Payment Confirmed",
  });
  assert.deepEqual(FULFILLMENT_STATUS_LABELS, {
    not_started: "Not Started",
    processing: "Processing",
    ready_for_pickup: "Ready for Pickup",
    completed: "Completed",
    cancelled: "Cancelled",
  });

  assert.deepEqual(FULFILLMENT_TRANSITIONS.not_started, [
    "processing",
    "ready_for_pickup",
  ]);
  assert.deepEqual(FULFILLMENT_TRANSITIONS.processing, ["ready_for_pickup"]);
  assert.deepEqual(FULFILLMENT_TRANSITIONS.ready_for_pickup, ["completed"]);
  assert.deepEqual(FULFILLMENT_TRANSITIONS.completed, []);
  assert.deepEqual(FULFILLMENT_TRANSITIONS.cancelled, []);

  assert.equal(canCancelOrder("not_started"), true);
  assert.equal(canCancelOrder("processing"), true);
  assert.equal(canCancelOrder("ready_for_pickup"), true);
  assert.equal(canCancelOrder("completed"), false);
  assert.equal(canCancelOrder("cancelled"), false);
});

test("the Messenger link only accepts documented Facebook hosts", () => {
  assert.equal(normalizeMessengerUrl("https://m.me/bryan"), "https://m.me/bryan");
  assert.equal(
    normalizeMessengerUrl("https://www.facebook.com/bryan"),
    "https://www.facebook.com/bryan",
  );
  assert.equal(normalizeMessengerUrl("javascript:alert(1)"), null);
  assert.equal(normalizeMessengerUrl("http://m.me/bryan"), null);
  assert.equal(normalizeMessengerUrl("https://example.com/bryan"), null);
  assert.equal(normalizeMessengerUrl(""), null);
  assert.equal(normalizeMessengerUrl(null), null);
});

test("the confirmation dialog only appears after a successful save", async () => {
  const form = await read("../../src/components/fundraising/OrderForm.tsx");

  assert.match(form, /setConfirmation\(created\)/);
  assert.match(form, /title="Orders Received!"/);
  assert.match(form, /Thank you for supporting Project Ilaw!/);
  assert.match(
    form,
    /contact Bryan Castro on Facebook Messenger/i,
  );
  assert.match(form, /Message Bryan on Messenger/);
  assert.match(form, /confirmation\.reference/);
  assert.match(form, /PROJECT_ILAW_MESSENGER_URL/);
  assert.match(form, /requestIdRef/);
  assert.match(form, /submitting/);

  // The modal is rendered from successful state, not from the click alone.
  assert.doesNotMatch(form, /GCash|account number|upload/i);
});

test("the public order form captures the required customer and item data", async () => {
  const form = await read("../../src/components/fundraising/OrderForm.tsx");
  const editor = await read(
    "../../src/components/fundraising/OrderLineItemsEditor.tsx",
  );
  const page = await read("../../src/pages/ShopPage.tsx");

  assert.match(form, /Customer name/);
  assert.match(form, /Mobile number/);
  assert.match(form, /Order notes \(optional\)/);
  assert.match(form, /<OrderLineItemsEditor/);
  assert.match(editor, /Add another item/);
  assert.match(editor, /Remove/);
  assert.match(editor, /type="number"/);
  assert.match(editor, /min=\{1\}/);
  assert.match(editor, /max=\{99\}/);
  assert.match(editor, /Unit price/);
  assert.match(editor, /Line total/);

  assert.match(page, /Place your order/);
  assert.match(page, /id="order-form"/);
  assert.doesNotMatch(page, /Ordering is not yet open/);
});

test("the shop route is public and uses the existing public layout", async () => {
  const app = await read("../../src/App.tsx");

  const publicLayout = app.indexOf("<Route element={<PublicLayout />}>");
  const shopRoute = app.indexOf('path="/shop"');
  const staffLogin = app.indexOf("{/* Staff Portal Login */}");

  assert.notEqual(publicLayout, -1);
  assert.notEqual(shopRoute, -1);
  assert.notEqual(staffLogin, -1);
  assert.ok(
    publicLayout < shopRoute && shopRoute < staffLogin,
    "/shop must be registered inside the public layout",
  );
  assert.match(app, /import ShopPage from "\.\/pages\/ShopPage"/);
});

test("the homepage places the shop preview directly below Project Ilaw", async () => {
  const homepage = await read("../../src/pages/HomePage.tsx");

  const ilaw = homepage.indexOf("<ProjectIlawSection />");
  const shopPreview = homepage.indexOf("<ShopPreviewSection />");
  const gallery = homepage.indexOf("<CommunityGallery />");

  assert.notEqual(ilaw, -1);
  assert.notEqual(shopPreview, -1);
  assert.notEqual(gallery, -1);
  assert.ok(ilaw < shopPreview, "shop preview must follow Project Ilaw");
  assert.ok(shopPreview < gallery, "shop preview must stay on the homepage");

  const section = await read(
    "../../src/components/fundraising/ProjectIlawSection.tsx",
  );
  assert.match(section, /id="project-ilaw"/);
  assert.match(section, /to="\/shop"/);
});

test("public navigation links to Project Ilaw and Shop on desktop and mobile", async () => {
  const navbar = await read("../../src/components/Navbar.tsx");

  const anchorLinks = navbar.match(/to="\/#project-ilaw"/g) ?? [];
  const shopLinks = navbar.match(/to="\/shop"/g) ?? [];

  assert.equal(anchorLinks.length, 2, "desktop and mobile need Project Ilaw");
  assert.equal(shopLinks.length, 2, "desktop and mobile need Shop");
  assert.match(navbar, /Lightbulb/);
  assert.match(navbar, /ShoppingBag/);
});

test("hash navigation can reach the Project Ilaw section", async () => {
  const scroll = await read("../../src/components/ScrollToTop.tsx");
  assert.match(scroll, /useLocation\(\)/);
  assert.match(scroll, /location|hash/);
  assert.match(scroll, /scrollIntoView/);
  assert.match(scroll, /decodeURIComponent/);
});
