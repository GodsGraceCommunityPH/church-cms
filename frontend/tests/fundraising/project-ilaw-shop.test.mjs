import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ORDER_FORM_FIELDS,
  ORDER_STEPS,
  PROJECT_ILAW,
  SHOP_ITEMS,
  SHOP_STATUS,
} from "../../src/features/fundraising/projectIlaw.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Project Ilaw describes the lighting work without invented figures", () => {
  assert.match(PROJECT_ILAW.summary, /repairs and improvements/i);
  assert.match(PROJECT_ILAW.summary, /lighting/i);
  assert.match(PROJECT_ILAW.summary, /new lighting designs/i);
  assert.equal(PROJECT_ILAW.goals.length, 2);

  const content = JSON.stringify({ PROJECT_ILAW, SHOP_ITEMS, SHOP_STATUS });
  assert.doesNotMatch(content, /₱|\bPHP\b/);
  assert.doesNotMatch(content, /GCash|GCash number|account number/i);
  assert.doesNotMatch(content, /\b\d{2,3}%/);
});

test("merchandise is clearly marked as a placeholder preview", () => {
  assert.equal(SHOP_STATUS.orderingOpen, false);
  assert.match(SHOP_STATUS.priceLabel, /to be announced/i);
  assert.match(SHOP_STATUS.placeholderNotice, /not yet confirmed/i);
  assert.equal(SHOP_ITEMS.length, 3);

  for (const item of SHOP_ITEMS) {
    assert.ok(item.name);
    assert.ok(item.description);
    assert.ok(!("price" in item), `${item.name} must not invent a price`);
  }
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

  const component = await read("../../src/components/fundraising/OrderFormPreview.tsx");
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

  const section = await read("../../src/components/fundraising/ProjectIlawSection.tsx");
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
