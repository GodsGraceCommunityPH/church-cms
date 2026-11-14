import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCcw, ShoppingBag, CreditCard, Package, ClipboardList } from "lucide-react";
import Button from "../../components/ui/Button";
import { useAuth } from "../../features/auth/auth";
import { getProjectIlawOrders, getProjectIlawProductionOverview, getProjectIlawProductionVariants } from "../../features/fundraising/orderService";
import { buildOrderSummary } from "../../features/fundraising/orderAccounting";
import type { ProjectIlawOrder } from "../../features/fundraising/projectIlaw";
import "./ProjectIlawOrders.css";

type ProductionOverview = { total_required: number; processing: number; manufacturing: number; completed: number };
type Variant = { product_type: string; required_qty: number; processing_qty: number; manufacturing_qty: number; completed_qty: number };
const fmt = (n: number) => Number(n || 0).toLocaleString();
const php = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n || 0);

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof ShoppingBag }) {
  return <article className="pilaw-overview-metric"><span className="pilaw-overview-metric-icon"><Icon size={19} /></span><span className="pilaw-overview-metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export default function ProjectIlawOverview() {
  const { hasPermission } = useAuth();
  const canOrders = hasPermission("project_ilaw.orders.view");
  const canProduction = hasPermission("project_ilaw.production.view");
  const [orders, setOrders] = useState<ProjectIlawOrder[]>([]);
  const [production, setProduction] = useState<ProductionOverview | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [o, p, v] = await Promise.all([
        canOrders ? getProjectIlawOrders() : Promise.resolve([]),
        canProduction ? getProjectIlawProductionOverview() : Promise.resolve(null),
        canProduction ? getProjectIlawProductionVariants() : Promise.resolve([]),
      ]);
      setOrders(o); setProduction(p as ProductionOverview | null); setVariants(v as Variant[]);
    } catch {
      setError("Project Ilaw overview data could not be loaded. Please refresh and try again.");
    } finally { setLoading(false); }
  }, [canOrders, canProduction]);

  useEffect(() => { void load(); }, [load]);
  const summary = useMemo(() => buildOrderSummary(orders), [orders]);
  const products = useMemo(() => {
    const totals: Record<string, { required: number; processing: number; manufacturing: number; completed: number }> = {
      t_shirt: { required: 0, processing: 0, manufacturing: 0, completed: 0 },
      eco_bag: { required: 0, processing: 0, manufacturing: 0, completed: 0 },
    };
    variants.forEach(v => {
      const t = totals[v.product_type]; if (!t) return;
      t.required += Number(v.required_qty || 0); t.processing += Number(v.processing_qty || 0);
      t.manufacturing += Number(v.manufacturing_qty || 0); t.completed += Number(v.completed_qty || 0);
    });
    return totals;
  }, [variants]);

  return <div className="pilaw-orders-page pilaw-overview-page">
    <header className="pilaw-orders-header"><div><p className="pilaw-eyebrow">Project Ilaw</p><h1>Project Ilaw Overview</h1><p>One place to monitor orders, payments, and production progress.</p></div>
      <div className="pilaw-orders-actions"><Button variant="secondary" onClick={() => void load()} disabled={loading}><RefreshCcw size={16} /> Refresh</Button></div>
    </header>
    {error && <p className="pilaw-error" role="alert">{error}</p>}
    {loading ? <p className="pilaw-state">Loading Project Ilaw overview...</p> : <>
      {canOrders && <>
        <section className="pilaw-overview-section">
          <div className="pilaw-overview-section-heading"><div><h2>Orders</h2><p>All orders visible to your role</p></div><Link to="/admin/project-ilaw-orders">Open Order Management</Link></div>
          <div className="pilaw-overview-grid">
            <Metric label="Total orders" value={fmt(summary.totalOrders)} detail={fmt(summary.activeUnits) + " active units"} icon={ShoppingBag} />
            <Metric label="Awaiting payment" value={fmt(summary.awaitingPaymentOrders)} detail="Not yet paid" icon={ClipboardList} />
            <Metric label="Payment verification" value={fmt(summary.paymentVerificationOrders)} detail="Receipts awaiting review" icon={CreditCard} />
            <Metric label="Cancelled orders" value={fmt(orders.filter(o => o.fulfillmentStatus === "cancelled").length)} detail={fmt(summary.cancelledUnits) + " cancelled units"} icon={ShoppingBag} />
          </div>
        </section>
        <section className="pilaw-overview-section">
          <div className="pilaw-overview-section-heading"><div><h2>Payments</h2><p>Payment status and recorded collections</p></div><Link to="/admin/project-ilaw-orders">Review payments</Link></div>
          <div className="pilaw-overview-grid">
            <Metric label="Paid orders" value={fmt(summary.paidOrders)} detail="Marked as paid" icon={CreditCard} />
            <Metric label="Recorded collections" value={php(summary.confirmedCollections)} detail="Includes paid orders later cancelled" icon={CreditCard} />
            <Metric label="Expected sales" value={php(summary.expectedSales)} detail="Excludes cancelled orders" icon={CreditCard} />
            <Metric label="Paid but cancelled" value={fmt(summary.cancelledPaidOrders)} detail={php(summary.cancelledPaidAmount) + " recorded"} icon={CreditCard} />
          </div>
        </section>
      </>}
      {canProduction && production && <section className="pilaw-overview-section">
        <div className="pilaw-overview-section-heading"><div><h2>Production</h2><p>Requirements come from paid, non-cancelled orders</p></div><Link to="/admin/project-ilaw-items">Open Item Management</Link></div>
        <div className="pilaw-overview-grid pilaw-overview-grid-four">
          <Metric label="Total required" value={fmt(production.total_required)} detail="Units to produce" icon={Package} />
          <Metric label="Processing" value={fmt(production.processing)} detail="In progress" icon={Package} />
          <Metric label="Printing / Manufacturing" value={fmt(production.manufacturing)} detail="Being produced" icon={Package} />
          <Metric label="Completed" value={fmt(production.completed)} detail="Finished units" icon={Package} />
        </div>
        <div className="pilaw-overview-products">{(["t_shirt", "eco_bag"] as const).map(key => {
          const t = products[key]; const pct = t.required ? Math.round(t.completed / t.required * 100) : 0;
          return <article className="pilaw-overview-product" key={key}>
            <div className="pilaw-overview-product-heading"><h3>{key === "t_shirt" ? "Project Ilaw T-shirt" : "Project Ilaw Eco Bag"}</h3><strong>{pct}% complete</strong></div>
            <div className="pilaw-overview-product-stats"><span>Required <b>{fmt(t.required)}</b></span><span>Processing <b>{fmt(t.processing)}</b></span><span>Manufacturing <b>{fmt(t.manufacturing)}</b></span><span>Completed <b>{fmt(t.completed)}</b></span></div>
            <div className="pilaw-product-summary-progress" role="progressbar" aria-label={key === "t_shirt" ? "T-shirt completion" : "Eco Bag completion"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: pct + "%" }} /></div>
          </article>;
        })}</div>
      </section>}
    </>}
  </div>;
}
