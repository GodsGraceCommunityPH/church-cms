import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  RefreshCcw,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
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
  getProjectIlawExportRows,
  getProjectIlawOrders,
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
    .map((item) =>
      item.productType === "t_shirt"
        ? `${item.productName} (${item.size}) ×${item.quantity}`
        : `${item.productName} ×${item.quantity}`,
    )
    .join(", ");
}

export default function ProjectIlawOrders() {
  const { hasPermission } = useAuth();
  const canExport = hasPermission("project_ilaw.orders.export");
  const [orders, setOrders] = useState<ProjectIlawOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] =
    useState<ProjectIlawOrderFilters>(EMPTY_FILTERS);

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

  const filtered = useMemo(
    () => filterProjectIlawOrders(orders, filters),
    [filters, orders],
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

  return (
    <div className="pilaw-orders-page">
      <header className="pilaw-orders-header">
        <div>
          <p className="pilaw-eyebrow">Project Ilaw</p>
          <h1>Project Ilaw Orders</h1>
          <p>
            Manage customer orders, manually confirm payments, and track
            fulfilment and production quantities.
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
          <span>Orders awaiting payment</span>
          <strong>{summary.awaitingPaymentOrders}</strong>
          <small>Cancelled orders are excluded</small>
        </article>
        <article>
          <span>Payments confirmed</span>
          <strong>{summary.paymentConfirmedOrders}</strong>
          <small>Manually confirmed by staff</small>
        </article>
        <article>
          <span>Total expected sales</span>
          <strong>{formatPeso(summary.expectedSales)}</strong>
          <small>Cancelled orders are excluded</small>
        </article>
        <article className="pilaw-summary-collections">
          <span>Total confirmed collections</span>
          <strong>{formatPeso(summary.confirmedCollections)}</strong>
          <small>Payment-confirmed orders only</small>
        </article>
      </section>

      {summary.cancelledPaidOrders > 0 && (
        <p className="pilaw-accounting-note" role="note">
          {summary.cancelledPaidOrders} cancelled order
          {summary.cancelledPaidOrders === 1 ? " was" : "s were"} already
          payment-confirmed ({formatPeso(summary.cancelledPaidAmount)}). They
          remain in confirmed collections and are not treated as refunds.
        </p>
      )}

      <section className="pilaw-breakdown" aria-label="Quantity breakdown">
        <div className="pilaw-breakdown-card">
          <div className="pilaw-breakdown-heading">
            <ShoppingBag size={18} aria-hidden="true" />
            <h2>Product quantities</h2>
          </div>
          <div className="pilaw-product-quantities">
            <div>
              <span>Project Ilaw T-shirt</span>
              <strong>{summary.tshirtQuantity}</strong>
            </div>
            <div>
              <span>Project Ilaw Eco Bag</span>
              <strong>{summary.ecoBagQuantity}</strong>
            </div>
            <div className="pilaw-muted-quantity">
              <span>Cancelled units</span>
              <strong>
                T-shirt {summary.cancelledTshirtQuantity} · Eco Bag{" "}
                {summary.cancelledEcoBagQuantity}
              </strong>
            </div>
          </div>
        </div>

        <div className="pilaw-breakdown-card">
          <div className="pilaw-breakdown-heading">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <h2>T-shirt sizes</h2>
          </div>
          <ul className="pilaw-size-list">
            {["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((size) => (
              <li key={size}>
                <span>{size}</span>
                <strong>{summary.sizeQuantities[size] ?? 0}</strong>
              </li>
            ))}
          </ul>
          <p className="pilaw-breakdown-footnote">
            {summary.completedUnits} unit
            {summary.completedUnits === 1 ? "" : "s"} in completed orders.
          </p>
        </div>
      </section>

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
            onClick={() => setFilters(EMPTY_FILTERS)}
            disabled={filters === EMPTY_FILTERS}
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
            <ShoppingBag size={38} aria-hidden="true" />
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
                  <th scope="col">Products and sizes</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Payment status</th>
                  <th scope="col">Fulfillment status</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="pilaw-accounting-footnote">
        Expected sales exclude cancelled orders. Confirmed collections include
        only payment-confirmed orders. A cancelled order that was already paid
        stays visible in the records and CSV export and is not automatically
        treated as a refund.
      </p>
    </div>
  );
}
