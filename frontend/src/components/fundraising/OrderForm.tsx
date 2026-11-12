import { useRef, useState, type FormEvent } from "react";
import Modal from "../Modal";
import OrderLineItemsEditor from "./OrderLineItemsEditor";
import { createProjectIlawOrder } from "../../features/fundraising/orderService";
import {
  calculateDraftTotals,
  createDraftItem,
  createRequestId,
  formatPeso,
  getShopItem,
  validateOrderDraft,
  type CreatedProjectIlawOrder,
  type OrderDraft,
} from "../../features/fundraising/projectIlaw";

const EMPTY_DRAFT: OrderDraft = {
  customerName: "",
  mobile: "",
  notes: "",
  items: [createDraftItem()],
};

export default function OrderForm() {
  const [draft, setDraft] = useState<OrderDraft>(() => ({
    ...EMPTY_DRAFT,
    items: [createDraftItem()],
  }));
  const [errors, setErrors] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] =
    useState<CreatedProjectIlawOrder | null>(null);
  const requestIdRef = useRef(createRequestId());

  const totals = calculateDraftTotals(draft.items);

  const updateDraft = (patch: Partial<OrderDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const closeConfirmation = () => setConfirmation(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const validation = validateOrderDraft(draft);
    if (!validation.ok) {
      setErrors(validation.errors);
      setFormError("Please check the highlighted order details and try again.");
      return;
    }

    setErrors([]);
    setFormError("");
    setSubmitting(true);

    try {
      const created = await createProjectIlawOrder({
        requestId: requestIdRef.current,
        customerName: validation.customerName,
        mobile: validation.mobile,
        notes: validation.notes,
        items: validation.items,
      });

      setConfirmation(created);
      setDraft({ ...EMPTY_DRAFT, items: [createDraftItem()] });
      requestIdRef.current = createRequestId();
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message)
          : "";
      if (/not open/i.test(message)) {
        setFormError(
          "Project Ilaw ordering is not open yet. Your order was not saved.",
        );
      } else {
        setFormError(
          "We could not save your order. Please check your connection and try again. Nothing was charged, and retrying will not create a duplicate order.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form className="order-form" onSubmit={handleSubmit} noValidate>
        <div className="order-form-section">
          <div className="order-form-section-heading">
            <h3>Your details</h3>
            <p>We only use these to prepare and coordinate your order.</p>
          </div>
          <div className="order-form-grid">
            <div className="order-field">
              <label htmlFor="order-customer-name">Customer name</label>
              <input
                id="order-customer-name"
                type="text"
                autoComplete="name"
                maxLength={120}
                required
                value={draft.customerName}
                onChange={(event) =>
                  updateDraft({ customerName: event.target.value })
                }
              />
            </div>
            <div className="order-field">
              <label htmlFor="order-mobile">Mobile number</label>
              <input
                id="order-mobile"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={32}
                required
                placeholder="09XX XXX XXXX"
                value={draft.mobile}
                onChange={(event) => updateDraft({ mobile: event.target.value })}
              />
            </div>
            <div className="order-field order-field-wide">
              <label htmlFor="order-notes">Order notes (optional)</label>
              <textarea
                id="order-notes"
                rows={3}
                maxLength={1000}
                placeholder="Anything we should know about your order?"
                value={draft.notes}
                onChange={(event) => updateDraft({ notes: event.target.value })}
              />
            </div>
          </div>
        </div>

        <OrderLineItemsEditor
          idPrefix="public-order"
          items={draft.items}
          onChange={(items) => updateDraft({ items })}
          disabled={submitting}
        />

        <div className="order-summary" aria-labelledby="order-summary-title">
          <h3 id="order-summary-title">Order summary</h3>
          <div className="order-summary-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Colour</th>
                  <th scope="col">Size</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Unit price</th>
                  <th scope="col">Line total</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((item) => {
                  const product = getShopItem(item.productId);
                  const quantity = Number(item.quantity);
                  const validQuantity =
                    Number.isInteger(quantity) && quantity > 0;
                  return (
                    <tr key={item.key}>
                      <td>{product?.name ?? "—"}</td>
                      <td>{item.color || "—"}</td>
                      <td>
                        {product
                          ? product.id === "project-ilaw-eco-bag"
                            ? "—"
                            : item.size || "—"
                          : "—"}
                      </td>
                      <td>{validQuantity ? quantity : "—"}</td>
                      <td>{formatPeso(product?.price ?? 499)}</td>
                      <td>
                        {validQuantity
                          ? formatPeso((product?.price ?? 499) * quantity)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="order-summary-totals">
            <div>
              <span>Total quantity</span>
              <strong>{totals.totalQuantity}</strong>
            </div>
            <div>
              <span>Order total</span>
              <strong>{formatPeso(totals.totalAmount)}</strong>
            </div>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="order-form-errors" role="alert">
            <strong>Please fix the following:</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {formError && (
          <p className="order-form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="order-form-submit">
          <p>
            Your order is saved with a reference number. Keep it so you can
            return to the payment section and submit your transaction details.
          </p>
          <button type="submit" className="ilaw-primary" disabled={submitting}>
            {submitting ? "Saving order..." : "Submit order"}
          </button>
        </div>
      </form>

      <Modal
        open={Boolean(confirmation)}
        title="Orders Received!"
        onClose={closeConfirmation}
      >
        {confirmation && (
          <div className="order-confirmation">
            <p>Thank you for supporting Project Ilaw!</p>
            <p>
              Your order has been saved. To pay, open the payment section and
              enter this reference with the mobile number you used.
            </p>
            <div className="order-confirmation-reference">
              <span>Order reference</span>
              <strong>{confirmation.reference}</strong>
              <span>Order total</span>
              <strong>{formatPeso(confirmation.totalAmount)}</strong>
            </div>
            <div className="order-confirmation-actions">
              <button
                type="button"
                className="ilaw-primary"
                onClick={() => {
                  closeConfirmation();
                  window.setTimeout(() => {
                    document
                      .getElementById("pay-order")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 0);
                }}
              >
                Go to payment
              </button>
              <button
                type="button"
                className="ilaw-secondary"
                onClick={closeConfirmation}
              >
                Close
              </button>
            </div>
            <p className="order-confirmation-hint">
              Payment instructions appear once the church has configured the
              official GCash or bank account details.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
