import { useState, type FormEvent } from "react";
import Modal from "../Modal";
import {
  CUSTOMER_FULFILLMENT_STATUS_LABELS,
  CUSTOMER_PAYMENT_STATUS_LABELS,
  ORDER_FULFILMENT,
  PAYMENT_QR,
  formatPeso,
  type ProjectIlawPaymentContext,
} from "../../features/fundraising/projectIlaw";
import {
  getProjectIlawPaymentContext,
  getProjectIlawPaymentContextsByCustomer,
  submitProjectIlawPayment,
  uploadProjectIlawPaymentEvidence,
} from "../../features/fundraising/orderService";

const ACCEPTED_EVIDENCE = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

export default function PaymentPanel() {
  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [matches, setMatches] = useState<
    import("../../features/fundraising/projectIlaw").ProjectIlawCustomerOrderMatch[]
  >([]);
  const [context, setContext] = useState<ProjectIlawPaymentContext | null>(
    null,
  );
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  const [paymentReference, setPaymentReference] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [qrOpen, setQrOpen] = useState(false);

  async function lookup(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (lookupLoading) return;
    setLookupLoading(true);
    setLookupError("");
    setSubmitError("");
    setNotice("");
    setContext(null);
    setMatches([]);
    try {
      const found = await getProjectIlawPaymentContextsByCustomer(
        customerName,
        mobile,
      );
      setMatches(found);
      if (found.length === 0) {
        setLookupError(
          "No orders found matching those details. Check your name and mobile number and try again.",
        );
      } else if (found.length === 1) {
        await openOrder(found[0].reference);
      }
    } catch {
      setMatches([]);
      setContext(null);
      setLookupError(
        "We could not look up your order right now. Please try again later.",
      );
    } finally {
      setLookupLoading(false);
    }
  }

  async function openOrder(orderReference: string) {
    setLookupLoading(true);
    setLookupError("");
    setSubmitError("");
    setNotice("");
    try {
      const next = await getProjectIlawPaymentContext(orderReference, mobile);
      setContext(next);
      setPaymentReference(next.paymentReference);
      setEvidence(null);
      setMatches([]);
    } catch {
      setContext(null);
      setLookupError(
        "We could not open that order. Please try again.",
      );
    } finally {
      setLookupLoading(false);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || submitting) return;

    const cleanReference = paymentReference.trim();
    if (cleanReference.length < 4) {
      setSubmitError(
        "Enter the transaction reference shown on your payment receipt.",
      );
      return;
    }
    if (!evidence) {
      setSubmitError("Upload a screenshot or PDF of your payment.");
      return;
    }
    if (evidence.size > MAX_EVIDENCE_BYTES) {
      setSubmitError("The payment evidence must be 5 MB or smaller.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setNotice("");
    try {
      const path = await uploadProjectIlawPaymentEvidence(
        context.orderId,
        context.paymentToken,
        evidence,
      );
      await submitProjectIlawPayment({
        reference: context.reference,
        mobile,
        paymentToken: context.paymentToken,
        paymentReference: cleanReference,
        evidencePath: path,
      });
      const refreshed = await getProjectIlawPaymentContext(context.reference, mobile);
      setContext(refreshed);
      setPaymentReference(refreshed.paymentReference);
      setEvidence(null);
      setNotice(
        "Payment submitted. The Project Ilaw team will verify the transaction and confirm your payment.",
      );
    } catch {
      setSubmitError(
        "We could not submit your payment details. Check the file and try again. Nothing was marked paid automatically.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const instructions = context?.instructions;
  const cancelled = context?.fulfillmentStatus === "cancelled";
  const canSubmitPayment =
    context?.paymentStatus === "awaiting_payment" &&
    !cancelled &&
    instructions?.enabled === true;

  return (
    <div className="payment-panel" id="pay-order">
      <div className="payment-panel-heading">
        <h3>Pay for your order</h3>
        <p>
          Enter the name and mobile number you used when you submitted the
          order. You do not need your order reference.
        </p>
      </div>

      <form className="payment-lookup" onSubmit={lookup}>
        <div className="order-field">
          <label htmlFor="payment-name">Your name</label>
          <input
            id="payment-name"
            value={customerName}
            autoComplete="name"
            placeholder="Name used when ordering"
            onChange={(event) => setCustomerName(event.target.value)}
            required
          />
        </div>
        <div className="order-field">
          <label htmlFor="payment-mobile">Mobile number</label>
          <input
            id="payment-mobile"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={mobile}
            placeholder="09XX XXX XXXX"
            onChange={(event) => setMobile(event.target.value)}
            required
          />
        </div>
        <button type="submit" className="ilaw-secondary" disabled={lookupLoading}>
          {lookupLoading ? "Looking up..." : "Find my order"}
        </button>
      </form>

      {matches.length > 1 && (
        <div className="payment-matches" role="list">
          <p className="payment-note">
            We found several orders with those details. Choose the one you want
            to pay.
          </p>
          <ul className="payment-match-list">
            {matches.map((match) => (
              <li key={match.reference} className="payment-match">
                <div>
                  <strong>{match.reference}</strong>
                  <span>
                    {formatPeso(match.totalAmount)} ·{" "}
                    {CUSTOMER_PAYMENT_STATUS_LABELS[match.paymentStatus]} ·{" "}
                    {CUSTOMER_FULFILLMENT_STATUS_LABELS[match.fulfillmentStatus]}
                  </span>
                </div>
                <button
                  type="button"
                  className="ilaw-secondary"
                  onClick={() => openOrder(match.reference)}
                  disabled={lookupLoading}
                >
                  View / pay
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lookupError && (
        <p className="order-form-error" role="alert">
          {lookupError}
        </p>
      )}

      {context && (
        <div className="payment-order">
          <div className="payment-order-summary">
            <div>
              <span>Order reference</span>
              <strong>{context.reference}</strong>
            </div>
            <div>
              <span>Name</span>
              <strong>{context.customerName}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatPeso(context.totalAmount)}</strong>
            </div>
            <div>
              <span>Payment status</span>
              <strong>
                {CUSTOMER_PAYMENT_STATUS_LABELS[context.paymentStatus]}
              </strong>
            </div>
            <div>
              <span>{ORDER_FULFILMENT.label}</span>
              <strong>
                {CUSTOMER_FULFILLMENT_STATUS_LABELS[context.fulfillmentStatus]}
              </strong>
            </div>
          </div>

          {notice && (
            <p className="payment-success" role="status">
              {notice}
            </p>
          )}

          {cancelled && (
            <p className="payment-note" role="status">
              This order was cancelled. If you already paid, please contact the
              church office with your order reference.
            </p>
          )}

          {!cancelled && context.paymentStatus === "paid" && (
            <p className="payment-success" role="status">
              Payment confirmed. Thank you for supporting Project Ilaw!
            </p>
          )}

          {!cancelled && context.paymentStatus === "payment_verification" && (
            <div className="payment-note" role="status">
              <strong>Payment awaiting verification.</strong>
              <p>
                We received transaction reference{" "}
                <strong>{context.paymentReference}</strong>. The team will
                verify the actual transaction before marking the order paid.
              </p>
            </div>
          )}

          {!cancelled && context.paymentStatus === "awaiting_payment" && (
            <>
              {context.paymentRejectedAt && (
                <div className="payment-note payment-note-warning" role="alert">
                  <strong>Previous payment submission was not verified.</strong>
                  {context.paymentRejectionReason && (
                    <p>{context.paymentRejectionReason}</p>
                  )}
                  <p>Please check your details and submit again.</p>
                </div>
              )}

              {instructions?.enabled ? (
                <div className="payment-instructions">
                  <h4>Pay the exact amount</h4>
                  <div className="payment-due">
                    <div>
                      <span>Amount due</span>
                      <strong>{formatPeso(context.totalAmount)}</strong>
                    </div>
                    <div>
                      <span>Order reference</span>
                      <strong>{context.reference}</strong>
                    </div>
                  </div>

                  <figure className="payment-qr">
                    <figcaption>
                      <strong>{PAYMENT_QR.label}</strong>
                      <span>{PAYMENT_QR.notice}</span>
                    </figcaption>
                    <img
                      src={PAYMENT_QR.src}
                      alt={PAYMENT_QR.alt}
                      width={657}
                      height={989}
                    />
                    <button
                      type="button"
                      className="ilaw-secondary payment-qr-enlarge"
                      onClick={() => setQrOpen(true)}
                    >
                      View larger QR
                    </button>
                  </figure>

                  <ol className="payment-steps">
                    <li>
                      Open GCash or any InstaPay-enabled banking app and scan
                      the QR code above.
                    </li>
                    <li>
                      Enter the exact amount of{" "}
                      <strong>{formatPeso(context.totalAmount)}</strong>. If the
                      app asks for a reference or note, use{" "}
                      <strong>{context.reference}</strong>.
                    </li>
                    <li>
                      Keep the receipt, then submit the transaction reference
                      and a screenshot or PDF below.
                    </li>
                    <li>
                      The Project Ilaw team checks the actual transaction and
                      confirms your payment manually. Uploading a receipt does
                      not mark the order as paid.
                    </li>
                  </ol>

                  <p className="payment-instruction-note">
                    {ORDER_FULFILMENT.method}. {ORDER_FULFILMENT.note}
                  </p>

                  {instructions.gcashAccountName && (
                    <div className="payment-instruction-row">
                      <span>GCash account name</span>
                      <strong>{instructions.gcashAccountName}</strong>
                    </div>
                  )}
                  {instructions.gcashAccountNumber && (
                    <div className="payment-instruction-row">
                      <span>GCash number</span>
                      <strong>{instructions.gcashAccountNumber}</strong>
                    </div>
                  )}
                  {instructions.bankName && (
                    <div className="payment-instruction-row">
                      <span>Bank</span>
                      <strong>{instructions.bankName}</strong>
                    </div>
                  )}
                  {instructions.bankAccountName && (
                    <div className="payment-instruction-row">
                      <span>Bank account name</span>
                      <strong>{instructions.bankAccountName}</strong>
                    </div>
                  )}
                  {instructions.bankAccountNumber && (
                    <div className="payment-instruction-row">
                      <span>Bank account number</span>
                      <strong>{instructions.bankAccountNumber}</strong>
                    </div>
                  )}
                  {instructions.paymentInstructions && (
                    <p className="payment-instruction-note">
                      {instructions.paymentInstructions}
                    </p>
                  )}
                </div>
              ) : (
                <div className="payment-note" role="status">
                  <strong>Payment collection is not open yet.</strong>
                  <p>
                    The church has not published its official payment
                    instructions. No GCash QR code is shown and payment evidence
                    cannot be submitted yet. Keep your order reference and check
                    this page again later. Do not send payment to details from
                    any other source.
                  </p>
                </div>
              )}

              {canSubmitPayment && (
                <form className="payment-submit" onSubmit={submitPayment}>
                  <h4>Submit your payment details</h4>
                  <div className="order-field">
                    <label htmlFor="payment-transaction-reference">
                      Transaction reference
                    </label>
                    <input
                      id="payment-transaction-reference"
                      value={paymentReference}
                      maxLength={120}
                      onChange={(event) =>
                        setPaymentReference(event.target.value)
                      }
                      placeholder="Reference shown on your GCash or bank receipt"
                      required
                    />
                  </div>
                  <div className="order-field">
                    <label htmlFor="payment-evidence">
                      Payment screenshot or PDF
                    </label>
                    <input
                      id="payment-evidence"
                      type="file"
                      accept={ACCEPTED_EVIDENCE}
                      onChange={(event) =>
                        setEvidence(event.target.files?.[0] ?? null)
                      }
                      required
                    />
                    <small>
                      JPEG, PNG, WebP, or PDF. Maximum 5 MB. This is supporting
                      evidence only; it never confirms payment automatically.
                    </small>
                  </div>
                  {submitError && (
                    <p className="order-form-error" role="alert">
                      {submitError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="ilaw-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Submit payment details"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}

      <Modal
        open={qrOpen}
        title={PAYMENT_QR.label}
        onClose={() => setQrOpen(false)}
      >
        <div className="payment-qr-modal">
          <img src={PAYMENT_QR.src} alt={PAYMENT_QR.alt} />
          <p>{PAYMENT_QR.notice}</p>
        </div>
      </Modal>
    </div>
  );
}
