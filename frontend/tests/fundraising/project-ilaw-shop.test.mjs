import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  formatPeso,
  ORDER_FORM_FIELDS,
  ORDER_STEPS,
  PROJECT_ILAW,
  SHOP_ITEMS,
  SHOP_STATUS,
  T_SHIRT_SIZES,
} from "../../src/features/fundraising/projectIlaw.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Project Ilaw describes the lighting work without invented figures", () => {
  assert.match(PROJECT_ILAW.summary, /repairs and improvements/i);
  assert.match(PROJECT_ILAW.summary, /lighting/i);
  assert.match(PROJECT_ILAW.summary, /new lighting designs/i);
  assert.equal(PROJECT_ILAW.goals.length, 2);

  const content = JSON.stringify({ PROJECT_ILAW, SHOP_STATUS });
  assert.doesNotMatch(content, /GCash|account number/i);
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

test("the eco bag is one size with maroon, green, and blue handles", () => {
  const bag = SHOP_ITEMS.find((item) => item.id === "project-ilaw-eco-bag");

  assert.ok(bag);
  assert.deepEqual(bag.sizes, ["One Size"]);
  assert.equal(bag.sizeLabel, "Size");
  assert.deepEqual(bag.colors, ["Maroon", "Green", "Blue"]);
  assert.equal(bag.colorLabel, "Handle colours");
  assert.match(bag.description, /Let His Light Shine, Let His Glory Rise/);
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

test("ordering remains closed everywhere", async () => {
  assert.equal(SHOP_STATUS.orderingOpen, false);
  assert.match(SHOP_STATUS.availabilityLabel, /not yet open/i);
  assert.match(SHOP_STATUS.catalogNotice, /₱499/);
  assert.match(SHOP_STATUS.catalogNotice, /not yet open/i);

  const preview = await read(
    "../../src/components/fundraising/ShopPreviewSection.tsx",
  );
  assert.match(preview, /SHOP_STATUS\.catalogNotice/);

  const page = await read("../../src/pages/ShopPage.tsx");
  assert.match(page, /Ordering is not yet open/);
  assert.doesNotMatch(page, /placeholder/i);
});

test("the planned ordering process keeps the five required steps in order", () => {
  assert.deepEqual(
    ORDER_STEPS.map((step) => step.title),
    [
      "Select merchandise",
      "Fill out order details",
      "Pay using the designated payment method",
      "Submit proof of payment",
      "Wait for payment verification",
    ],
  );
});

test("the order form preview covers the required fields and cannot submit", async () => {
  assert.deepEqual(
    ORDER_FORM_FIELDS.map((field) => field.label),
    ["Customer name", "Mobile number", "Product", "Size", "Quantity", "Notes"],
  );

  const productField = ORDER_FORM_FIELDS.find((field) => field.id === "product");
  const sizeField = ORDER_FORM_FIELDS.find((field) => field.id === "size");

  assert.deepEqual(
    productField.options,
    SHOP_ITEMS.map((item) => item.name),
  );
  assert.deepEqual(sizeField.options, [
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "2XL",
    "3XL",
    "One Size",
  ]);
  assert.match(sizeField.note, /Eco bag: One Size only/);

  const component = await read(
    "../../src/components/fundraising/OrderFormPreview.tsx",
  );
  assert.match(component, /<fieldset/);
  assert.match(component, /\bdisabled\b/);
  assert.doesNotMatch(component, /<form\b/);
  assert.doesNotMatch(component, /onSubmit/);
  assert.doesNotMatch(component, /supabase|fetch\(/);
});

test("the homepage places the shop preview directly below Project Ilaw", async () => {
  const homepage = await read("../../src/pages/HomePage.tsx");

  const ilaw = homepage.indexOf("<ProjectIlawSection />");
  const shopPreview = homepage.indexOf("<ShopPreviewSection />");
  const gallery = homepage.indexOf("<CommunityGallery />");

  assert.notEqual(ilaw, -1);
  assert.notEqual(shopPreview, -1);
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

test("the shop page states that ordering is not open and shows every step", async () => {
  const page = await read("../../src/pages/ShopPage.tsx");

  assert.match(page, /Ordering is not yet open/);
  assert.match(page, /id="how-to-order"/);
  assert.match(page, /id="order-form-preview"/);
  assert.match(page, /Payment details will be announced/);
  assert.doesNotMatch(page, /<form\b/);
});

test("hash navigation can reach the Project Ilaw section", async () => {
  const scroll = await read("../../src/components/ScrollToTop.tsx");
  assert.match(scroll, /useLocation\(\)/);
  assert.match(scroll, /location|hash/);
  assert.match(scroll, /scrollIntoView/);
  assert.match(scroll, /decodeURIComponent/);
});
