import {
  BadgeCheck,
  ClipboardList,
  Lightbulb,
  MessageCircle,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import PublicPage from "../components/PublicPage";
import MerchandiseCard from "../components/fundraising/MerchandiseCard";
import OrderForm from "../components/fundraising/OrderForm";
import {
  ORDER_STEPS,
  PROJECT_ILAW,
  SHOP_ITEMS,
  SHOP_STATUS,
} from "../features/fundraising/projectIlaw";
import "../features/fundraising/Fundraising.css";

const STEP_ICONS = [
  ShoppingBag,
  ClipboardList,
  MessageCircle,
  Wallet,
  BadgeCheck,
];

export default function ShopPage() {
  return (
    <PublicPage
      eyebrow="Project Ilaw"
      title="Project Ilaw Shop"
      description="Merchandise in support of repairs and improvements to our church lighting and the development of new lighting designs."
    >
      <section className="shop-intro" aria-labelledby="shop-intro-title">
        <div className="public-card shop-intro-copy">
          <p className="ilaw-eyebrow">The fundraising</p>
          <h2 id="shop-intro-title">Light for our church home</h2>
          <p>{PROJECT_ILAW.summary}</p>
          <p>
            The shop is one way the church family can take part. Both items are
            ₱499 each. Place your order here, then contact Bryan Castro on
            Facebook Messenger for payment instructions.
          </p>
        </div>
        <aside className="shop-status-card" aria-labelledby="shop-status-title">
          <BadgeCheck size={38} strokeWidth={1.6} aria-hidden="true" />
          <strong id="shop-status-title">Ordering is open</strong>
          <p>{SHOP_STATUS.notice}</p>
        </aside>
      </section>

      <section
        className="public-section"
        id="shop-catalog"
        aria-labelledby="shop-catalog-title"
      >
        <div className="public-section-heading">
          <h2 id="shop-catalog-title">Merchandise</h2>
          <p>
            Two ways to support Project Ilaw. Choose a T-shirt or an eco bag.
          </p>
        </div>
        <p className="shop-notice" role="note">
          {SHOP_STATUS.catalogNotice}
        </p>
        <div className="merch-grid">
          {SHOP_ITEMS.map((item) => (
            <MerchandiseCard item={item} key={item.id} />
          ))}
        </div>
      </section>

      <section
        className="public-section"
        id="how-to-order"
        aria-labelledby="how-to-order-title"
      >
        <div className="public-section-heading">
          <h2 id="how-to-order-title">How to Order</h2>
          <p>
            Orders are saved here first. Payment is coordinated manually so no
            payment details are posted publicly.
          </p>
        </div>
        <ol className="shop-order-steps">
          {ORDER_STEPS.map((step, index) => {
            const StepIcon = STEP_ICONS[index] ?? ClipboardList;
            return (
              <li className="shop-order-step" key={step.title}>
                <span className="shop-step-icon" aria-hidden="true">
                  <StepIcon size={22} />
                </span>
                <span className="shop-step-number" aria-hidden="true">
                  Step {index + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            );
          })}
        </ol>
        <p className="shop-payment-note">
          <Lightbulb size={18} aria-hidden="true" />
          Do not send payment before Bryan gives you instructions on Messenger.
          The church does not publish GCash or bank account details on this page.
        </p>
      </section>

      <section
        className="public-section"
        id="order-form"
        aria-labelledby="order-form-title"
      >
        <div className="public-section-heading">
          <h2 id="order-form-title">Place your order</h2>
          <p>
            Add every item you need, then submit once. You will receive an order
            reference to share with Bryan on Messenger.
          </p>
        </div>
        <OrderForm />
      </section>
    </PublicPage>
  );
}
