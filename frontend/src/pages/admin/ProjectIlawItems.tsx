import { useCallback, useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/Modal";
import Select from "../../components/ui/Select";
import { useAuth } from "../../features/auth/auth";

import {
  adjustProjectIlawProduction,
  getProjectIlawProductionHistory,
  getProjectIlawProductionOverview,
  getProjectIlawProductionQueue,
  getProjectIlawProductionReviewFlags,
  getProjectIlawProductionVariants,
  moveProjectIlawProduction,
  resolveProjectIlawProductionReview,
} from "../../features/fundraising/orderService";
import "./ProjectIlawOrders.css";

type Tab = "overview" | "products" | "queue" | "history";

const STAGES = ["pending", "processing", "manufacturing", "completed"] as const;
const STAGE_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  manufacturing: "Printing / Manufacturing",
  completed: "Completed",
};

interface Variant {
  variant_id: string;
  product_type: string;
  size: string;
  color: string;
  required_qty: number;
  pending_qty: number;
  processing_qty: number;
  manufacturing_qty: number;
  completed_qty: number;
  updated_at: string | null;
}

interface Movement {
  id: string;
  variant_id: string;
  product_type: string;
  size: string;
  color: string;
  quantity: number;
  from_stage: string;
  to_stage: string;
  movement_type: string;
  actor_id: string | null;
  note: string | null;
  order_id: string | null;
  created_at: string;
}

export default function ProjectIlawItems() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("project_ilaw.production.view");
  const canManage = hasPermission("project_ilaw.production.manage");

  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<any>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [queue, setQueue] = useState<Variant[]>([]);
  const [history, setHistory] = useState<Movement[]>([]);
  const [reviewFlags, setReviewFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Move dialog state.
  const [moveVariant, setMoveVariant] = useState<Variant | null>(null);
  const [moveQty, setMoveQty] = useState("");
  const [moveFrom, setMoveFrom] = useState("pending");
  const [moveTo, setMoveTo] = useState("processing");
  const [moveReason, setMoveReason] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);

  // Adjust dialog state.
  const [adjustVariant, setAdjustVariant] = useState<Variant | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError("");
    try {
      const [ov, vs, q, hist, flags] = await Promise.all([
        getProjectIlawProductionOverview(),
        getProjectIlawProductionVariants(),
        getProjectIlawProductionQueue(),
        getProjectIlawProductionHistory(50),
        canManage ? getProjectIlawProductionReviewFlags() : Promise.resolve([]),
      ]);
      setOverview(ov);
      setVariants(Array.isArray(vs) ? vs : []);
      setQueue(Array.isArray(q) ? q : []);
      setHistory(Array.isArray(hist) ? hist : []);
      setReviewFlags(Array.isArray(flags) ? flags : []);
    } catch {
      setError("Item Management data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [canView, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleMove() {
    if (!moveVariant || moveBusy) return;
    const qty = Number(moveQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a positive quantity.");
      return;
    }
    const fromIdx = STAGES.indexOf(moveFrom as any);
    const toIdx = STAGES.indexOf(moveTo as any);
    if (Math.abs(fromIdx - toIdx) !== 1) {
      setError("Only adjacent stage movements are allowed.");
      return;
    }
    if (toIdx < fromIdx && !moveReason.trim()) {
      setError("A reason is required for backward movements.");
      return;
    }
    setMoveBusy(true);
    setError("");
    try {
      await moveProjectIlawProduction(
        moveVariant.variant_id,
        qty,
        moveFrom,
        moveTo,
        moveReason.trim() || null,
      );
      setMoveVariant(null);
      setMoveQty("");
      setMoveReason("");
      await load();
    } catch {
      setError("Movement could not be recorded. Check quantities and try again.");
    } finally {
      setMoveBusy(false);
    }
  }

  async function handleAdjust() {
    if (!adjustVariant || adjustBusy) return;
    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      setError("Enter a non-zero quantity.");
      return;
    }
    if (!adjustReason.trim()) {
      setError("A reason is required for manual adjustments.");
      return;
    }
    setAdjustBusy(true);
    setError("");
    try {
      await adjustProjectIlawProduction(adjustVariant.variant_id, delta, adjustReason.trim());
      setAdjustVariant(null);
      setAdjustDelta("");
      setAdjustReason("");
      await load();
    } catch {
      setError("Adjustment could not be recorded.");
    } finally {
      setAdjustBusy(false);
    }
  }

  async function handleResolveFlag(flag: any) {
    const qty = Number(window.prompt(`Quantity to remove (max ${flag.quantity}):`, String(flag.quantity)));
    if (!Number.isFinite(qty) || qty <= 0 || qty > flag.quantity) return;
    const note = window.prompt("Resolution note (optional):", "") ?? "";
    try {
      await resolveProjectIlawProductionReview(flag.id, qty, note || null);
      await load();
    } catch {
      setError("Review flag could not be resolved.");
    }
  }

  if (!canView) {
    return (
      <div className="pilaw-orders-page">
        <p className="pilaw-state">You do not have permission to view Item Management.</p>
      </div>
    );
  }

  const productLabel = (v: Variant) =>
    v.product_type === "t_shirt" ? "Project Ilaw T-shirt" : "Project Ilaw Eco Bag";

  return (
    <div className="pilaw-orders-page">
      <header className="pilaw-orders-header">
        <div>
          <p className="pilaw-eyebrow">Project Ilaw</p>
          <h1>Project Ilaw — Item Management</h1>
          <p>
            Track production quantities, variants, and manufacturing progress.
            Production requirements are derived from paid, non-cancelled orders.
          </p>
        </div>
        <div className="pilaw-orders-actions">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCcw size={16} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <p className="pilaw-error" role="alert">
          {error}
        </p>
      )}

      <nav className="pilaw-tabs" aria-label="Item Management sections">
        {(["overview", "products", "queue", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "pilaw-tab pilaw-tab-active" : "pilaw-tab"}
            onClick={() => setTab(t)}
          >
            {t === "overview" && "Overview"}
            {t === "products" && "Products"}
            {t === "queue" && "Production Queue"}
            {t === "history" && "History"}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="pilaw-state">Loading Item Management...</p>
      ) : (
        <>
          {tab === "overview" && overview && (
            <section className="pilaw-summary" aria-label="Production summary">
              <article>
                <span>Total required</span>
                <strong>{overview.total_required}</strong>
                <small>All paid, non-cancelled orders</small>
              </article>
              <article>
                <span>Pending</span>
                <strong>{overview.pending}</strong>
                <small>Awaiting production</small>
              </article>
              <article>
                <span>Processing</span>
                <strong>{overview.processing}</strong>
                <small>In progress</small>
              </article>
              <article>
                <span>Printing / Manufacturing</span>
                <strong>{overview.manufacturing}</strong>
                <small>Being produced</small>
              </article>
              <article>
                <span>Completed</span>
                <strong>{overview.completed}</strong>
                <small>Finished units</small>
              </article>
            </section>
          )}

          {tab === "overview" && (
            <section className="pilaw-panel" aria-label="Product summary">
              <h2>Product-level summary</h2>
              {["t_shirt", "eco_bag"].map((pt) => {
                const vs = variants.filter((v) => v.product_type === pt);
                const totals = vs.reduce(
                  (acc, v) => ({
                    required: acc.required + v.required_qty,
                    pending: acc.pending + v.pending_qty,
                    processing: acc.processing + v.processing_qty,
                    manufacturing: acc.manufacturing + v.manufacturing_qty,
                    completed: acc.completed + v.completed_qty,
                  }),
                  { required: 0, pending: 0, processing: 0, manufacturing: 0, completed: 0 },
                );
                return (
                  <div key={pt} className="pilaw-breakdown-card" style={{ marginBottom: 12 }}>
                    <h3>{pt === "t_shirt" ? "Project Ilaw T-shirt" : "Project Ilaw Eco Bag"}</h3>
                    <p>
                      Required {totals.required} · Pending {totals.pending} · Processing{" "}
                      {totals.processing} · Manufacturing {totals.manufacturing} · Completed{" "}
                      {totals.completed}
                    </p>
                  </div>
                );
              })}
              {reviewFlags.length > 0 && (
                <div className="pilaw-panel" style={{ marginTop: 16 }}>
                  <h2>Cancellation review required</h2>
                  <ul>
                    {reviewFlags.map((f) => (
                      <li key={f.id}>
                        {f.product_type} · {f.size} · {f.color} — {f.quantity} unit(s) need review
                        {canManage && (
                          <Button
                            variant="secondary"
                            onClick={() => void handleResolveFlag(f)}
                            style={{ marginLeft: 8 }}
                          >
                            Resolve
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {tab === "products" && (
            <section className="pilaw-panel" aria-label="Products">
              <h2>Product variants</h2>
              <div className="pilaw-table-wrap">
                <table className="pilaw-table">
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col">Size</th>
                      <th scope="col">Colour</th>
                      <th scope="col">Required</th>
                      <th scope="col">Pending</th>
                      <th scope="col">Processing</th>
                      <th scope="col">Manufacturing</th>
                      <th scope="col">Completed</th>
                      {canManage && <th scope="col">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.variant_id}>
                        <td>{productLabel(v)}</td>
                        <td>{v.size}</td>
                        <td>{v.color}</td>
                        <td>{v.required_qty}</td>
                        <td>{v.pending_qty}</td>
                        <td>{v.processing_qty}</td>
                        <td>{v.manufacturing_qty}</td>
                        <td>{v.completed_qty}</td>
                        {canManage && (
                          <td>
                            <div className="pilaw-row-actions">
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setMoveVariant(v);
                                  setMoveQty("");
                                  setMoveFrom("pending");
                                  setMoveTo("processing");
                                  setMoveReason("");
                                }}
                              >
                                Move
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setAdjustVariant(v);
                                  setAdjustDelta("");
                                  setAdjustReason("");
                                }}
                              >
                                Adjust
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "queue" && (
            <section className="pilaw-panel" aria-label="Production queue">
              <h2>Production queue</h2>
              {queue.length === 0 ? (
                <p className="pilaw-state">No variants require production.</p>
              ) : (
                <div className="pilaw-table-wrap">
                  <table className="pilaw-table">
                    <thead>
                      <tr>
                        <th scope="col">Product</th>
                        <th scope="col">Size</th>
                        <th scope="col">Colour</th>
                        <th scope="col">Required</th>
                        <th scope="col">Pending</th>
                        <th scope="col">Processing</th>
                        <th scope="col">Manufacturing</th>
                        <th scope="col">Completed</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((v) => (
                        <tr key={v.variant_id}>
                          <td>{productLabel(v)}</td>
                          <td>{v.size}</td>
                          <td>{v.color}</td>
                          <td>{v.required_qty}</td>
                          <td>{v.pending_qty}</td>
                          <td>{v.processing_qty}</td>
                          <td>{v.manufacturing_qty}</td>
                          <td>{v.completed_qty}</td>
                          <td>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setMoveVariant(v);
                                setMoveQty("");
                                setMoveFrom("pending");
                                setMoveTo("processing");
                                setMoveReason("");
                              }}
                            >
                              Move
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === "history" && (
            <section className="pilaw-panel" aria-label="Production history">
              <h2>Production history</h2>
              {history.length === 0 ? (
                <p className="pilaw-state">No production activity recorded yet.</p>
              ) : (
                <div className="pilaw-table-wrap">
                  <table className="pilaw-table">
                    <thead>
                      <tr>
                        <th scope="col">Date / time</th>
                        <th scope="col">Product</th>
                        <th scope="col">Size</th>
                        <th scope="col">Colour</th>
                        <th scope="col">Qty</th>
                        <th scope="col">From</th>
                        <th scope="col">To</th>
                        <th scope="col">Type</th>
                        <th scope="col">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((m) => (
                        <tr key={m.id}>
                          <td>{new Date(m.created_at).toLocaleString()}</td>
                          <td>
                            {m.product_type === "t_shirt" ? "T-shirt" : "Eco Bag"}
                          </td>
                          <td>{m.size}</td>
                          <td>{m.color}</td>
                          <td>{m.quantity}</td>
                          <td>{m.from_stage}</td>
                          <td>{m.to_stage}</td>
                          <td>{m.movement_type}</td>
                          <td>{m.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Move dialog */}
      <Modal open={Boolean(moveVariant)} title="Move quantities" onClose={() => setMoveVariant(null)}>
        {moveVariant && (
          <div className="pilaw-embedded-form">
            <p>
              {productLabel(moveVariant)} · {moveVariant.size} · {moveVariant.color}
            </p>
            <p>
              Pending {moveVariant.pending_qty} · Processing {moveVariant.processing_qty} ·
              Manufacturing {moveVariant.manufacturing_qty} · Completed {moveVariant.completed_qty}
            </p>
            <label>
              Quantity
              <Input
                type="number"
                min={1}
                value={moveQty}
                onChange={(e) => setMoveQty(e.target.value)}
                disabled={moveBusy}
              />
            </label>
            <label>
              From
              <Select value={moveFrom} onChange={(e) => setMoveFrom(e.target.value)} disabled={moveBusy}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              To
              <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} disabled={moveBusy}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Reason (required for backward moves)
              <Input
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                disabled={moveBusy}
              />
            </label>
            <div className="pilaw-embedded-form-actions">
              <Button onClick={() => void handleMove()} disabled={moveBusy}>
                {moveBusy ? "Moving..." : "Move"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Adjust dialog */}
      <Modal open={Boolean(adjustVariant)} title="Manual adjustment" onClose={() => setAdjustVariant(null)}>
        {adjustVariant && (
          <div className="pilaw-embedded-form">
            <p>
              {productLabel(adjustVariant)} · {adjustVariant.size} · {adjustVariant.color}
            </p>
            <p>Use positive to add, negative to remove.</p>
            <label>
              Quantity (+/-)
              <Input
                type="number"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                disabled={adjustBusy}
              />
            </label>
            <label>
              Reason (required)
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                disabled={adjustBusy}
              />
            </label>
            <div className="pilaw-embedded-form-actions">
              <Button onClick={() => void handleAdjust()} disabled={adjustBusy}>
                {adjustBusy ? "Saving..." : "Apply adjustment"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
