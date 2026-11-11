import { useState, type FormEvent } from "react";
import {
  PAYMENT_STATUS_LABELS,
  formatPeso,
  type ProjectIlawPaymentContext,
} from "../../features/fundraising/projectIlaw";
import {
  getProjectIlawPaymentContext,
  submitProjectIlawPayment,
  uploadProjectIlawPaymentEvidence,
} from "../../features/fundraising/orderService";

const ACCEPTED_EVIDENCE = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

export default function PaymentPanel() {
  const [reference, setReference] = useState("");
  const [mobile, setMobile] = useState("");
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

  async function lookup(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (lookupLoading) return;
    setLookupLoading(true);
    setLookupError("");
    setSubmitError("");
    setNotice("");
    try {
      const next = await getProjectIlawPaymentContext(reference, mobile);
      setContext(next);
      setPaymentReference(next.paymentReference);
      setEvidence(null);
    } catch {
      setContext(null);
      setLookupError(
        "We could not find an order with that reference and mobile number. Check both and try again.",
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
      const refreshed = await getProjectIlawPaymentContext(reference, mobile);
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
          Enter the order reference and the mobile number you used when you
          submitted the order.
        </p>
      </div>

      <form className="payment-lookup" onSubmit={lookup}>
        <div className="order-field">
          <label htmlFor="payment-reference">Order reference</label>
          <input
            id="payment-reference"
            value={reference}
            autoComplete="off"
            placeholder="PI-YYYYMMDD-NNNNNN"
            onChange={(event) => setReference(event.target.value)}
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
              <strong>{PAYMENT_STATUS_LABELS[context.paymentStatus]}</strong>
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
                  <h4>Official payment details</h4>
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
                  <p className="payment-instruction-note">
                    Pay the exact order total ({formatPeso(context.totalAmount)})
                    and keep your receipt. After paying, submit the transaction
                    reference and a screenshot below.
                  </p>
                </div>
              ) : (
                <div className="payment-note" role="status">
                  <strong>Payment instructions are not available yet.</strong>
                  <p>
                    The church has not published the official GCash or bank
                    account details. Keep your order reference and check this
                    page again later. Do not send payment to details from any
                    other source.
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
    </div>
  );
}
