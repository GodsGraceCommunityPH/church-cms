import {
  BadgeCheck,
  ClipboardList,
  Clock,
  Lightbulb,
  ShoppingBag,
  Upload,
  Wallet,
} from "lucide-react";
import PublicPage from "../components/PublicPage";
import MerchandiseCard from "../components/fundraising/MerchandiseCard";
import OrderFormPreview from "../components/fundraising/OrderFormPreview";
import {
  ORDER_FORM_NOTE,
  ORDER_STEPS,
  PROJECT_ILAW,
  SHOP_ITEMS,
  SHOP_STATUS,
} from "../features/fundraising/projectIlaw";
import "../features/fundraising/Fundraising.css";

const STEP_ICONS = [ShoppingBag, ClipboardList, Wallet, Upload, Clock];

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
            The shop is one way the church family can take part. Final product
            details are still being prepared, so the items shown here are
            placeholders for what is to come.
          </p>
        </div>
        <aside className="shop-status-card" aria-labelledby="shop-status-title">
          <BadgeCheck size={38} strokeWidth={1.6} aria-hidden="true" />
          <strong id="shop-status-title">Ordering is not yet open</strong>
          <p>
            Watch this page for the official launch. When ordering opens, the
            payment method and the order form will be posted here.
          </p>
        </aside>
      </section>

      <section className="public-section" id="shop-catalog" aria-labelledby="shop-catalog-title">
        <div className="public-section-heading">
          <h2 id="shop-catalog-title">Merchandise preview</h2>
          <p>
            A preview of the planned collection. Every card below is a
            placeholder while the final designs are still in development.
          </p>
        </div>
        <p className="shop-notice" role="note">{SHOP_STATUS.placeholderNotice}</p>
        <div className="merch-grid">
          {SHOP_ITEMS.map((item) => (
            <MerchandiseCard item={item} key={item.id} />
          ))}
        </div>
      </section>

      <section className="public-section" id="how-to-order" aria-labelledby="how-to-order-title">
        <div className="public-section-heading">
          <h2 id="how-to-order-title">How to Order</h2>
          <p>
            This is the planned process once ordering opens. No orders can be
            placed yet.
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
          Payment details will be announced once ordering opens. Do not send
          payment yet.
        </p>
      </section>

      <section
        className="public-section"
        id="order-form-preview"
        aria-labelledby="order-preview-title"
      >
        <div className="public-section-heading">
          <h2 id="order-preview-title">Order form preview</h2>
          <p id="order-form-preview-note">{ORDER_FORM_NOTE}</p>
        </div>
        <p className="shop-notice" role="note">{SHOP_STATUS.previewOnlyNotice}</p>
        <OrderFormPreview />
      </section>
    </PublicPage>
  );
}
