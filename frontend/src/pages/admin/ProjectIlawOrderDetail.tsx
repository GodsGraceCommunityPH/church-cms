import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  FileImage,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import OrderLineItemsEditor from "../../components/fundraising/OrderLineItemsEditor";
import { useAuth } from "../../features/auth/auth";
import { supabase } from "../../lib/supabase";
import {
  FULFILLMENT_STATUS_LABELS,
  FULFILLMENT_TRANSITIONS,
  PAYMENT_STATUS_LABELS,
  canCancelOrder,
  createDraftItem,
  formatPeso,
  validateOrderDraft,
  type FulfillmentStatus,
  type OrderDraft,
  type OrderDraftItem,
  type ProjectIlawOrder,
  type ProjectIlawOrderEvent,
} from "../../features/fundraising/projectIlaw";
import { formatOrderDateTime } from "../../features/fundraising/orderAccounting";
import {
  amendProjectIlawOrder,
  confirmProjectIlawPayment,
  getPaymentEvidenceUrl,
  getProjectIlawOrder,
  getProjectIlawOrderActivity,
  getProjectIlawPaymentContext,
  getProjectIlawPublicSettings,
  recordProjectIlawCashPayment,
  rejectProjectIlawPayment,
  submitProjectIlawPayment,
  updateProjectIlawFulfillment,
  uploadProjectIlawPaymentEvidence,
} from "../../features/fundraising/orderService";
import {
  canRetryStaffGcashPayment,
  staffPaymentErrorMessage,
} from "../../features/fundraising/staffOrder";
import "./ProjectIlawOrders.css";

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const EVIDENCE_TYPES = "image/jpeg,image/png,image/webp,application/pdf";

const EVENT_LABELS: Record<ProjectIlawOrderEvent["eventType"], string> = {
  order_created: "Order received",
  payment_submitted: "Payment submitted",
  payment_confirmed: "Payment confirmed",
  payment_rejected: "Payment submission rejected",
  fulfillment_changed: "Fulfillment updated",
  order_amended: "Order amended",
  order_cancelled: "Order cancelled",
};

function draftFromOrder(order: ProjectIlawOrder): OrderDraft {
  const items: OrderDraftItem[] = order.items.map((item) => ({
    ...createDraftItem(item.productId),
    size: item.size,
    color: item.color,
    quantity: item.quantity,
  }));

  return {
    customerName: order.customerName,
    mobile: order.mobile,
    notes: order.notes,
    items: items.length ? items : [createDraftItem()],
  };
}

function statusChange(event: ProjectIlawOrderEvent) {
  const previous = event.previousValue as
    | { fulfillment_status?: string; payment_status?: string }
    | null;
  const next = event.newValue as
    | { fulfillment_status?: string; payment_status?: string }
    | null;
  const labels = {
    ...PAYMENT_STATUS_LABELS,
    ...FULFILLMENT_STATUS_LABELS,
  } as Record<string, string>;

  if (previous?.fulfillment_status && next?.fulfillment_status) {
    return `${labels[previous.fulfillment_status] ?? previous.fulfillment_status} → ${
      labels[next.fulfillment_status] ?? next.fulfillment_status
    }`;
  }
  if (previous?.payment_status && next?.payment_status) {
    return `${labels[previous.payment_status] ?? previous.payment_status} → ${
      labels[next.payment_status] ?? next.payment_status
    }`;
  }
  return "";
}

export default function ProjectIlawOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const canConfirmPayment = hasPermission(
    "project_ilaw.orders.confirm_payment",
  );
  const canManage = hasPermission("project_ilaw.orders.manage");

  const [order, setOrder] = useState<ProjectIlawOrder | null>(null);
  const [activity, setActivity] = useState<ProjectIlawOrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState("");

  const [paymentNote, setPaymentNote] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [cashNote, setCashNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [showAmend, setShowAmend] = useState(false);
  const [amendDraft, setAmendDraft] = useState<OrderDraft | null>(null);
  const [amendNote, setAmendNote] = useState("");
  const [amendErrors, setAmendErrors] = useState<string[]>([]);

  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceError, setEvidenceError] = useState("");

  // Staff GCash retry: a failed receipt upload leaves the order Awaiting
  // Payment, so staff must be able to finish it without creating a new order.
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null);
  const [gcashReference, setGcashReference] = useState("");
  const [gcashEvidence, setGcashEvidence] = useState<File | null>(null);
  const [gcashError, setGcashError] = useState("");
  const gcashEvidenceInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    try {
      const [nextOrder, nextActivity] = await Promise.all([
        getProjectIlawOrder(id),
        getProjectIlawOrderActivity(id),
      ]);
      setOrder(nextOrder);
      setActivity(nextActivity);
      setAmendDraft((current) => current ?? draftFromOrder(nextOrder));
    } catch {
      setLoadError(
        "This Project Ilaw order could not be loaded. It may no longer exist, or your access may have changed.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime refreshes a single staff order after an authorised payment
  // confirmation so the detail view reflects the latest status without a manual
  // browser refresh. RLS still governs which rows may be received.
  const orderId = order?.id;
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`project-ilaw-order:${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_ilaw_orders",
          filter: `id=eq.${orderId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, load]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const settings = await getProjectIlawPublicSettings();
        if (active) setPaymentsEnabled(settings.paymentsEnabled);
      } catch {
        if (active) setPaymentsEnabled(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const evidencePath = order?.paymentEvidencePath ?? "";
  const canViewEvidence = canConfirmPayment;

  useEffect(() => {
    let active = true;
    setEvidenceUrl("");
    setEvidenceError("");
    if (!evidencePath || !canViewEvidence) return;

    void (async () => {
      try {
        const url = await getPaymentEvidenceUrl(evidencePath);
        if (active) setEvidenceUrl(url);
      } catch {
        if (active) {
          setEvidenceError(
            "Payment evidence could not be opened. Your access may have changed.",
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [canViewEvidence, evidencePath]);

  const nextStatuses = useMemo(() => {
    if (!order || !canManage) return [] as FulfillmentStatus[];
    return FULFILLMENT_TRANSITIONS[order.fulfillmentStatus];
  }, [canManage, order]);

  async function runAction(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setActionError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setActionError(
        (error as { message?: string } | null)?.message ||
          (error instanceof Error
            ? error.message
            : "That change could not be saved. Refresh the order and try again."),
      );
    } finally {
      setBusy("");
    }
  }

  async function handleConfirmPayment() {
    if (!order) return;
    await runAction("confirm", async () => {
      await confirmProjectIlawPayment(order.id, paymentNote);
      setPaymentNote("");
      setNotice(
        "Payment confirmed. Only now does this order count toward production quantities.",
      );
      await load();
    });
  }

  async function handleRecordCashPayment() {
    if (!order) return;
    const amount = Number(cashAmount);
    if (!cashConfirmed) {
      setActionError(
        "Confirm that you physically received the cash before recording it.",
      );
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError("Enter the amount received.");
      return;
    }
    if (amount !== order.totalAmount) {
      setActionError("The amount received must match the order total.");
      return;
    }
    if (
      !window.confirm(
        "Record this order as paid in cash? This cannot be undone.",
      )
    ) {
      return;
    }
    await runAction("cash", async () => {
      await recordProjectIlawCashPayment(
        order.id,
        amount,
        cashNote,
        cashConfirmed,
      );
      setCashAmount("");
      setCashConfirmed(false);
      setCashNote("");
      setNotice("Cash payment recorded. The order is now paid.");
      await load();
    });
  }

  async function handleRecordGcashReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || busy) return;
    const reference = gcashReference.trim();
    if (reference.length < 4) {
      setGcashError(
        "Enter the transaction reference shown on the buyer's receipt.",
      );
      return;
    }
    if (!gcashEvidence) {
      setGcashError("Attach the buyer's GCash receipt screenshot or PDF.");
      return;
    }
    if (gcashEvidence.size > MAX_EVIDENCE_BYTES) {
      setGcashError("The GCash receipt must be 5 MB or smaller.");
      return;
    }

    setGcashError("");
    await runAction("gcash-retry", async () => {
      try {
        // Reuse the same customer payment RPC and token the public flow uses.
        // It validates the reference, mobile number, token, and evidence path,
        // and it never marks the order paid.
        const context = await getProjectIlawPaymentContext(
          order.reference,
          order.mobile,
        );
        const evidencePath = await uploadProjectIlawPaymentEvidence(
          order.id,
          context.paymentToken,
          gcashEvidence,
        );
        await submitProjectIlawPayment({
          reference: order.reference,
          mobile: order.mobile,
          paymentToken: context.paymentToken,
          paymentReference: reference,
          evidencePath,
        });
      } catch (error) {
        const message =
          (error as { message?: string } | null)?.message ||
          "The GCash receipt could not be recorded.";
        throw new Error(staffPaymentErrorMessage(message, "gcash"));
      }
      setGcashReference("");
      setGcashEvidence(null);
      if (gcashEvidenceInputRef.current) {
        gcashEvidenceInputRef.current.value = "";
      }
      setNotice(
        "GCash receipt recorded. The order is now in Payment Verification and still needs manual confirmation.",
      );
      await load();
    });
  }

  async function handleRejectPayment() {
    if (!order) return;
    const reason = rejectReason.trim();
    if (reason.length < 5) {
      setActionError(
        "Enter a rejection reason of at least 5 characters so the customer knows what to fix.",
      );
      return;
    }
    if (
      !window.confirm(
        "Reject this payment submission? The order returns to Awaiting Payment so the customer can submit again.",
      )
    ) {
      return;
    }
    await runAction("reject", async () => {
      await rejectProjectIlawPayment(order.id, reason);
      setRejectReason("");
      setNotice(
        "Payment submission rejected. The order is back to Awaiting Payment and the history is preserved.",
      );
      await load();
    });
  }

  async function handleStatusChange(status: FulfillmentStatus) {
    if (!order) return;
    if (
      status === "cancelled" &&
      !window.confirm(
        "Cancel this order? The order and its payment record stay in the history and are not deleted.",
      )
    ) {
      return;
    }
    await runAction(`status-${status}`, async () => {
      await updateProjectIlawFulfillment(order.id, status, statusNote);
      setStatusNote("");
      setNotice(
        status === "cancelled"
          ? "Order cancelled. Its history and payment record are preserved."
          : `Fulfillment status changed to ${FULFILLMENT_STATUS_LABELS[status]}.`,
      );
      await load();
    });
  }

  async function handleAmend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || !amendDraft) return;

    const validation = validateOrderDraft(amendDraft);
    if (!validation.ok) {
      setAmendErrors(validation.errors);
      return;
    }

    setAmendErrors([]);
    await runAction("amend", async () => {
      await amendProjectIlawOrder(order.id, {
        customerName: validation.customerName,
        mobile: validation.mobile,
        notes: validation.notes,
        items: validation.items,
        note: amendNote,
      });
      setAmendNote("");
      setShowAmend(false);
      setNotice("Order amended. The previous line items remain in the history.");
      setAmendDraft(null);
      await load();
    });
  }

  if (loading && !order) {
    return (
      <div className="pilaw-order-detail-page">
        <p className="pilaw-state">Loading Project Ilaw order...</p>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="pilaw-order-detail-page">
        <div className="pilaw-error" role="alert">
          <span>{loadError || "Order not found."}</span>
          <button type="button" onClick={() => void load()}>
            Try again
          </button>
        </div>
        <Link className="pilaw-detail-back" to="/admin/project-ilaw-orders">
          <ArrowLeft size={15} aria-hidden="true" /> Back to Project Ilaw Orders
        </Link>
      </div>
    );
  }

  const cancelled = order.fulfillmentStatus === "cancelled";
  const amendable =
    canManage &&
    order.fulfillmentStatus !== "completed" &&
    order.fulfillmentStatus !== "cancelled";
  const paid = order.paymentStatus === "paid";
  const awaitingVerification = order.paymentStatus === "payment_verification";
  const gcashRetryAvailable = canRetryStaffGcashPayment(
    order,
    paymentsEnabled,
  );
  const gcashRetryHint =
    paymentsEnabled === false
      ? "Payment collection is currently closed. GCash receipts cannot be recorded until an authorised staff member enables payments."
      : paymentsEnabled === null
        ? "Checking whether payment collection is open..."
        : !order.mobile.trim()
          ? "This order has no mobile number, so the GCash receipt cannot be matched to it. Update the order details before recording the receipt."
          : "";

  return (
    <div className="pilaw-order-detail-page">
      <div>
        <Link className="pilaw-detail-back" to="/admin/project-ilaw-orders">
          <ArrowLeft size={15} aria-hidden="true" /> Back to Project Ilaw Orders
        </Link>
        <header className="pilaw-order-detail-header">
          <div>
            <p className="pilaw-eyebrow">Order reference</p>
            <h1>{order.reference}</h1>
            <p>
              Received {formatOrderDateTime(order.createdAt)} · Last updated{" "}
              {formatOrderDateTime(order.updatedAt)}
            </p>
            <p>
              Order source:{" "}
              {order.source === "staff" ? "Staff-assisted" : "Online customer"}
            </p>
          </div>
          <div className="pilaw-orders-actions">
            <Button
              variant="secondary"
              onClick={() => void load()}
              disabled={loading || Boolean(busy)}
            >
              <RefreshCcw size={16} aria-hidden="true" /> Refresh
            </Button>
          </div>
        </header>
        <div className="pilaw-detail-statuses" style={{ marginTop: 12 }}>
          <span className={`pilaw-status pilaw-status-${order.paymentStatus}`}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </span>
          <span
            className={`pilaw-status pilaw-status-${order.fulfillmentStatus}`}
          >
            {FULFILLMENT_STATUS_LABELS[order.fulfillmentStatus]}
          </span>
        </div>
      </div>

      {notice && (
        <p className="pilaw-success" role="status">
          {notice}
        </p>
      )}
      {actionError && (
        <p className="pilaw-error" role="alert">
          {actionError}
        </p>
      )}

      <div className="pilaw-detail-grid">
        <section className="pilaw-detail-card" aria-labelledby="order-lines">
          <h2 id="order-lines">Order items</h2>
          <div className="pilaw-detail-items">
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
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productName}</td>
                    <td>{item.color}</td>
                    <td>
                      {item.productType === "eco_bag" ? "—" : item.size}
                    </td>
                    <td>{item.quantity}</td>
                    <td>{formatPeso(item.unitPrice)}</td>
                    <td>{formatPeso(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pilaw-detail-total">
            <span>
              {order.totalQuantity} total item
              {order.totalQuantity === 1 ? "" : "s"}
            </span>
            <strong>{formatPeso(order.totalAmount)}</strong>
          </div>

          <h2 style={{ marginTop: 24 }}>Customer</h2>
          <dl className="pilaw-detail-meta">
            <div>
              <dt>Name</dt>
              <dd>{order.customerName}</dd>
            </div>
            <div>
              <dt>Mobile number</dt>
              <dd>{order.mobile}</dd>
            </div>
          </dl>
          {order.notes && <p className="pilaw-detail-notes">{order.notes}</p>}

          {paid && (
            <div className="pilaw-detail-notes">
              <strong>Payment confirmed</strong>
              <br />
              {formatOrderDateTime(order.paymentConfirmedAt)}
              {order.paymentNote ? ` · ${order.paymentNote}` : ""}
            </div>
          )}

          {cancelled && (
            <div className="pilaw-detail-notes">
              <strong>Cancelled</strong>
              <br />
              {formatOrderDateTime(order.cancelledAt)}
              {order.cancelReason ? ` · ${order.cancelReason}` : ""}
              {paid && (
                <p className="pilaw-detail-note">
                  This order was already paid before it was cancelled. It stays
                  in confirmed collections and is not treated as a refund here.
                </p>
              )}
            </div>
          )}

          {amendable && (
            <div className="pilaw-detail-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAmend((current) => !current);
                  setAmendDraft(draftFromOrder(order));
                  setAmendErrors([]);
                }}
                disabled={Boolean(busy)}
              >
                {showAmend ? "Cancel amendment" : "Amend order"}
              </Button>
            </div>
          )}

          {showAmend && amendDraft && (
            <form className="pilaw-amend-form" onSubmit={handleAmend}>
              <div className="order-form-grid">
                <div className="order-field">
                  <label htmlFor="amend-customer-name">Customer name</label>
                  <Input
                    id="amend-customer-name"
                    value={amendDraft.customerName}
                    maxLength={120}
                    onChange={(event) =>
                      setAmendDraft({
                        ...amendDraft,
                        customerName: event.target.value,
                      })
                    }
                    disabled={Boolean(busy)}
                  />
                </div>
                <div className="order-field">
                  <label htmlFor="amend-mobile">Mobile number</label>
                  <Input
                    id="amend-mobile"
                    type="tel"
                    value={amendDraft.mobile}
                    maxLength={32}
                    onChange={(event) =>
                      setAmendDraft({
                        ...amendDraft,
                        mobile: event.target.value,
                      })
                    }
                    disabled={Boolean(busy)}
                  />
                </div>
                <div className="order-field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="amend-notes">Order notes</label>
                  <textarea
                    id="amend-notes"
                    rows={3}
                    maxLength={1000}
                    value={amendDraft.notes}
                    onChange={(event) =>
                      setAmendDraft({
                        ...amendDraft,
                        notes: event.target.value,
                      })
                    }
                    disabled={Boolean(busy)}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      font: "inherit",
                      padding: "11px 13px",
                      width: "100%",
                    }}
                  />
                </div>
              </div>

              <OrderLineItemsEditor
                idPrefix="amend-order"
                items={amendDraft.items}
                onChange={(items) => setAmendDraft({ ...amendDraft, items })}
                disabled={Boolean(busy)}
              />

              <label>
                Amendment note
                <Input
                  value={amendNote}
                  maxLength={1000}
                  onChange={(event) => setAmendNote(event.target.value)}
                  placeholder="Why is this order being changed?"
                  disabled={Boolean(busy)}
                />
              </label>

              {amendErrors.length > 0 && (
                <div className="order-form-errors" role="alert">
                  <strong>Please fix the following:</strong>
                  <ul>
                    {amendErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pilaw-amend-actions">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowAmend(false)}
                  disabled={Boolean(busy)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={Boolean(busy)}>
                  {busy === "amend" ? "Saving..." : "Save amendment"}
                </Button>
              </div>
            </form>
          )}
        </section>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {!cancelled && (
            <section
              className="pilaw-detail-card"
              aria-labelledby="payment-review-title"
            >
              <h2 id="payment-review-title">Payment</h2>

              <dl className="pilaw-detail-meta">
                <div>
                  <dt>Payment status</dt>
                  <dd>{PAYMENT_STATUS_LABELS[order.paymentStatus]}</dd>
                </div>
                <div>
                  <dt>Amount due</dt>
                  <dd>{formatPeso(order.totalAmount)}</dd>
                </div>
                <div>
                  <dt>Transaction reference</dt>
                  <dd>{order.paymentReference || "Not submitted"}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{formatOrderDateTime(order.paymentSubmittedAt)}</dd>
                </div>
                {order.paymentMethod && (
                  <div>
                    <dt>Payment method</dt>
                    <dd>
                      {order.paymentMethod === "cash"
                        ? "Cash"
                        : "GCash (InstaPay QR)"}
                    </dd>
                  </div>
                )}
                {order.paymentAmountReceived != null && (
                  <div>
                    <dt>Amount received</dt>
                    <dd>{formatPeso(order.paymentAmountReceived)}</dd>
                  </div>
                )}
              </dl>

              {order.paymentRejectedAt && !awaitingVerification && !paid && (
                <div className="pilaw-payment-alert" role="status">
                  <strong>Last submission was rejected</strong>
                  <p>{formatOrderDateTime(order.paymentRejectedAt)}</p>
                  {order.paymentRejectionReason && (
                    <p>{order.paymentRejectionReason}</p>
                  )}
                </div>
              )}

              {evidencePath ? (
                <div className="pilaw-evidence">
                  <h3>Payment evidence</h3>
                  <p className="pilaw-detail-note">
                    Supporting evidence only. Open it, verify the actual
                    transaction in the receiving account, then confirm manually.
                  </p>
                  {evidenceError && (
                    <p className="pilaw-inline-error" role="alert">
                      {evidenceError}
                    </p>
                  )}
                  {evidenceUrl ? (
                    /\.pdf($|\?)/i.test(evidenceUrl) ? (
                      <a
                        className="pilaw-evidence-link"
                        href={evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FileImage size={16} aria-hidden="true" /> Open payment
                        PDF
                      </a>
                    ) : (
                      <a
                        className="pilaw-evidence-link"
                        href={evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={evidenceUrl}
                          alt="Submitted payment screenshot"
                        />
                        <span>Open full-size evidence</span>
                      </a>
                    )
                  ) : (
                    canViewEvidence &&
                    !evidenceError && (
                      <p className="pilaw-detail-note">Preparing evidence...</p>
                    )
                  )}
                </div>
              ) : (
                <p className="pilaw-detail-note">
                  No payment evidence has been submitted yet.
                </p>
              )}

              {canConfirmPayment ? (
                <div className="pilaw-embedded-form">
                  {awaitingVerification && (
                    <label>
                      Rejection reason (required)
                      <Input
                        value={rejectReason}
                        maxLength={1000}
                        minLength={5}
                        placeholder="e.g. Reference not found in the receiving account"
                        onChange={(event) => setRejectReason(event.target.value)}
                        disabled={Boolean(busy)}
                      />
                    </label>
                  )}
                  <label>
                    Confirmation note (optional)
                    <Input
                      value={paymentNote}
                      maxLength={1000}
                      placeholder="e.g. Verified in the church GCash account"
                      onChange={(event) => setPaymentNote(event.target.value)}
                      disabled={Boolean(busy) || paid}
                    />
                  </label>
                  <div className="pilaw-embedded-form-actions">
                    {awaitingVerification && (
                      <Button
                        onClick={() => void handleConfirmPayment()}
                        disabled={Boolean(busy) || !evidencePath}
                      >
                        <ShieldCheck size={16} aria-hidden="true" />
                        {busy === "confirm"
                          ? "Confirming..."
                          : "Confirm payment"}
                      </Button>
                    )}
                    {awaitingVerification && (
                      <Button
                        variant="danger"
                        onClick={() => void handleRejectPayment()}
                        disabled={
                          Boolean(busy) || rejectReason.trim().length < 5
                        }
                      >
                        {busy === "reject" ? "Rejecting..." : "Reject submission"}
                      </Button>
                    )}
                  </div>
                  {!awaitingVerification && !paid && (
                    <p className="pilaw-detail-note">
                      Payment review starts after the customer submits a
                      transaction reference and evidence. Uploading evidence does
                      not mark the order paid; confirm only after verifying the
                      actual transaction.
                    </p>
                  )}
                </div>
              ) : (
                <p className="pilaw-detail-note">
                  <ShieldAlert size={15} aria-hidden="true" /> You can view this
                  order but you do not have permission to review or confirm
                  payments.
                </p>
              )}
            </section>
          )}

          {!cancelled &&
            canManage &&
            order.source === "staff" &&
            order.paymentMethod === "gcash" &&
            order.paymentStatus === "awaiting_payment" && (
              <section
                className="pilaw-detail-card"
                aria-labelledby="gcash-retry-title"
              >
                <h2 id="gcash-retry-title">Record GCash payment</h2>
                {gcashRetryAvailable ? (
                  <form
                    className="pilaw-embedded-form"
                    onSubmit={handleRecordGcashReceipt}
                  >
                    <p className="pilaw-detail-note" style={{ marginTop: 0 }}>
                      This staff-assisted order is still awaiting a GCash
                      receipt. Upload the buyer's receipt to move it to Payment
                      Verification. This never marks the order Paid; an
                      authorised staff member must still confirm the actual
                      transaction.
                    </p>
                    <label>
                      Transaction reference (required)
                      <Input
                        value={gcashReference}
                        maxLength={120}
                        placeholder="Reference shown on the buyer's receipt"
                        onChange={(event) =>
                          setGcashReference(event.target.value)
                        }
                        disabled={Boolean(busy)}
                      />
                    </label>
                    <label>
                      GCash receipt screenshot/PDF (required)
                      <input
                        ref={gcashEvidenceInputRef}
                        type="file"
                        accept={EVIDENCE_TYPES}
                        onChange={(event) =>
                          setGcashEvidence(event.target.files?.[0] ?? null)
                        }
                        disabled={Boolean(busy)}
                      />
                    </label>
                    {gcashError && (
                      <p className="pilaw-inline-error" role="alert">
                        {gcashError}
                      </p>
                    )}
                    <div className="pilaw-embedded-form-actions">
                      <Button
                        type="submit"
                        disabled={
                          Boolean(busy) ||
                          !gcashEvidence ||
                          gcashReference.trim().length < 4
                        }
                      >
                        {busy === "gcash-retry"
                          ? "Recording..."
                          : "Record GCash receipt"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="pilaw-detail-note" style={{ marginTop: 0 }}>
                    {gcashRetryHint ||
                      "This order cannot accept a GCash receipt right now."}
                  </p>
                )}
              </section>
            )}

          {!cancelled && canConfirmPayment && !paid && (
            <section
              className="pilaw-detail-card"
              aria-labelledby="cash-payment-title"
            >
              <h2 id="cash-payment-title">Record cash payment</h2>
              <p className="pilaw-detail-note" style={{ marginTop: 0 }}>
                Use this only when the cash has been physically received. No
                receipt or transaction reference is required. The amount must
                match the order total.
              </p>
              <div className="pilaw-embedded-form">
                <label>
                  Amount received (pesos)
                  <Input
                    type="number"
                    min={order.totalAmount}
                    max={order.totalAmount}
                    value={cashAmount || String(order.totalAmount)}
                    onChange={(event) => setCashAmount(event.target.value)}
                    disabled={Boolean(busy)}
                  />
                </label>
                <label>
                  Staff note (optional)
                  <Input
                    value={cashNote}
                    maxLength={1000}
                    placeholder="e.g. Received at the church office"
                    onChange={(event) => setCashNote(event.target.value)}
                    disabled={Boolean(busy)}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={cashConfirmed}
                    onChange={(event) => setCashConfirmed(event.target.checked)}
                    disabled={Boolean(busy)}
                  />
                  <span>I have physically received the cash for this order.</span>
                </label>
                <div className="pilaw-embedded-form-actions">
                  <Button
                    onClick={() => void handleRecordCashPayment()}
                    disabled={Boolean(busy) || !cashConfirmed}
                  >
                    <ShieldCheck size={16} aria-hidden="true" />
                    {busy === "cash" ? "Recording..." : "Record cash payment"}
                  </Button>
                </div>
              </div>
            </section>
          )}

          {!cancelled && (
            <section
              className="pilaw-detail-card"
              aria-labelledby="fulfillment-title"
            >
              <h2 id="fulfillment-title">Fulfillment</h2>
              {canManage ? (
                <>
                  <p className="pilaw-detail-note" style={{ marginTop: 0 }}>
                    Current status:{" "}
                    <strong>
                      {FULFILLMENT_STATUS_LABELS[order.fulfillmentStatus]}
                    </strong>
                  </p>
                  <div className="pilaw-embedded-form">
                    <label>
                      Status note (optional)
                      <Input
                        value={statusNote}
                        maxLength={1000}
                        onChange={(event) => setStatusNote(event.target.value)}
                        disabled={Boolean(busy)}
                      />
                    </label>
                    <div className="pilaw-embedded-form-actions">
                      {nextStatuses.map((status) => (
                        <Button
                          key={status}
                          variant="secondary"
                          onClick={() => void handleStatusChange(status)}
                          disabled={Boolean(busy)}
                        >
                          {busy === `status-${status}`
                            ? "Saving..."
                            : `Mark ${FULFILLMENT_STATUS_LABELS[status]}`}
                        </Button>
                      ))}
                      {canCancelOrder(order.fulfillmentStatus) && (
                        <Button
                          variant="danger"
                          onClick={() => void handleStatusChange("cancelled")}
                          disabled={Boolean(busy)}
                        >
                          {busy === "status-cancelled"
                            ? "Cancelling..."
                            : "Cancel order"}
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="pilaw-detail-note" style={{ marginTop: 0 }}>
                  <ShieldAlert size={15} aria-hidden="true" /> You can view this
                  order but you do not have permission to change fulfillment.
                </p>
              )}
            </section>
          )}

          <section className="pilaw-detail-card" aria-labelledby="activity-title">
            <h2 id="activity-title">Activity history</h2>
            <ol className="pilaw-activity">
              {activity.map((event) => {
                const change = statusChange(event);
                return (
                  <li className="pilaw-activity-item" key={event.id}>
                    <strong>{EVENT_LABELS[event.eventType]}</strong>
                    <time dateTime={event.createdAt}>
                      {formatOrderDateTime(event.createdAt)} · {event.actorName}
                    </time>
                    {change && <p className="pilaw-activity-diff">{change}</p>}
                    {event.note && <p>{event.note}</p>}
                  </li>
                );
              })}
            </ol>
            {activity.length === 0 && (
              <p className="pilaw-detail-note">
                No activity has been recorded for this order yet.
              </p>
            )}
            <p className="pilaw-detail-note">
              Activity is append-only and records who made each change.
            </p>
          </section>
        </div>
      </div>

      <p className="pilaw-accounting-footnote">
        Expected sales exclude cancelled orders. Confirmed collections include
        only paid orders. A cancelled order that was already paid remains visible
        and is not automatically treated as a refund.
      </p>
    </div>
  );
}
