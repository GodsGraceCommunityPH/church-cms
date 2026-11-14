import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/Modal";
import Select from "../../components/ui/Select";
import MerchandiseCard from "../../components/fundraising/MerchandiseCard";
import OrderLineItemsEditor from "../../components/fundraising/OrderLineItemsEditor";
import { useAuth } from "../../features/auth/auth";
import { supabase } from "../../lib/supabase";
import {
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SHOP_ITEMS,
  createRequestId,
  formatPeso,
  type OrderDraft,
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
  createProjectIlawStaffOrder,
  getPaymentEvidenceUrl,
  getProjectIlawExportRows,
  getProjectIlawOrders,
  getProjectIlawPublicSettings,
  recordProjectIlawCashPayment,
  rejectProjectIlawPayment,
  submitProjectIlawPayment,
  uploadProjectIlawPaymentEvidence,
  type CreatedProjectIlawStaffOrder,
} from "../../features/fundraising/orderService";
import {
  staffPaymentBlockReason,
  staffPaymentErrorMessage,
  staffPaymentOptionState,
  validateStaffOrderItems,
  type StaffPaymentMethod,
} from "../../features/fundraising/staffOrder";
import "./ProjectIlawOrders.css";

const EMPTY_FILTERS: ProjectIlawOrderFilters = {
  from: "",
  to: "",
  product: "",
  payment: "",
  fulfillment: "",
};

const STAFF_EVIDENCE_TYPES =
  "image/jpeg,image/png,image/webp,application/pdf";
const STAFF_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;

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
  const canManage = hasPermission("project_ilaw.orders.manage");
  const [orders, setOrders] = useState<ProjectIlawOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] =
    useState<ProjectIlawOrderFilters>(EMPTY_FILTERS);

  // Staff-assisted order creation dialog state.
  const [staffOrderOpen, setStaffOrderOpen] = useState(false);
  const [staffOrderSubmitting, setStaffOrderSubmitting] = useState(false);
  const [staffOrderError, setStaffOrderError] = useState("");
  const [staffOrderWarning, setStaffOrderWarning] = useState("");
  const [staffOrderCreated, setStaffOrderCreated] =
    useState<CreatedProjectIlawStaffOrder | null>(null);
  const [staffDraft, setStaffDraft] = useState<OrderDraft>(() => ({
    customerName: "",
    mobile: "",
    notes: "",
    items: [],
  }));
  const [staffPaymentMethod, setStaffPaymentMethod] =
    useState<StaffPaymentMethod>("unpaid");
  const [staffPaymentReference, setStaffPaymentReference] = useState("");
  const [staffEvidenceFile, setStaffEvidenceFile] = useState<File | null>(null);
  const [staffCashNote, setStaffCashNote] = useState("");
  const [staffCashConfirmed, setStaffCashConfirmed] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null);
  const staffEvidenceInputRef = useRef<HTMLInputElement>(null);
  const staffRequestIdRef = useRef(createRequestId());
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

  // Realtime keeps the staff order list fresh after an authorised payment
  // confirmation or fulfillment change. Row-level security still decides which
  // rows a session may receive, so realtime is a display concern only.
  useEffect(() => {
    if (!canManage) return;
    const channel = supabase
      .channel("project-ilaw-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_ilaw_orders" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canManage, load]);

  const refreshPaymentSettings = useCallback(async () => {
    try {
      const settings = await getProjectIlawPublicSettings();
      setPaymentsEnabled(settings.paymentsEnabled);
    } catch {
      // Unknown settings must not be treated as open: a GCash receipt uploaded
      // while collection is closed would fail after the order already exists.
      setPaymentsEnabled(null);
    }
  }, []);

  useEffect(() => {
    void refreshPaymentSettings();
  }, [refreshPaymentSettings]);

  const resetStaffPaymentFields = useCallback(() => {
    setStaffPaymentReference("");
    setStaffEvidenceFile(null);
    setStaffCashNote("");
    setStaffCashConfirmed(false);
    if (staffEvidenceInputRef.current) {
      staffEvidenceInputRef.current.value = "";
    }
  }, []);

  function openStaffOrderDialog() {
    resetStaffPaymentFields();
    setStaffPaymentMethod("unpaid");
    setStaffOrderError("");
    void refreshPaymentSettings();
    setStaffOrderOpen(true);
  }

  function closeStaffOrderDialog() {
    if (staffOrderSubmitting) return;
    setStaffOrderOpen(false);
    setStaffOrderError("");
    resetStaffPaymentFields();
    setStaffPaymentMethod("unpaid");
  }

  function changeStaffPaymentMethod(method: StaffPaymentMethod) {
    setStaffPaymentMethod(method);
    setStaffOrderError("");
    if (method !== "gcash") {
      // A receipt picked for a previous order must never be submitted again.
      setStaffPaymentReference("");
      setStaffEvidenceFile(null);
      if (staffEvidenceInputRef.current) {
        staffEvidenceInputRef.current.value = "";
      }
    }
    if (method !== "cash") {
      setStaffCashNote("");
      setStaffCashConfirmed(false);
    }
  }

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

  async function submitStaffOrder() {
    if (staffOrderSubmitting) return;

    const customerName = staffDraft.customerName.trim();
    if (!customerName) {
      setStaffOrderError("Customer name is required.");
      return;
    }
    if (staffPaymentMethod === "gcash" && !staffDraft.mobile.trim()) {
      setStaffOrderError("Enter the buyer mobile number for GCash staff orders.");
      return;
    }

    const itemValidation = validateStaffOrderItems(staffDraft.items);
    if (!itemValidation.ok) {
      setStaffOrderError(itemValidation.error);
      return;
    }
    const items = itemValidation.items;

    const paymentBlock = staffPaymentBlockReason({
      method: staffPaymentMethod,
      paymentsEnabled,
      canConfirmPayment,
      cashConfirmed: staffCashConfirmed,
    });
    if (paymentBlock) {
      setStaffOrderError(paymentBlock);
      return;
    }

    if (staffPaymentMethod === "gcash") {
      if (!staffPaymentReference.trim()) {
        setStaffOrderError(
          "Enter the GCash transaction reference from the buyer's receipt.",
        );
        return;
      }
      if (!staffEvidenceFile) {
        setStaffOrderError("Attach the GCash receipt screenshot or PDF.");
        return;
      }
      if (staffEvidenceFile.size > STAFF_EVIDENCE_MAX_BYTES) {
        setStaffOrderError("The GCash receipt must be 5 MB or smaller.");
        return;
      }
    }

    setStaffOrderSubmitting(true);
    setStaffOrderError("");
    setStaffOrderWarning("");
    setStaffOrderCreated(null);

    let created: CreatedProjectIlawStaffOrder;
    try {
      created = await createProjectIlawStaffOrder({
        requestId: staffRequestIdRef.current,
        customerName,
        mobile: staffDraft.mobile.trim(),
        notes: staffDraft.notes.trim(),
        items,
        // Record the intended method so the order row shows how the buyer is
        // paying, even though the receipt is uploaded after the order exists.
        paymentMethod:
          staffPaymentMethod === "unpaid" ? "unpaid" : staffPaymentMethod,
      });
    } catch (error) {
      const message =
        (error as { message?: string } | null)?.message ||
        "Staff-assisted order could not be created. Please try again.";
      setStaffOrderError(message);
      setStaffOrderSubmitting(false);
      return;
    }

    let paymentStatus = created.paymentStatus;
    let warning = "";

    try {
      if (staffPaymentMethod === "gcash" && staffEvidenceFile) {
        // The receipt never marks the order paid. It only moves the order to
        // Payment Verification for an independent manual review.
        const evidencePath = await uploadProjectIlawPaymentEvidence(
          created.orderId,
          created.paymentToken,
          staffEvidenceFile,
        );
        await submitProjectIlawPayment({
          reference: created.reference,
          mobile: staffDraft.mobile.trim(),
          paymentToken: created.paymentToken,
          paymentReference: staffPaymentReference.trim(),
          evidencePath,
        });
        paymentStatus = "payment_verification";
      } else if (staffPaymentMethod === "cash") {
        // Cash is recorded only after the staff member confirms they
        // physically received it, using the existing secure cash path.
        await recordProjectIlawCashPayment(
          created.orderId,
          created.totalAmount,
          staffCashNote,
          staffCashConfirmed,
        );
        paymentStatus = "paid";
      }
    } catch (error) {
      const message =
        (error as { message?: string } | null)?.message ||
        "The payment step did not complete.";
      const retryHint =
        staffPaymentMethod === "gcash"
          ? "Open the order to retry the GCash receipt."
          : "Open the order to record the cash.";
      warning = `Order ${created.reference} was created, but the ${
        staffPaymentMethod === "gcash" ? "GCash receipt" : "cash payment"
      } was not recorded: ${staffPaymentErrorMessage(
        message,
        staffPaymentMethod,
      )} ${retryHint}`;
    }

    // A fresh request id keeps the next staff order from being treated as a
    // duplicate of the order that was just created.
    staffRequestIdRef.current = createRequestId();
    setStaffOrderCreated({ ...created, paymentStatus });
    setStaffOrderWarning(warning);
    setStaffOrderOpen(false);
    setStaffDraft({
      customerName: "",
      mobile: "",
      notes: "",
      items: [],
    });
    setStaffPaymentMethod("unpaid");
    resetStaffPaymentFields();
    setStaffOrderError("");
    setNotice(`Staff-assisted order ${created.reference} created.`);
    setStaffOrderSubmitting(false);
    await load();
  }

  async function copyStaffReference() {
    if (!staffOrderCreated) return;
    try {
      await navigator.clipboard.writeText(staffOrderCreated.reference);
      setNotice("Order reference copied to the clipboard.");
    } catch {
      setNotice(`Order reference: ${staffOrderCreated.reference}`);
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
    } catch (error) {
      const message =
        (error as { message?: string } | null)?.message ||
        "Cash payment could not be recorded. Refresh and try again.";
      setError(message);
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

  const gcashOption = staffPaymentOptionState("gcash", {
    paymentsEnabled,
    canConfirmPayment,
  });
  const cashOption = staffPaymentOptionState("cash", {
    paymentsEnabled,
    canConfirmPayment,
  });
  const staffPaymentBlocked =
    staffPaymentBlockReason({
      method: staffPaymentMethod,
      paymentsEnabled,
      canConfirmPayment,
      cashConfirmed: staffCashConfirmed,
    }) !== "";

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
          {canManage && (
            <Button onClick={openStaffOrderDialog}>
              <Plus size={16} aria-hidden="true" />
              Create Staff Order
            </Button>
          )}
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

      {staffOrderCreated && (
        <div className="pilaw-notice pilaw-staff-created" role="status">
          <p>
            Staff-assisted order{" "}
            <strong>{staffOrderCreated.reference}</strong> created for{" "}
            {formatPeso(staffOrderCreated.totalAmount)}. Status:{" "}
            {PAYMENT_STATUS_LABELS[staffOrderCreated.paymentStatus]}.
          </p>
          {staffOrderWarning && (
            <p className="pilaw-inline-error" role="alert">
              {staffOrderWarning}
            </p>
          )}
          <div className="pilaw-embedded-form-actions">
            <Button variant="secondary" onClick={() => void copyStaffReference()}>
              Copy reference
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setStaffOrderCreated(null);
                setStaffOrderWarning("");
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
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
                  <th scope="col">Source</th>
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
                      <span className={`pilaw-status pilaw-source-${order.source}`}>
                        {order.source === "staff" ? "Staff-assisted" : "Online"}
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
      </p>

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

      <Modal
        open={staffOrderOpen}
        title="Create staff-assisted order"
        onClose={closeStaffOrderDialog}
      >
        <div className="pilaw-embedded-form">
          <h3>Customer information</h3>
          <label>
            Customer name (required)
            <Input
              value={staffDraft.customerName}
              maxLength={120}
              placeholder="Name used by the buyer"
              onChange={(event) =>
                setStaffDraft((draft) => ({
                  ...draft,
                  customerName: event.target.value,
                }))
              }
              disabled={staffOrderSubmitting}
            />
          </label>
          <label>
            Mobile number (optional)
            <Input
              type="tel"
              inputMode="tel"
              value={staffDraft.mobile}
              maxLength={32}
              placeholder="09XX XXX XXXX"
              onChange={(event) =>
                setStaffDraft((draft) => ({
                  ...draft,
                  mobile: event.target.value,
                }))
              }
              disabled={staffOrderSubmitting}
            />
          </label>
          <label>
            Staff notes (optional)
            <Input
              value={staffDraft.notes}
              maxLength={1000}
              placeholder="e.g. Ordered through Facebook Messenger"
              onChange={(event) =>
                setStaffDraft((draft) => ({
                  ...draft,
                  notes: event.target.value,
                }))
              }
              disabled={staffOrderSubmitting}
            />
          </label>

          <h3>Order items</h3>
          <p className="pilaw-detail-note">
            Choose the product, colour, size, and quantity, then add it to the
            order. Prices always come from the official product catalogue.
          </p>
          <div className="merch-grid">
            {SHOP_ITEMS.map((item) => (
              <MerchandiseCard
                key={item.id}
                item={item}
                ordersEnabled
                disabled={
                  staffOrderSubmitting || staffDraft.items.length >= 20
                }
                onAddItem={(newItem) =>
                  setStaffDraft((draft) => ({
                    ...draft,
                    items: [...draft.items, newItem],
                  }))
                }
              />
            ))}
          </div>
          <OrderLineItemsEditor
            items={staffDraft.items}
            onChange={(items) =>
              setStaffDraft((draft) => ({ ...draft, items }))
            }
            disabled={staffOrderSubmitting}
            idPrefix="staff-order"
          />

          <h3>Payment information</h3>
          <label>
            Payment method
            <Select
              value={staffPaymentMethod}
              onChange={(event) =>
                changeStaffPaymentMethod(
                  event.target.value as StaffPaymentMethod,
                )
              }
              disabled={staffOrderSubmitting}
            >
              <option value="unpaid">Unpaid — Awaiting Payment</option>
              <option value="gcash" disabled={gcashOption.disabled}>
                GCash — receipt received
              </option>
              <option value="cash" disabled={cashOption.disabled}>
                Cash — already received
              </option>
            </Select>
          </label>

          {gcashOption.hint && (
            <p className="pilaw-detail-note">{gcashOption.hint}</p>
          )}
          {cashOption.hint && (
            <p className="pilaw-detail-note">{cashOption.hint}</p>
          )}

          {staffPaymentMethod === "gcash" && (
            <>
              <label>
                GCash transaction reference (required)
                <Input
                  value={staffPaymentReference}
                  maxLength={120}
                  placeholder="Reference shown on the buyer's receipt"
                  onChange={(event) =>
                    setStaffPaymentReference(event.target.value)
                  }
                  disabled={staffOrderSubmitting}
                />
              </label>
              <label>
                GCash receipt screenshot/PDF (required)
                <input
                  ref={staffEvidenceInputRef}
                  type="file"
                  accept={STAFF_EVIDENCE_TYPES}
                  onChange={(event) =>
                    setStaffEvidenceFile(event.target.files?.[0] ?? null)
                  }
                  disabled={staffOrderSubmitting}
                />
              </label>
              <p className="pilaw-detail-note">
                The receipt only moves the order to Payment Verification. A
                staff member must still confirm the actual transaction before the
                order is marked Paid.
              </p>
            </>
          )}

          {staffPaymentMethod === "cash" && (
            <>
              <p className="pilaw-detail-note">
                Record cash only after you have physically received it. This
                marks the order Paid and records your staff account as the
                confirmer.
              </p>
              <label>
                Cash note (optional)
                <Input
                  value={staffCashNote}
                  maxLength={1000}
                  placeholder="e.g. Received at the church office"
                  onChange={(event) => setStaffCashNote(event.target.value)}
                  disabled={staffOrderSubmitting}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={staffCashConfirmed}
                  onChange={(event) =>
                    setStaffCashConfirmed(event.target.checked)
                  }
                  disabled={staffOrderSubmitting}
                />
                <span>I have physically received the cash for this order.</span>
              </label>
              {!staffCashConfirmed && (
                <p className="pilaw-detail-note">
                  Select the confirmation above to enable Create staff order.
                </p>
              )}
            </>
          )}

          {staffPaymentMethod === "unpaid" && (
            <p className="pilaw-detail-note">
              The order stays Awaiting Payment. The buyer can submit GCash
              evidence later using the order reference and mobile number.
            </p>
          )}

          {staffOrderError && (
            <p className="pilaw-inline-error" role="alert">
              {staffOrderError}
            </p>
          )}

          <div className="pilaw-embedded-form-actions">
            <Button
              onClick={() => void submitStaffOrder()}
              disabled={staffOrderSubmitting || staffPaymentBlocked}
            >
              {staffOrderSubmitting ? "Creating..." : "Create staff order"}
            </Button>
            <Button
              variant="secondary"
              onClick={closeStaffOrderDialog}
              disabled={staffOrderSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
