import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { FormEvent } from "react";
import { ArrowLeft, RefreshCcw, ShieldAlert } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import OrderLineItemsEditor from "../../components/fundraising/OrderLineItemsEditor";
import { useAuth } from "../../features/auth/auth";
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
  getProjectIlawOrder,
  getProjectIlawOrderActivity,
  updateProjectIlawFulfillment,
} from "../../features/fundraising/orderService";
import "./ProjectIlawOrders.css";

const EVENT_LABELS: Record<ProjectIlawOrderEvent["eventType"], string> = {
  order_created: "Order received",
  payment_confirmed: "Payment confirmed",
  fulfillment_changed: "Fulfillment updated",
  order_amended: "Order amended",
  order_cancelled: "Order cancelled",
};

function draftFromOrder(order: ProjectIlawOrder): OrderDraft {
  const items: OrderDraftItem[] = order.items.map((item) => ({
    ...createDraftItem(item.productId),
    size: item.size,
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
  const [statusNote, setStatusNote] = useState("");
  const [showAmend, setShowAmend] = useState(false);
  const [amendDraft, setAmendDraft] = useState<OrderDraft | null>(null);
  const [amendNote, setAmendNote] = useState("");
  const [amendErrors, setAmendErrors] = useState<string[]>([]);

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
        error instanceof Error
          ? error.message
          : "That change could not be saved. Refresh the order and try again.",
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
      setNotice("Payment confirmed. The order remains in its current fulfilment state.");
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
          : `Fulfilment status changed to ${FULFILLMENT_STATUS_LABELS[status]}.`,
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
            <span>{order.totalQuantity} total item{order.totalQuantity === 1 ? "" : "s"}</span>
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

          {order.paymentStatus === "payment_confirmed" && (
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
              {order.paymentStatus === "payment_confirmed" && (
                <p className="pilaw-detail-note">
                  This order was already payment-confirmed before it was
                  cancelled. It stays in confirmed collections and is not
                  treated as a refund here.
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
          {order.paymentStatus === "awaiting_payment" && !cancelled && (
            <section
              className="pilaw-detail-card"
              aria-labelledby="confirm-payment-title"
            >
              <h2 id="confirm-payment-title">Confirm payment</h2>
              {canConfirmPayment ? (
                <>
                  <p className="pilaw-detail-note" style={{ marginTop: 0 }}>
                    Confirm only after Bryan has verified the payment directly.
                    The system never marks an order paid automatically.
                  </p>
                  <div className="pilaw-embedded-form">
                    <label>
                      Payment note (optional)
                      <Input
                        value={paymentNote}
                        maxLength={1000}
                        placeholder="e.g. Cash received at the church office"
                        onChange={(event) => setPaymentNote(event.target.value)}
                        disabled={Boolean(busy)}
                      />
                    </label>
                    <div className="pilaw-embedded-form-actions">
                      <Button
                        onClick={() => void handleConfirmPayment()}
                        disabled={Boolean(busy)}
                      >
                        {busy === "confirm"
                          ? "Confirming..."
                          : "Confirm payment"}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="pilaw-detail-note" style={{ marginTop: 0 }}>
                  <ShieldAlert size={15} aria-hidden="true" /> You can view this
                  order but you do not have permission to confirm payments.
                </p>
              )}
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
                  order but you do not have permission to change fulfilment.
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
        only payment-confirmed orders. A cancelled order that was already paid
        remains visible and is not automatically treated as a refund.
      </p>
    </div>
  );
}
