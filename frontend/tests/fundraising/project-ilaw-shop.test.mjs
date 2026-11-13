import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

import {
  CUSTOMER_FULFILLMENT_STATUS_LABELS,
  CUSTOMER_PAYMENT_STATUS_LABELS,
  ECO_BAG_COLORS,
  FULFILLMENT_STATUS_LABELS,
  FULFILLMENT_TRANSITIONS,
  ORDER_FULFILMENT,
  ORDER_STEPS,
  PAYMENT_QR,
  PAYMENT_STATUS_LABELS,
  PROJECT_ILAW,
  SHOP_ITEMS,
  SHOP_STATUS,
  T_SHIRT_COLORS,
  T_SHIRT_SIZES,
  canCancelOrder,
  calculateDraftTotals,
  createDraftItem,
  defaultColorForProduct,
  defaultSizeForProduct,
  formatPeso,
  validateOrderDraft,
} from "../../src/features/fundraising/projectIlaw.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const fileExists = async (url) => {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
};

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

test("the T-shirt lists XS through 3XL and the five documented colours", () => {
  const shirt = SHOP_ITEMS.find((item) => item.id === "project-ilaw-t-shirt");

  assert.ok(shirt);
  assert.deepEqual(shirt.sizes, ["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
  assert.deepEqual(shirt.sizes, T_SHIRT_SIZES);
  assert.equal(shirt.sizeLabel, "Sizes");
  assert.deepEqual(shirt.colors, ["Black", "White", "Maroon", "Green", "Blue"]);
  assert.deepEqual(shirt.colors, T_SHIRT_COLORS);
  assert.equal(shirt.colorLabel, "Shirt colours");
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
  assert.deepEqual(bag.colors, ECO_BAG_COLORS);
  assert.equal(bag.colorLabel, "Handle colours");
  assert.match(bag.description, /Let His Light Shine, Let His Glory Rise/);

  // The public product card shows the single "One Size" chip from the
  // showcase release; the order editor still skips the redundant selector.
  const card = await read(
    "../../src/components/fundraising/MerchandiseCard.tsx",
  );
  assert.match(card, /merch-chips/);
  assert.match(card, /item\.sizes\.map/);

  const editor = await read(
    "../../src/components/fundraising/OrderLineItemsEditor.tsx",
  );
  assert.match(editor, /order-cart-item-details/);
  assert.match(editor, /Remove/);
  assert.doesNotMatch(editor, /Select a product/);
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

test("public ordering is closed by default and gated by the server setting", async () => {
  const page = await read("../../src/pages/ShopPage.tsx");
  const form = await read("../../src/components/fundraising/OrderForm.tsx");
  const card = await read(
    "../../src/components/fundraising/MerchandiseCard.tsx",
  );

  assert.equal(SHOP_STATUS.defaultOrdersEnabled, false);
  assert.match(SHOP_STATUS.closedNotice, /not open/i);
  assert.match(SHOP_STATUS.closedNotice, /preview only/i);
  assert.match(SHOP_STATUS.openNotice, /payment instructions/i);
  assert.doesNotMatch(SHOP_STATUS.openNotice, /messenger/i);
  assert.match(SHOP_STATUS.openCatalogNotice, /₱499/);
  assert.match(SHOP_STATUS.openCatalogNotice, /colour/i);
  assert.match(SHOP_STATUS.closedCatalogNotice, /₱499/);
  assert.match(SHOP_STATUS.availabilityLabel, /available/i);
  assert.equal(SHOP_STATUS.closedLabel, "Ordering not open yet");

  // Product cards reflect the closed default.
  assert.match(card, /ordersEnabled = false/);
  assert.match(card, /SHOP_STATUS\.closedLabel/);

  // Product cards remain visible for preview, while all ordering controls
  // follow the server-side open/closed setting.
  assert.match(page, /getProjectIlawPublicSettings/);
  assert.match(page, /setOrdersEnabled\(settings\.ordersEnabled\)/);
  assert.match(page, /<OrderForm ordersEnabled=\{ordersEnabled\} \/>/);
  assert.match(page, /id="how-to-order"[\s\S]*id="order-form"/);
  assert.match(form, /ordersEnabled = true/);
  assert.match(form, /ordersEnabled=\{ordersEnabled\}/);
  assert.match(form, /disabled=\{!ordersEnabled/);
  assert.match(card, /onAddItem/);
  assert.match(card, /Add to order/);
  assert.match(card, /Choose size/);
  assert.match(page, /Ordering is not open yet/);
  assert.match(form, /Your order was not saved/);
});

test("the ordering process keeps the website payment steps in order", () => {
  assert.deepEqual(
    ORDER_STEPS.map((step) => step.title),
    [
      "Choose your items",
      "Submit your order",
      "Check your payment options",
      "Complete your payment",
      "Wait for confirmation",
    ],
  );

  const content = JSON.stringify(ORDER_STEPS);
  assert.doesNotMatch(content, /messenger|bryan/i);
  assert.match(content, /transaction reference/i);
  assert.match(content, /only be marked as paid after confirmation/i);
});

test("draft validation enforces required fields, quantities, sizes, and colours", () => {
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

  const noColour = validateOrderDraft({
    ...base,
    customerName: "Grace Member",
    mobile: "09171234567",
    items: [{ ...shirt, size: "M" }],
  });
  assert.equal(noColour.ok, false);
  assert.ok(noColour.errors.some((error) => /shirt colour/i.test(error)));

  const badBagColour = validateOrderDraft({
    ...base,
    customerName: "Grace Member",
    mobile: "09171234567",
    items: [{ ...createDraftItem("project-ilaw-eco-bag"), color: "Black" }],
  });
  assert.equal(badBagColour.ok, false);
  assert.ok(badBagColour.errors.some((error) => /handle colour/i.test(error)));

  const fractional = validateOrderDraft({
    ...base,
    customerName: "Grace Member",
    mobile: "09171234567",
    items: [{ ...shirt, size: "M", color: "Black", quantity: "1.5" }],
  });
  assert.equal(fractional.ok, false);

  const valid = validateOrderDraft({
    ...base,
    customerName: "  Grace Member  ",
    mobile: "0917 123 4567",
    notes: "  Please prepare two  ",
    items: [
      { ...shirt, size: "M", color: "Black", quantity: "2" },
      { ...createDraftItem("project-ilaw-eco-bag"), color: "Green", quantity: 1 },
    ],
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.customerName, "Grace Member");
  assert.equal(valid.notes, "Please prepare two");
  assert.equal(valid.totalQuantity, 3);
  assert.equal(valid.totalAmount, 1497);
  assert.deepEqual(valid.items, [
    {
      productId: "project-ilaw-t-shirt",
      size: "M",
      color: "Black",
      quantity: 2,
    },
    {
      productId: "project-ilaw-eco-bag",
      size: "One Size",
      color: "Green",
      quantity: 1,
    },
  ]);
});

test("the eco bag is always normalized to One Size and needs a handle colour", () => {
  assert.equal(defaultSizeForProduct("project-ilaw-eco-bag"), "One Size");
  assert.equal(defaultSizeForProduct("project-ilaw-t-shirt"), "");
  assert.equal(defaultColorForProduct("project-ilaw-eco-bag"), "");
  assert.equal(defaultColorForProduct("project-ilaw-t-shirt"), "");

  const bag = createDraftItem("project-ilaw-eco-bag");
  assert.equal(bag.size, "One Size");

  const validation = validateOrderDraft({
    customerName: "Grace Member",
    mobile: "09171234567",
    notes: "",
    items: [{ ...bag, size: "", color: "Blue" }],
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.items[0].size, "One Size");
});

test("draft totals only count valid quantities at ₱499 each", () => {
  const items = [
    {
      key: "a",
      productId: "project-ilaw-t-shirt",
      size: "S",
      color: "Black",
      quantity: 2,
    },
    {
      key: "b",
      productId: "project-ilaw-eco-bag",
      size: "One Size",
      color: "Maroon",
      quantity: 3,
    },
    {
      key: "c",
      productId: "project-ilaw-t-shirt",
      size: "M",
      color: "White",
      quantity: "0",
    },
  ];
  assert.deepEqual(calculateDraftTotals(items), {
    totalQuantity: 5,
    totalAmount: 2495,
  });
});

test("status labels and transitions match the documented order workflow", () => {
  assert.deepEqual(PAYMENT_STATUS_LABELS, {
    awaiting_payment: "Awaiting Payment",
    payment_verification: "Payment Verification",
    paid: "Paid",
  });
  assert.deepEqual(FULFILLMENT_STATUS_LABELS, {
    not_started: "Not Started",
    in_production: "In Production",
    ready_for_pickup: "Ready for Pickup",
    completed: "Completed",
    cancelled: "Cancelled",
  });

  assert.deepEqual(FULFILLMENT_TRANSITIONS.not_started, [
    "in_production",
    "ready_for_pickup",
  ]);
  assert.deepEqual(FULFILLMENT_TRANSITIONS.in_production, ["ready_for_pickup"]);
  assert.deepEqual(FULFILLMENT_TRANSITIONS.ready_for_pickup, ["completed"]);
  assert.deepEqual(FULFILLMENT_TRANSITIONS.completed, []);
  assert.deepEqual(FULFILLMENT_TRANSITIONS.cancelled, []);

  assert.equal(canCancelOrder("not_started"), true);
  assert.equal(canCancelOrder("in_production"), true);
  assert.equal(canCancelOrder("ready_for_pickup"), true);
  assert.equal(canCancelOrder("completed"), false);
  assert.equal(canCancelOrder("cancelled"), false);

  // Customers see plain-language statuses while staff keep the internal model.
  assert.deepEqual(CUSTOMER_PAYMENT_STATUS_LABELS, {
    awaiting_payment: "Awaiting Payment",
    payment_verification: "Payment Submitted",
    paid: "Payment Confirmed",
  });
  assert.deepEqual(CUSTOMER_FULFILLMENT_STATUS_LABELS, {
    not_started: "Order received",
    in_production: "Preparing",
    ready_for_pickup: "Ready for pickup",
    completed: "Completed",
    cancelled: "Cancelled",
  });

  assert.match(ORDER_FULFILMENT.method, /Pickup/i);
  assert.match(ORDER_FULFILMENT.method, /God's Grace Community Covenant Church/);
});

test("the order form requires an explicit review before saving", async () => {
  const form = await read("../../src/components/fundraising/OrderForm.tsx");

  assert.match(form, /Review order/);
  assert.match(form, /title="Review your order"/);
  assert.match(form, /setReview\(validation\)/);
  assert.match(form, /confirmOrder/);
  assert.match(form, /Confirm and submit order/);
  assert.match(form, /Go back and edit/);
  assert.match(form, /review\.customerName/);
  assert.match(form, /review\.mobile/);
  assert.match(form, /review\.totalAmount/);
  assert.match(form, /ORDER_FULFILMENT\.method/);
  assert.match(form, /Nothing is charged at\s+this step/);

  // Submission only happens after the customer confirms the review; the form
  // submit handler itself does not call the create RPC.
  const submitHandler = form.slice(
    form.indexOf("function handleSubmit"),
    form.indexOf("async function confirmOrder"),
  );
  assert.doesNotMatch(submitHandler, /createProjectIlawOrder/);
});

test("the confirmation dialog only appears after a successful save and routes to payment", async () => {
  const form = await read("../../src/components/fundraising/OrderForm.tsx");

  assert.match(form, /setConfirmation\(created\)/);
  assert.match(form, /title="Orders Received!"/);
  assert.match(form, /Thank you for supporting Project Ilaw!/);
  assert.match(form, /confirmation\.reference/);
  assert.match(form, /confirmation\.totalAmount/);
  assert.match(form, /Go to payment/);
  assert.match(form, /"pay-order"/);
  assert.match(form, /requestIdRef/);
  assert.match(form, /submitting/);
  assert.doesNotMatch(form, /messenger/i);
  assert.doesNotMatch(form, /bryan/i);
});

test("the order confirmation carries the created order into the payment step", async () => {
  const form = await read("../../src/components/fundraising/OrderForm.tsx");
  const page = await read("../../src/pages/ShopPage.tsx");
  const panel = await read("../../src/components/fundraising/PaymentPanel.tsx");

  // The confirmation seeds the payment step with the just-created order.
  assert.match(form, /setPaymentSeed\(/);
  assert.match(form, /setConfirmation\(created\)/);
  assert.match(
    form,
    /navigate\("\/shop", \{\s*state: \{ projectIlawPayment: paymentSeed \},?\s*\}\)/,
  );

  // The shop page forwards the carried order into the payment panel.
  assert.match(page, /location\.state/);
  assert.match(page, /initialOrder=\{paymentSeed\}/);

  // The payment panel opens the carried order automatically, securely, via the
  // existing name plus mobile lookup, without asking the customer to retype.
  assert.match(panel, /initialOrder\?: ProjectIlawPaymentSeed \| null/);
  assert.match(panel, /\[initialOrder\]/);
  assert.match(panel, /openOrder\(initialOrder\.reference, initialOrder\.mobile\)/);
});

test("the public order form captures colours and the payment section is present", async () => {
  const form = await read("../../src/components/fundraising/OrderForm.tsx");
  const editor = await read(
    "../../src/components/fundraising/OrderLineItemsEditor.tsx",
  );
  const page = await read("../../src/pages/ShopPage.tsx");
  const panel = await read("../../src/components/fundraising/PaymentPanel.tsx");

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
  assert.match(editor, /product\.colorLabel/);
  assert.match(editor, /defaultColorForProduct/);

  assert.match(page, /Place your order/);
  assert.match(page, /id="order-form"/);
  assert.match(page, /<PaymentPanel/);
  assert.match(page, /id="payment"/);
  assert.doesNotMatch(page, /messenger/i);

  assert.match(panel, /id="pay-order"/);
  assert.match(panel, /getProjectIlawPaymentContext/);
  assert.match(panel, /uploadProjectIlawPaymentEvidence/);
  assert.match(panel, /submitProjectIlawPayment/);
  assert.match(panel, /Payment awaiting verification/);
  assert.match(panel, /never marked paid automatically|never confirms payment automatically/i);

  // The panel shows the confirmed QR and plain-language statuses only when
  // payment collection is enabled.
  assert.match(panel, /PAYMENT_QR\.src/);
  assert.match(panel, /PAYMENT_QR\.label/);
  assert.match(panel, /PAYMENT_QR\.notice/);
  assert.match(panel, /View larger QR/);
  assert.match(panel, /CUSTOMER_PAYMENT_STATUS_LABELS/);
  assert.match(panel, /CUSTOMER_FULFILLMENT_STATUS_LABELS/);
  assert.match(panel, /ORDER_FULFILMENT\.method/);
  assert.match(panel, /Payment collection is not open yet/);
});

test("payment lookup shows the QR and evidence upload only while collection is enabled", async () => {
  const panel = await read("../../src/components/fundraising/PaymentPanel.tsx");
  const service = await read("../../src/features/fundraising/orderService.ts");

  // The server owns the switch: the panel never enables payment collection by
  // itself, and a missing flag is treated as disabled.
  assert.match(service, /rpc\(\s*"get_project_ilaw_payment_context"/);
  assert.match(service, /enabled: row\?\.enabled === true/);

  assert.match(
    panel,
    /context\?\.paymentStatus === "awaiting_payment"[\s\S]{0,160}?instructions\?\.enabled === true/,
  );

  // Everything between the enabled test and the closed notice is the paid path.
  const enabledStart = panel.indexOf("instructions?.enabled ?");
  const closedStart = panel.indexOf("Payment collection is not open yet");
  assert.ok(enabledStart !== -1, "the panel must branch on the enabled flag");
  assert.ok(
    closedStart > enabledStart,
    "the closed notice must be the disabled branch",
  );

  const enabledBranch = panel.slice(enabledStart, closedStart);
  assert.match(enabledBranch, /PAYMENT_QR\.src/);
  assert.match(enabledBranch, /PAYMENT_QR\.label/);
  assert.match(enabledBranch, /PAYMENT_QR\.notice/);
  assert.match(enabledBranch, /View larger QR/);
  assert.match(enabledBranch, /<figcaption>/);

  // The disabled branch explains the state and offers neither QR nor upload.
  const submitStart = panel.indexOf("canSubmitPayment &&");
  assert.ok(submitStart > closedStart, "the upload form needs its own guard");

  const disabledBranch = panel.slice(closedStart, submitStart);
  assert.doesNotMatch(disabledBranch, /PAYMENT_QR/);
  assert.doesNotMatch(disabledBranch, /type="file"/);
  assert.match(disabledBranch, /payment evidence[\s\S]{0,40}cannot be submitted yet/);

  // The upload form only appears for an enabled, unpaid, uncancelled order.
  const submitBranch = panel.slice(submitStart);
  assert.match(submitBranch, /type="file"/);
  assert.match(submitBranch, /ACCEPTED_EVIDENCE/);
  assert.match(submitBranch, /Submit payment details/);
  assert.match(panel, /MAX_EVIDENCE_BYTES = 5 \* 1024 \* 1024/);
  assert.match(
    panel,
    /image\/jpeg,image\/png,image\/webp,application\/pdf/,
  );
});

test("authorized staff can enable payment collection from the admin settings panel", async () => {
  const panel = await read(
    "../../src/components/fundraising/ProjectIlawSettingsPanel.tsx",
  );
  const page = await read("../../src/pages/admin/ProjectIlawOrders.tsx");

  // Only administrators (manage) may open payment collection.
  assert.match(panel, /hasPermission\("project_ilaw\.orders\.manage"\)/);
  assert.match(panel, /checked=\{settings\.paymentsEnabled\}/);
  assert.match(panel, /update\(\{ paymentsEnabled: event\.target\.checked \}\)/);
  assert.match(panel, /paymentsEnabled: settings\.paymentsEnabled/);

  // Order intake and payment collection stay separate controls.
  assert.match(panel, /Accept public orders/);
  assert.match(panel, /This does not\s+enable payment collection/);
  assert.match(panel, /Show payment details to customers/);
  assert.match(panel, /confirmed GCash InstaPay QR is\s+shown/);

  // The settings panel is intentionally no longer rendered on Order Management.
  assert.doesNotMatch(page, /<ProjectIlawSettingsPanel/);
  assert.doesNotMatch(page, /ProjectIlawSettingsPanel/);
});

test("every order item renders its own colour selector from the product configuration", async () => {
  const editor = await read(
    "../../src/components/fundraising/OrderLineItemsEditor.tsx",
  );

  // Each product must publish both a label and its allowed colours, otherwise
  // the editor would render an empty or missing colour dropdown.
  for (const item of SHOP_ITEMS) {
    assert.ok(item.colors.length > 0, `${item.id} needs at least one colour`);
    assert.equal(
      new Set(item.colors).size,
      item.colors.length,
      `${item.id} colours must be unique`,
    );
    assert.ok(item.colorLabel.trim().length > 0, `${item.id} needs a colour label`);
  }

  assert.deepEqual(
    SHOP_ITEMS.find((item) => item.id === "project-ilaw-t-shirt")?.colors,
    ["Black", "White", "Maroon", "Green", "Blue"],
  );
  assert.deepEqual(
    SHOP_ITEMS.find((item) => item.id === "project-ilaw-eco-bag")?.colors,
    ["Maroon", "Green", "Blue"],
  );

  // The selector is rendered per line item, keyed to that item so each row
  // keeps an independent selection.
  assert.match(editor, /id=\{`\$\{idPrefix\}-color-\$\{item\.key\}`\}/);
  assert.match(editor, /value=\{item\.color\}/);
  assert.match(
    editor,
    /updateItem\(item\.key, \{ color: event\.target\.value \}\)/,
  );
  assert.match(editor, /product\.colors\.map/);
  assert.match(editor, /Select a colour/);
  assert.match(editor, /product\.colorLabel/);

  // A T-shirt shows the colour field between Product and Size; the eco bag
  // keeps its handle-colour field and hides the redundant size selector.
  const productIndex = editor.indexOf("-product-${item.key}");
  const colourIndex = editor.indexOf("-color-${item.key}");
  const sizeIndex = editor.indexOf("-size-${item.key}");
  assert.ok(productIndex < colourIndex, "colour follows the product selector");
  assert.ok(colourIndex < sizeIndex, "colour precedes the size selector");
  assert.match(editor, /isEcoBag\(item\.productId\)/);

  // Colour state lives in the draft item, never in shared component state.
  assert.doesNotMatch(editor, /useState/);
});

test("the chosen colour reaches the review, the summary, and the submitted order", async () => {
  const form = await read("../../src/components/fundraising/OrderForm.tsx");
  const service = await read("../../src/features/fundraising/orderService.ts");

  // Validation keeps each line item's own colour and passes it through.
  const validation = validateOrderDraft({
    customerName: "Grace Member",
    mobile: "09171234567",
    notes: "",
    items: [
      { ...createDraftItem(), size: "M", color: "Black", quantity: 1 },
      {
        ...createDraftItem("project-ilaw-eco-bag"),
        color: "Green",
        quantity: 2,
      },
    ],
  });
  assert.equal(validation.ok, true);
  assert.deepEqual(
    validation.items.map((item) => item.color),
    ["Black", "Green"],
  );

  // The live summary and the pre-submit review both show the Colour column.
  assert.match(form, /<th scope="col">Colour<\/th>/);
  assert.match(form, /<td>\{item\.color \|\| "—"\}<\/td>/);
  assert.match(form, /<td>\{item\.color\}<\/td>/);

  // The reviewed items, including colour, are what gets submitted.
  assert.match(form, /items: review\.items/);
  assert.match(service, /p_items: input\.items/);
});

test("the confirmed GCash InstaPay QR is a public, unchanged asset", async () => {
  assert.equal(
    PAYMENT_QR.src,
    "/images/fundraising/gcash-instapay-qr.png",
  );
  assert.equal(PAYMENT_QR.label, "GCash (InstaPay QR)");
  assert.equal(PAYMENT_QR.notice, "Transfer fees may apply.");
  assert.ok(PAYMENT_QR.alt);

  const image = await readFile(
    new URL("../../public/images/fundraising/gcash-instapay-qr.png", import.meta.url),
  );
  // The supplied image is a PNG; preserve it byte-for-byte rather than
  // regenerating or re-encoding the QR.
  assert.deepEqual([...image.subarray(0, 8)], [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  // IHDR chunk: 4-byte length, 4-byte type "IHDR", then width and height.
  const ihdrOffset = 8 + 4 + 4;
  const width = image.readUInt32BE(ihdrOffset);
  const height = image.readUInt32BE(ihdrOffset + 4);
  assert.equal(width, 1064);
  assert.equal(height, 2048);

  // The QR lives in the public asset tree, never in payment evidence storage.
  assert.doesNotMatch(PAYMENT_QR.src, /payment-evidence/i);

  const give = await read("../../src/pages/GivePage.tsx");
  assert.match(give, /\/images\/fundraising\/gcash-instapay-qr\.png/);
  assert.doesNotMatch(give, /assets\/instapay-qr\.png/);
  assert.match(give, /GCash/);
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

test("the homepage keeps Project Ilaw but no longer duplicates the shop mockups", async () => {
  const homepage = await read("../../src/pages/HomePage.tsx");

  const ilaw = homepage.indexOf("<ProjectIlawSection />");
  const gallery = homepage.indexOf("<CommunityGallery />");

  assert.notEqual(ilaw, -1);
  assert.notEqual(gallery, -1);
  assert.ok(ilaw < gallery, "Project Ilaw stays on the homepage");

  // The old merchandise preview was removed; the real catalogue lives at /shop.
  assert.doesNotMatch(homepage, /ShopPreviewSection/);
  assert.equal(
    await fileExists(
      new URL(
        "../../src/components/fundraising/ShopPreviewSection.tsx",
        import.meta.url,
      ),
    ),
    false,
  );

  const section = await read(
    "../../src/components/fundraising/ProjectIlawSection.tsx",
  );
  assert.match(section, /id="project-ilaw"/);
  assert.match(section, /to="\/shop"/);

  const content = await read("../../src/features/fundraising/projectIlaw.ts");
  assert.doesNotMatch(content, /SHOP_PREVIEW/);

  const css = await read("../../src/features/fundraising/Fundraising.css");
  assert.doesNotMatch(css, /\.shop-preview-/);
});

test("the landing page copy no longer sends customers to Messenger", async () => {
  const files = [
    "../../src/pages/HomePage.tsx",
    "../../src/components/fundraising/ProjectIlawSection.tsx",
    "../../src/features/fundraising/projectIlaw.ts",
    "../../src/pages/ShopPage.tsx",
  ];

  for (const file of files) {
    const content = await read(file);
    assert.doesNotMatch(content, /messenger/i, `${file} must not use Messenger`);
    assert.doesNotMatch(content, /bryan castro/i, `${file} must not name Bryan Castro`);
    assert.doesNotMatch(
      content,
      /Two ways to support Project Ilaw/i,
      `${file} must not show the old banner`,
    );
  }
});

test("public navigation links to Project Ilaw and Shop on desktop and mobile", async () => {
  const navbar = await read("../../src/components/Navbar.tsx");

  const anchorLinks = navbar.match(/to="\/#project-ilaw"/g) ?? [];
  const shopLinks = navbar.match(/to="\/shop"/g) ?? [];

  assert.equal(anchorLinks.length, 2, "desktop and mobile need Project Ilaw");
  assert.equal(shopLinks.length, 2, "desktop and mobile need Shop");
  assert.match(navbar, /Lightbulb/);
  assert.match(navbar, /ShoppingBag/);

  // Repeated clicks on the homepage scroll directly, so an unchanged hash
  // cannot swallow the navigation.
  const handlers = navbar.match(/onClick=\{handleProjectIlawClick\}/g) ?? [];
  assert.equal(handlers.length, 2, "desktop and mobile both need the handler");
  assert.match(navbar, /pathname !== "\/"/);
  assert.match(navbar, /scrollIntoView/);
  assert.match(navbar, /closeMenu\(\)/);
});

test("hash navigation can reach the Project Ilaw section", async () => {
  const scroll = await read("../../src/components/ScrollToTop.tsx");
  assert.match(scroll, /useLocation\(\)/);
  assert.match(scroll, /location|hash/);
  assert.match(scroll, /scrollIntoView/);
  assert.match(scroll, /decodeURIComponent/);
});

test("the Give page keeps its details and uses the requested responsive layout", async () => {
  const page = await read("../../src/pages/GivePage.tsx");
  const css = await read("../../src/components/PublicPage.css");

  assert.match(page, /3143314461925/);
  assert.match(page, /Gods Grace Community Church/);
  assert.match(page, /navigator\.clipboard\.writeText/);
  assert.match(page, /instapayQr/);
  assert.match(page, /Scan to Give/);
  assert.match(page, /qr-card-text/);

  assert.match(css, /\.giving-grid \{[^}]*grid-template-columns: repeat\(2,/s);
  assert.match(
    css,
    /\.giving-grid > \.qr-card \{[^}]*grid-column: 1 \/ -1;[^}]*text-align: left;[^}]*width: 100%; \}/s,
  );
  assert.match(css, /\.qr-card \{[^}]*grid-template-columns: minmax/s);
  assert.match(
    css,
    /\.giving-grid > \.qr-card img \{[^}]*width: 320px/s,
  );
  assert.match(
    css,
    /@media \(max-width: 560px\) \{[\s\S]*\.giving-grid > \.qr-card img \{[^}]*width: min\(100%,280px\)/s,
  );
  assert.match(
    css,
    /@media \(max-width: 560px\) \{[\s\S]*\.giving-grid > \.qr-card \{ grid-template-columns: 1fr; padding: 23px 20px; text-align: center; \}/s,
  );
});
test("order management puts search before summary cards and hides production reports", async () => {
  const page = await read("../../src/pages/admin/ProjectIlawOrders.tsx");

  const searchIndex = page.indexOf('aria-label="Order search"');
  const summaryIndex = page.indexOf('aria-label="Order summary"');

  assert.ok(searchIndex !== -1, "prominent search panel is required");
  assert.ok(summaryIndex !== -1, "summary cards are required");
  assert.ok(searchIndex < summaryIndex, "search must precede summary cards");
  assert.doesNotMatch(page, /<ProductionReportPanel/);
  assert.doesNotMatch(page, /pilaw-breakdown/);

  // Action column is present with context-sensitive payment actions.
  assert.match(page, /<th scope="col">Action<\/th>/);
  assert.match(page, /Record cash payment/);
  assert.match(page, /Review payment/);
  assert.match(page, /pilaw-paid-indicator/);
});

test("order detail offers a cash recording action with an explicit receipt confirmation", async () => {
  const detail = await read("../../src/pages/admin/ProjectIlawOrderDetail.tsx");
  const service = await read("../../src/features/fundraising/orderService.ts");

  assert.match(detail, /Record cash payment/);
  assert.match(detail, /recordProjectIlawCashPayment/);
  assert.match(service, /recordProjectIlawCashPayment/);
  assert.match(detail, /I have physically received the cash for this order/);
  assert.match(detail, /type="checkbox"/);
  assert.match(detail, /Amount received/);
});
