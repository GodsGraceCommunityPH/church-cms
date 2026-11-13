import { useEffect, useState } from "react";
import {
  BadgeCheck,
  ClipboardList,
  Clock,
  ShieldCheck,
  ShoppingBag,
  Upload,
  Wallet,
} from "lucide-react";
import PublicPage from "../components/PublicPage";
import MerchandiseCard from "../components/fundraising/MerchandiseCard";
import OrderForm from "../components/fundraising/OrderForm";
import PaymentPanel from "../components/fundraising/PaymentPanel";
import {
  ORDER_STEPS,
  PROJECT_ILAW,
  SHOP_ITEMS,
  SHOP_STATUS,
} from "../features/fundraising/projectIlaw";
import { getProjectIlawPublicSettings } from "../features/fundraising/orderService";
import "../features/fundraising/Fundraising.css";

const STEP_ICONS = [
  ShoppingBag,
  ClipboardList,
  Wallet,
  Upload,
  BadgeCheck,
];

export default function ShopPage() {
  const [ordersEnabled, setOrdersEnabled] = useState<boolean>(
    SHOP_STATUS.defaultOrdersEnabled,
  );

  useEffect(() => {
    let active = true;
    getProjectIlawPublicSettings()
      .then((settings) => {
        if (active) setOrdersEnabled(settings.ordersEnabled);
      })
      .catch(() => {
        // Fail closed: if the status cannot be read, keep ordering closed.
        if (active) setOrdersEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
            ₱499 each. Orders are placed here when ordering is open, then paid
            through the official payment details published on this page once
            they are available.
          </p>
        </div>
        <aside
          className={`shop-status-card${
            ordersEnabled ? "" : " shop-status-card-closed"
          }`}
          aria-labelledby="shop-status-title"
        >
          {ordersEnabled ? (
            <BadgeCheck size={38} strokeWidth={1.6} aria-hidden="true" />
          ) : (
            <Clock size={38} strokeWidth={1.6} aria-hidden="true" />
          )}
          <strong id="shop-status-title">
            {ordersEnabled ? "Ordering is open" : "Ordering is not open yet"}
          </strong>
          <p>
            {ordersEnabled ? SHOP_STATUS.openNotice : SHOP_STATUS.closedNotice}
          </p>
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
            Choose a T-shirt or an eco bag, then review your order before it is
            submitted.
          </p>
        </div>
        <p className="shop-notice" role="note">
          {ordersEnabled
            ? SHOP_STATUS.openCatalogNotice
            : SHOP_STATUS.closedCatalogNotice}
        </p>
        <div className="merch-grid">
          {SHOP_ITEMS.map((item) => (
            <MerchandiseCard
              item={item}
              key={item.id}
              ordersEnabled={ordersEnabled}
            />
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
            Orders are saved here first. Payment is completed through the
            website using the official GCash or bank details once they are
            published.
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
          <ShieldCheck size={18} aria-hidden="true" />
          Only use the payment details shown in the payment section of this
          page. Payment is never confirmed automatically, and an order reference
          alone does not expose your payment evidence.
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
            {ordersEnabled
              ? "Add every item you need, then submit once. You will receive an order reference to use in the payment section."
              : "This section opens only when the church authorizes Project Ilaw order intake."}
          </p>
        </div>
        {ordersEnabled ? (
          <OrderForm />
        ) : (
          <div className="order-closed" role="note">
            <Clock size={30} aria-hidden="true" />
            <h3>Ordering is not open yet</h3>
            <p>
              The church has not opened Project Ilaw order intake. No orders are
              being accepted, and nothing can be submitted from this page until
              ordering opens.
            </p>
            <p className="order-closed-note">
              Please check back after the church announces the opening date.
            </p>
          </div>
        )}
      </section>

      <section
        className="public-section"
        id="payment"
        aria-labelledby="payment-title"
      >
        <div className="public-section-heading">
          <h2 id="payment-title">Payment</h2>
          <p>
            Find your order with your reference and mobile number, then pay and
            submit your transaction details.
          </p>
        </div>
        <PaymentPanel />
      </section>
    </PublicPage>
  );
}
