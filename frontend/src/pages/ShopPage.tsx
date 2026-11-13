import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
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
import OrderForm from "../components/fundraising/OrderForm";
import PaymentPanel from "../components/fundraising/PaymentPanel";
import {
  ORDER_STEPS,
  PROJECT_ILAW,
  SHOP_STATUS,
  type ProjectIlawPaymentSeed,
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
  const location = useLocation();
  const paymentSeed =
    (location.state as { projectIlawPayment?: ProjectIlawPaymentSeed } | null)
      ?.projectIlawPayment ?? null;

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
        id="how-to-order"
        aria-labelledby="how-to-order-title"
      >
        <div className="public-section-heading">
          <h2 id="how-to-order-title">How to Order</h2>
          <p>
            Sundin ang limang steps na ito para makapag-order at makumpleto ang
            payment mo.
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
                {step.description.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
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
          <h2 id="order-form-title">Shop and Order</h2>
          <p>
            {ordersEnabled
              ? "Choose your merchandise and options, add items to your order, then enter your details below."
              : "The merchandise is shown for preview. Ordering is currently closed."}
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
        <PaymentPanel initialOrder={paymentSeed} />
      </section>
    </PublicPage>
  );
}
