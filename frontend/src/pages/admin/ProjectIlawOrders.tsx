import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  RefreshCcw,
  Search,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/Modal";
import Select from "../../components/ui/Select";
import { useAuth } from "../../features/auth/auth";
import {
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SHOP_ITEMS,
  formatPeso,
  type ProjectIlawOrder,
  type ProjectIlawOrderFilters,
} from "../../features/fundraising/projectIlaw";
import {
  buildOrderSummary,
  csvFilename,
  downloadCsv,
  filterProjectIlawOrders,
  formatOrderDateTime,
  projectIlawExportRowsToCsv,
} from "../../features/fundraising/orderAccounting";
import {
  confirmProjectIlawPayment,
  getPaymentEvidenceUrl,
  getProjectIlawExportRows,
  getProjectIlawOrders,
  recordProjectIlawCashPayment,
  rejectProjectIlawPayment,
} from "../../features/fundraising/orderService";
import "./ProjectIlawOrders.css";

const EMPTY_FILTERS: ProjectIlawOrderFilters = {
  from: "",
  to: "",
  product: "",
  payment: "",
  fulfillment: "",
};

function itemsSummary(order: ProjectIlawOrder) {
  return order.items
    .map(
      (item) =>
        `${item.productName} · ${item.color} · ${
          item.productType === "eco_bag" ? "One Size" : item.size
        } ×${item.quantity}`,
    )
    .join(", ");
}

function matchesSearch(order: ProjectIlawOrder, query: string) {
  if (!query) return true;
  const haystack = [
    order.reference,
    order.customerName,
    order.mobile,
    order.paymentReference,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export default function ProjectIlawOrders() {
  const { hasPermission } = useAuth();
  const canExport = hasPermission("project_ilaw.orders.export");
  const canConfirmPayment = hasPermission("project_ilaw.orders.confirm_payment");
  const [orders, setOrders] = useState<ProjectIlawOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] =
    useState<ProjectIlawOrderFilters>(EMPTY_FILTERS);

  // Cash payment dialog state.
  const [cashOrder, setCashOrder] = useState<ProjectIlawOrder | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [cashNote, setCashNote] = useState("");
  const [cashBusy, setCashBusy] = useState(false);

  // GCash review modal state.
  const [reviewOrder, setReviewOrder] = useState<ProjectIlawOrder | null>(null);
  const [reviewEvidenceUrl, setReviewEvidenceUrl] = useState("");
  const [reviewEvidenceError, setReviewEvidenceError] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOrders(await getProjectIlawOrders());
    } catch {
      setError("Project Ilaw orders could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      filterProjectIlawOrders(orders, filters).filter((order) =>
        matchesSearch(order, query),
      ),
    [filters, orders, query],
  );
  const summary = useMemo(() => buildOrderSummary(filtered), [filtered]);

  const updateFilter = (key: keyof ProjectIlawOrderFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  async function handleExport() {
    if (!canExport || exporting) return;
    setExporting(true);
    setNotice("");
    try {
      const rows = await getProjectIlawExportRows(filters);
      if (rows.length === 0) {
        setNotice("No order lines match these filters, so there is nothing to export.");
        return;
      }
      downloadCsv(csvFilename(), projectIlawExportRowsToCsv(rows));
      setNotice(
        `Exported ${rows.length} order line${rows.length === 1 ? "" : "s"} to CSV.`,
      );
    } catch {
      setNotice("The CSV export could not be generated.");
    } finally {
      setExporting(false);
    }
  }

  function openCashPayment(order: ProjectIlawOrder) {
    setCashOrder(order);
    setCashAmount(String(order.totalAmount));
    setCashConfirmed(false);
    setCashNote("");
  }

  async function submitCashPayment() {
    if (!cashOrder || cashBusy) return;
    const amount = Number(cashAmount);
    if (!cashConfirmed) {
      setError("Confirm that you physically received the cash before recording it.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter the amount received.");
      return;
    }
    if (amount !== cashOrder.totalAmount) {
      setError("The amount received must match the order total.");
      return;
    }
    if (!window.confirm("Record this order as paid in cash? This cannot be undone.")) {
      return;
    }
    setCashBusy(true);
    setError("");
    setNotice("");
    try {
      await recordProjectIlawCashPayment(cashOrder.id, amount, cashNote, cashConfirmed);
      setCashOrder(null);
      setCashAmount("");
      setCashConfirmed(false);
      setCashNote("");
      setNotice("Cash payment recorded. The order is now paid.");
      await load();
    } catch {
      setError("Cash payment could not be recorded. Refresh and try again.");
    } finally {
      setCashBusy(false);
    }
  }

  async function openPaymentReview(order: ProjectIlawOrder) {
    setReviewOrder(order);
    setReviewEvidenceUrl("");
    setReviewEvidenceError("");
    setRejectReason("");
    if (order.paymentEvidencePath && canConfirmPayment) {
      try {
        const url = await getPaymentEvidenceUrl(order.paymentEvidencePath);
        setReviewEvidenceUrl(url);
      } catch {
        setReviewEvidenceError("Payment evidence could not be opened.");
      }
    }
  }

  async function confirmReviewPayment() {
    if (!reviewOrder || reviewBusy) return;
    setReviewBusy(true);
    setError("");
    setNotice("");
    try {
      await confirmProjectIlawPayment(reviewOrder.id, "");
      setReviewOrder(null);
      setNotice("Payment confirmed. The order now counts toward production quantities.");
      await load();
    } catch {
      setError("Payment could not be confirmed. Refresh and try again.");
    } finally {
      setReviewBusy(false);
    }
  }

  async function rejectReviewPayment() {
    if (!reviewOrder || reviewBusy) return;
    const reason = rejectReason.trim();
    if (reason.length < 5) {
      setError("Enter a rejection reason of at least 5 characters.");
      return;
    }
    if (!window.confirm("Reject this payment submission?")) return;
    setReviewBusy(true);
    setError("");
    setNotice("");
    try {
      await rejectProjectIlawPayment(reviewOrder.id, reason);
      setReviewOrder(null);
      setRejectReason("");
      setNotice("Payment submission rejected. The order is back to Awaiting Payment.");
      await load();
    } catch {
      setError("Payment could not be rejected. Refresh and try again.");
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <div className="pilaw-orders-page">
      <header className="pilaw-orders-header">
        <div>
          <p className="pilaw-eyebrow">Project Ilaw</p>
          <h1>Project Ilaw — Order Management</h1>
          <p>
            Review orders and payment evidence, manually confirm payments, and
            track fulfilment and made-to-order production quantities.
          </p>
        </div>
        <div className="pilaw-orders-actions">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCcw size={16} aria-hidden="true" />
            Refresh
          </Button>
          {canExport && (
            <Button onClick={() => void handleExport()} disabled={exporting}>
              <Download size={16} aria-hidden="true" />
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          )}
        </div>
      </header>

      {notice && (
        <p className="pilaw-notice" role="status">
          {notice}
        </p>
      )}

      <section className="pilaw-search-panel" aria-label="Order search">
        <label className="pilaw-filter-search pilaw-search-prominent">
          <span>Search orders</span>
          <div className="pilaw-search-field">
            <Search size={18} aria-hidden="true" />
            <Input
              type="search"
              value={search}
              placeholder="Reference, customer name, mobile number, or payment reference"
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
            />
          </div>
        </label>
      </section>

      <section className="pilaw-summary" aria-label="Order summary">
        <article>
          <span>Total orders received</span>
          <strong>{summary.totalOrders}</strong>
          <small>All submitted orders in this view</small>
        </article>
        <article>
          <span>Total units ordered</span>
          <strong>{summary.totalUnits}</strong>
          <small>
            {summary.activeUnits} active · {summary.cancelledUnits} cancelled
          </small>
        </article>
        <article>
          <span>Awaiting payment</span>
          <strong>{summary.awaitingPaymentOrders}</strong>
          <small>Cancelled orders are excluded</small>
        </article>
        <article>
          <span>Payment verification</span>
          <strong>{summary.paymentVerificationOrders}</strong>
          <small>Evidence submitted, awaiting manual review</small>
        </article>
        <article>
          <span>Paid orders</span>
          <strong>{summary.paidOrders}</strong>
          <small>Manually confirmed by authorised staff</small>
        </article>
        <article>
          <span>Total expected sales</span>
          <strong>{formatPeso(summary.expectedSales)}</strong>
          <small>Cancelled orders are excluded</small>
        </article>
        <article className="pilaw-summary-collections">
          <span>Total confirmed collections</span>
          <strong>{formatPeso(summary.confirmedCollections)}</strong>
          <small>Paid orders only</small>
        </article>
      </section>

      {summary.cancelledPaidOrders > 0 && (
        <p className="pilaw-accounting-note" role="note">
          {summary.cancelledPaidOrders} cancelled order
          {summary.cancelledPaidOrders === 1 ? " was" : "s were"} already paid (
          {formatPeso(summary.cancelledPaidAmount)}). They remain in confirmed
          collections and are not treated as refunds.
        </p>
      )}

      <section className="pilaw-panel" aria-label="Order management">
        <div className="pilaw-filters">
          <label>
            <span>From date</span>
            <Input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </label>
          <label>
            <span>To date</span>
            <Input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
          </label>
          <label>
            <span>Product</span>
            <Select
              value={filters.product}
              onChange={(event) => updateFilter("product", event.target.value)}
            >
              <option value="">All products</option>
              {SHOP_ITEMS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span>Payment status</span>
            <Select
              value={filters.payment}
              onChange={(event) => updateFilter("payment", event.target.value)}
            >
              <option value="">All payment statuses</option>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span>Fulfillment status</span>
            <Select
              value={filters.fulfillment}
              onChange={(event) =>
                updateFilter("fulfillment", event.target.value)
              }
            >
              <option value="">All fulfillment statuses</option>
              {Object.entries(FULFILLMENT_STATUS_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </Select>
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setSearch("");
            }}
            disabled={filters === EMPTY_FILTERS && !search}
          >
            Clear filters
          </Button>
        </div>

        {error && (
          <div className="pilaw-error" role="alert">
            {error}
            <button type="button" onClick={() => void load()}>
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <p className="pilaw-state">Loading Project Ilaw orders...</p>
        ) : filtered.length === 0 ? (
          <div className="pilaw-state">
            <strong>
              {orders.length === 0
                ? "No Project Ilaw orders yet."
                : "No orders match these filters."}
            </strong>
            <p>
              New orders from the public shop appear here after they are saved.
            </p>
          </div>
        ) : (
          <div className="pilaw-table-wrap">
            <table className="pilaw-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Date / time</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Mobile</th>
                  <th scope="col">Products, colours, and sizes</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Payment status</th>
                  <th scope="col">Fulfillment status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        className="pilaw-order-link"
                        to={`/admin/project-ilaw-orders/${order.id}`}
                      >
                        {order.reference}
                      </Link>
                    </td>
                    <td>{formatOrderDateTime(order.createdAt)}</td>
                    <td>{order.customerName}</td>
                    <td>{order.mobile}</td>
                    <td className="pilaw-products-cell">
                      {itemsSummary(order)}
                    </td>
                    <td>{order.totalQuantity}</td>
                    <td>{formatPeso(order.totalAmount)}</td>
                    <td>
                      <span
                        className={`pilaw-status pilaw-status-${order.paymentStatus}`}
                      >
                        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`pilaw-status pilaw-status-${order.fulfillmentStatus}`}
                      >
                        {FULFILLMENT_STATUS_LABELS[order.fulfillmentStatus]}
                      </span>
                    </td>
                     <td>
                       <div className="pilaw-row-actions">
                         {order.paymentStatus === "awaiting_payment" &&
                           canConfirmPayment && (
                             <Button
                               variant="secondary"
                               onClick={() => openCashPayment(order)}
                               disabled={cashBusy}
                             >
                               Record cash payment
                             </Button>
                           )}
                         {order.paymentStatus === "payment_verification" &&
                           canConfirmPayment && (
                             <Button
                               variant="secondary"
                               onClick={() => void openPaymentReview(order)}
                             >
                               Review payment
                             </Button>
                           )}
                         {order.paymentStatus === "paid" && (
                           <span className="pilaw-paid-indicator">
                             Paid
                             {order.paymentMethod
                               ? ` · ${order.paymentMethod === "cash" ? "Cash" : "GCash"}`
                               : ""}
                           </span>
                         )}
                         <Link
                           className="pilaw-order-link"
                           to={`/admin/project-ilaw-orders/${order.id}`}
                         >
                           Details
                         </Link>
                       </div>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="pilaw-accounting-footnote">
        Expected sales exclude cancelled orders. Confirmed collections include
        only paid orders. A cancelled order that was already paid stays visible
        in the records and CSV export and is not automatically treated as a
        refund.
      <Modal
        open={Boolean(cashOrder)}
        title="Record cash payment"
        onClose={() => setCashOrder(null)}
      >
        {cashOrder && (
          <div className="pilaw-embedded-form">
            <p>
              <strong>{cashOrder.customerName}</strong> · {cashOrder.reference}
            </p>
            <p>Amount due: {formatPeso(cashOrder.totalAmount)}</p>
            <label>
              Amount received (pesos)
              <Input
                type="number"
                min={cashOrder.totalAmount}
                max={cashOrder.totalAmount}
                value={cashAmount || String(cashOrder.totalAmount)}
                onChange={(event) => setCashAmount(event.target.value)}
                disabled={cashBusy}
              />
            </label>
            <label>
              Staff note (optional)
              <Input
                value={cashNote}
                maxLength={1000}
                placeholder="e.g. Received at the church office"
                onChange={(event) => setCashNote(event.target.value)}
                disabled={cashBusy}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={cashConfirmed}
                onChange={(event) => setCashConfirmed(event.target.checked)}
                disabled={cashBusy}
              />
              <span>I have physically received the cash for this order.</span>
            </label>
            <div className="pilaw-embedded-form-actions">
              <Button
                onClick={() => void submitCashPayment()}
                disabled={cashBusy || !cashConfirmed}
              >
                {cashBusy ? "Recording..." : "Record cash payment"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(reviewOrder)}
        title="Review payment"
        onClose={() => setReviewOrder(null)}
      >
        {reviewOrder && (
          <div className="pilaw-embedded-form">
            <p>
              <strong>{reviewOrder.customerName}</strong> · {reviewOrder.reference}
            </p>
            <p>Amount due: {formatPeso(reviewOrder.totalAmount)}</p>
            <p>Transaction reference: {reviewOrder.paymentReference || "Not submitted"}</p>
            {reviewEvidenceError && (
              <p className="pilaw-inline-error" role="alert">
                {reviewEvidenceError}
              </p>
            )}
            {reviewEvidenceUrl ? (
              /\.pdf($|\?)/i.test(reviewEvidenceUrl) ? (
                <a href={reviewEvidenceUrl} target="_blank" rel="noopener noreferrer">
                  Open payment PDF
                </a>
              ) : (
                <img src={reviewEvidenceUrl} alt="Submitted payment screenshot" style={{ maxWidth: "100%" }} />
              )
            ) : (
              <p className="pilaw-detail-note">No payment evidence submitted.</p>
            )}
            <label>
              Rejection reason (required)
              <Input
                value={rejectReason}
                maxLength={1000}
                minLength={5}
                placeholder="e.g. Reference not found in the receiving account"
                onChange={(event) => setRejectReason(event.target.value)}
                disabled={reviewBusy}
              />
            </label>
            <div className="pilaw-embedded-form-actions">
              <Button
                onClick={() => void confirmReviewPayment()}
                disabled={reviewBusy || !reviewOrder.paymentEvidencePath}
              >
                {reviewBusy ? "Confirming..." : "Confirm payment"}
              </Button>
              <Button
                variant="danger"
                onClick={() => void rejectReviewPayment()}
                disabled={reviewBusy || rejectReason.trim().length < 5}
              >
                {reviewBusy ? "Rejecting..." : "Reject submission"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      </p>
    </div>
  );
}
