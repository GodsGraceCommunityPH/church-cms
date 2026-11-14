import { useCallback, useEffect, useMemo, useState } from "react";
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
const STAGES = ["processing", "manufacturing", "completed"] as const;
const STAGE_LABELS: Record<string, string> = {
  processing: "Processing",
  manufacturing: "Printing / Manufacturing",
  completed: "Completed",
};

const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
const TSHIRT_COLORS = ["Black", "White", "Maroon", "Green", "Blue"];
const ECOBAG_COLORS = ["Maroon", "Green", "Blue"];
const MOVEMENT_TYPES = [
  "forward",
  "backward",
  "auto_add",
  "auto_deduct",
  "manual_add",
  "manual_remove",
  "review_adjustment",
];

interface Variant {
  variant_id: string;
  product_type: string;
  size: string;
  color: string;
  required_qty: number;
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

const productLabel = (pt: string) =>
  pt === "t_shirt" ? "Project Ilaw T-shirt" : "Project Ilaw Eco Bag";



export default function ProjectIlawItems() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("project_ilaw.production.view");
  const canManage = hasPermission("project_ilaw.production.manage");
  const canMove = hasPermission("project_ilaw.production.move");

  const [tab, setTab] = useState<Tab>("overview");
  const [selectedStage, setSelectedStage] = useState<(typeof STAGES)[number] | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [queue, setQueue] = useState<Variant[]>([]);
  const [history, setHistory] = useState<Movement[]>([]);
  const [reviewFlags, setReviewFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Product filters.
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterSize, setFilterSize] = useState("all");
  const [filterColor, setFilterColor] = useState("all");
  const [showZero, setShowZero] = useState(false);
  const [showAllVariants, setShowAllVariants] = useState(false);

  // History filters.
  const [histProduct, setHistProduct] = useState("all");
  const [histType, setHistType] = useState("all");
  const [histFrom, setHistFrom] = useState("");
  const [histTo, setHistTo] = useState("");

  // Move dialog.
  const [moveVariant, setMoveVariant] = useState<Variant | null>(null);
  const [moveQty, setMoveQty] = useState("");
  const [moveFrom, setMoveFrom] = useState<string>("processing");
  const [moveTo, setMoveTo] = useState<string>("manufacturing");
  const [moveReason, setMoveReason] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);

  // Adjust dialog.
  const [adjustVariant, setAdjustVariant] = useState<Variant | null>(null);
  const [adjustMode, setAdjustMode] = useState<"add" | "remove">("add");
  const [adjustQty, setAdjustQty] = useState("");
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
        getProjectIlawProductionHistory(100),
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

  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      if (filterProduct !== "all" && v.product_type !== filterProduct) return false;
      if (filterSize !== "all" && v.size !== filterSize) return false;
      if (filterColor !== "all" && v.color !== filterColor) return false;
      if (!showZero && v.required_qty === 0 && !showAllVariants) return false;
      return true;
    });
  }, [variants, filterProduct, filterSize, filterColor, showZero, showAllVariants]);

  const filteredStageVariants = useMemo(() => {
    if (!selectedStage) return [];
    return variants.filter((v) => {
      if (filterProduct !== "all" && v.product_type !== filterProduct) return false;
      if (filterSize !== "all" && v.size !== filterSize) return false;
      if (filterColor !== "all" && v.color !== filterColor) return false;
      const stageQty = selectedStage === "processing" ? v.processing_qty
        : selectedStage === "manufacturing" ? v.manufacturing_qty
        : v.completed_qty;
      return stageQty > 0;
    });
  }, [variants, selectedStage, filterProduct, filterSize, filterColor]);

  const filteredQueue = useMemo(() => {
    return queue.filter((v) => {
      if (filterProduct !== "all" && v.product_type !== filterProduct) return false;
      if (filterSize !== "all" && v.size !== filterSize) return false;
      if (filterColor !== "all" && v.color !== filterColor) return false;
      return true;
    });
  }, [queue, filterProduct, filterSize, filterColor]);

  const filteredHistory = useMemo(() => {
    return history.filter((m) => {
      if (histProduct !== "all" && m.product_type !== histProduct) return false;
      if (histType !== "all" && m.movement_type !== histType) return false;
      if (histFrom) {
        const d = new Date(m.created_at);
        if (d < new Date(histFrom)) return false;
      }
      if (histTo) {
        const d = new Date(m.created_at);
        if (d > new Date(histTo + "T23:59:59")) return false;
      }
      return true;
    });
  }, [history, histProduct, histType, histFrom, histTo]);

  const productTotals = useMemo(() => {
    const acc: Record<string, { required: number; processing: number; manufacturing: number; completed: number }> = {};
    for (const v of variants) {
      if (!acc[v.product_type]) acc[v.product_type] = { required: 0, processing: 0, manufacturing: 0, completed: 0 };
      acc[v.product_type].required += v.required_qty;
      acc[v.product_type].processing += v.processing_qty;
      acc[v.product_type].manufacturing += v.manufacturing_qty;
      acc[v.product_type].completed += v.completed_qty;
    }
    return acc;
  }, [variants]);

  const resetFilters = () => {
    setFilterProduct("all");
    setFilterSize("all");
    setFilterColor("all");
    setShowZero(false);
    setShowAllVariants(false);
  };

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
    const avail =
      moveFrom === "processing" ? moveVariant.processing_qty
      : moveFrom === "manufacturing" ? moveVariant.manufacturing_qty
      : moveVariant.completed_qty;
    if (qty > avail) {
      setError("Not enough units in the source stage.");
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
      setError("Movement could not be recorded. Check quantities and permissions, then try again.");
    } finally {
      setMoveBusy(false);
    }
  }

  async function handleAdjust() {
    if (!adjustVariant || adjustBusy) return;
    let delta = Number(adjustQty);
    if (!Number.isFinite(delta) || delta === 0) {
      setError("Enter a non-zero quantity.");
      return;
    }
    if (adjustMode === "remove") delta = -Math.abs(delta);
    else delta = Math.abs(delta);
    if (!adjustReason.trim()) {
      setError("A reason is required for manual adjustments.");
      return;
    }
    setAdjustBusy(true);
    setError("");
    try {
      await adjustProjectIlawProduction(adjustVariant.variant_id, delta, adjustReason.trim());
      setAdjustVariant(null);
      setAdjustQty("");
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

  const availableSource = moveVariant
    ? (moveFrom === "processing" ? moveVariant.processing_qty
      : moveFrom === "manufacturing" ? moveVariant.manufacturing_qty
      : moveVariant.completed_qty)
    : 0;

  const resultingAfterMove = moveVariant
    ? {
        from: availableSource - (Number(moveQty) || 0),
        to: (moveTo === "processing" ? moveVariant.processing_qty
          : moveTo === "manufacturing" ? moveVariant.manufacturing_qty
          : moveVariant.completed_qty) + (Number(moveQty) || 0),
      }
    : { from: 0, to: 0 };

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
            aria-current={tab === t ? "page" : undefined}
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
            <>
              <section className="pilaw-summary" aria-label="Production summary">
                <article>
                  <span>Total required</span>
                  <strong>{overview.total_required}</strong>
                  <small>All paid, non-cancelled orders</small>
                </article>
                {STAGES.map((stage) => {
                  const count = overview[stage === "manufacturing" ? "manufacturing" : stage];
                  const labels: Record<string, string> = {
                    processing: "In progress",
                    manufacturing: "Being produced",
                    completed: "Finished units",
                  };
                  return (
                    <button
                      key={stage}
                      type="button"
                      className="pilaw-summary-stage"
                      onClick={() => {
                        setSelectedStage(stage);
                        resetFilters();
                        setTab("queue");
                      }}
                      aria-label={`View ${count} units in ${STAGE_LABELS[stage]}`}
                    >
                      <span>{STAGE_LABELS[stage]}</span>
                      <strong>{count}</strong>
                      <small>{labels[stage]} · View and move items</small>
                    </button>
                  );
                })}
              </section>

              <section className="pilaw-panel" aria-label="Product summary">
                <h2>Product-level summary</h2>
                {["t_shirt", "eco_bag"].map((pt) => {
                  const t = productTotals[pt] ?? { required: 0, processing: 0, manufacturing: 0, completed: 0 };
                  const pct = t.required > 0 ? Math.round((t.completed / t.required) * 100) : 0;
                  return (
                    <div key={pt} className="pilaw-breakdown-card" style={{ marginBottom: 12 }}>
                      <h3>{pt === "t_shirt" ? "Project Ilaw T-shirt" : "Project Ilaw Eco Bag"}</h3>
                      <p>
                        Required {t.required} · Processing {t.processing} ·
                        Manufacturing {t.manufacturing} · Completed {t.completed}
                      </p>
                      <div style={{ background: "#e5e7eb", borderRadius: 4, height: 8, marginTop: 8 }}>
                        <div
                          style={{
                            background: "#4ade80",
                            borderRadius: 4,
                            height: 8,
                            width: `${pct}%`,
                          }}
                        />
                      </div>
                      <small>{pct}% complete</small>
                    </div>
                  );
                })}
              </section>

              {reviewFlags.length > 0 && (
                <section className="pilaw-panel" aria-label="Cancellation review">
                  <h2>Cancellation review required</h2>
                  <ul>
                    {reviewFlags.map((f) => (
                      <li key={f.id} style={{ marginBottom: 8 }}>
                        {f.product_type === "t_shirt" ? "T-shirt" : "Eco Bag"} · {f.size} · {f.color} —{" "}
                        {f.quantity} unit(s) need review
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
                </section>
              )}
            </>
          )}

          {(tab === "products" || tab === "queue") && (
            <section className="pilaw-panel" aria-label="Filters">
              <div className="pilaw-filters">
                <label>
                  <span>Product</span>
                  <Select value={filterProduct} onChange={(e: any) => setFilterProduct(e.target.value)}>
                    <option value="all">All products</option>
                    <option value="t_shirt">Project Ilaw T-shirt</option>
                    <option value="eco_bag">Project Ilaw Eco Bag</option>
                  </Select>
                </label>
                <label>
                  <span>Size</span>
                  <Select
                    value={filterSize}
                    onChange={(e: any) => setFilterSize(e.target.value)}
                    disabled={filterProduct === "eco_bag"}
                  >
                    <option value="all">All sizes</option>
                    {(filterProduct === "eco_bag" ? ["One Size"] : (filterProduct === "t_shirt" ? TSHIRT_SIZES : [...TSHIRT_SIZES, "One Size"])).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </label>
                <label>
                  <span>Colour</span>
                  <Select value={filterColor} onChange={(e: any) => setFilterColor(e.target.value)}>
                    <option value="all">All colours</option>
                    {(filterProduct === "eco_bag" ? ECOBAG_COLORS : (filterProduct === "t_shirt" ? TSHIRT_COLORS : [...TSHIRT_COLORS, ...ECOBAG_COLORS].filter((v, i, a) => a.indexOf(v) === i))).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </label>
                {tab === "products" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={showZero}
                      onChange={(e) => setShowZero(e.target.checked)}
                    />
                    <span>Show zero-required variants</span>
                  </label>
                )}
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              </div>
            </section>
          )}

          {tab === "products" && (
            <section className="pilaw-panel" aria-label="Products">
              <h2>Products and variants</h2>
              <div className="pilaw-table-wrap">
                <table className="pilaw-table">
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col">Size</th>
                      <th scope="col">Colour</th>
                      <th scope="col">Required</th>
                      <th scope="col">Processing</th>
                      <th scope="col">Manufacturing</th>
                      <th scope="col">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVariants.map((v) => (
                      <tr key={v.variant_id}>
                        <td>{productLabel(v.product_type)}</td>
                        <td>{v.size}</td>
                        <td>{v.color}</td>
                        <td>{v.required_qty}</td>
                        <td>{v.processing_qty}</td>
                        <td>{v.manufacturing_qty}</td>
                        <td>{v.completed_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredVariants.length === 0 && (
                <p className="pilaw-state">No variants match the selected filters.</p>
              )}
            </section>
          )}

          {tab === "queue" && (
            <section className="pilaw-panel" aria-label="Production queue">
              <h2>{selectedStage ? `${STAGE_LABELS[selectedStage]} items` : "Production queue"}</h2>
              {selectedStage && (
                <div className="pilaw-stage-filter-heading">
                  <span>Showing items currently in {STAGE_LABELS[selectedStage]}.</span>
                  <Button variant="secondary" onClick={() => setSelectedStage(null)}>Show full queue</Button>
                </div>
              )}
              {(selectedStage ? filteredStageVariants : filteredQueue).length === 0 ? (
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
                        <th scope="col">Processing</th>
                        <th scope="col">Manufacturing</th>
                        <th scope="col">Completed</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedStage ? filteredStageVariants : filteredQueue).map((v) => (
                        <tr key={v.variant_id}>
                          <td>{productLabel(v.product_type)}</td>
                          <td>{v.size}</td>
                          <td>{v.color}</td>
                          <td>{v.required_qty}</td>
                          <td>{v.processing_qty}</td>
                          <td>{v.manufacturing_qty}</td>
                          <td>{v.completed_qty}</td>
                          <td>
                            <div className="pilaw-row-actions">
                              {canMove && (
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setMoveVariant(v);
                                  setMoveQty("");
                                  const sourceStage = selectedStage ?? (v.processing_qty > 0 ? "processing" : v.manufacturing_qty > 0 ? "manufacturing" : "completed");
                                  const sourceIndex = STAGES.indexOf(sourceStage);
                                  const destinationStage = sourceIndex < STAGES.length - 1 ? STAGES[sourceIndex + 1] : STAGES[sourceIndex - 1];
                                  setMoveFrom(sourceStage);
                                  setMoveTo(destinationStage);
                                  setMoveReason("");
                                }}
                              >
                                Move Quantities
                              </Button>
                              )}
                              {canManage && (
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setAdjustVariant(v);
                                    setAdjustQty("");
                                    setAdjustReason("");
                                    setAdjustMode("add");
                                  }}
                                >
                                  Adjust
                                </Button>
                              )}
                            </div>
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
              <div className="pilaw-filters">
                <label>
                  <span>Product</span>
                  <Select value={histProduct} onChange={(e: any) => setHistProduct(e.target.value)}>
                    <option value="all">All products</option>
                    <option value="t_shirt">T-shirt</option>
                    <option value="eco_bag">Eco Bag</option>
                  </Select>
                </label>
                <label>
                  <span>Movement type</span>
                  <Select value={histType} onChange={(e: any) => setHistType(e.target.value)}>
                    <option value="all">All types</option>
                    {MOVEMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </label>
                <label>
                  <span>From</span>
                  <Input type="date" value={histFrom} onChange={(e: any) => setHistFrom(e.target.value)} />
                </label>
                <label>
                  <span>To</span>
                  <Input type="date" value={histTo} onChange={(e: any) => setHistTo(e.target.value)} />
                </label>
              </div>
              {filteredHistory.length === 0 ? (
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
                      {filteredHistory.map((m) => (
                        <tr key={m.id}>
                          <td>{new Date(m.created_at).toLocaleString()}</td>
                          <td>{m.product_type === "t_shirt" ? "T-shirt" : "Eco Bag"}</td>
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
              <strong>{productLabel(moveVariant.product_type)}</strong> · {moveVariant.size} · {moveVariant.color}
            </p>
            <p>
              Processing {moveVariant.processing_qty} · Manufacturing {moveVariant.manufacturing_qty} · Completed {moveVariant.completed_qty}
            </p>
            <label>
              Quantity
              <Input
                type="number"
                min={1}
                value={moveQty}
                onChange={(e: any) => setMoveQty(e.target.value)}
                disabled={moveBusy}
              />
            </label>
            <label>
              From
              <Select value={moveFrom} onChange={(e: any) => setMoveFrom(e.target.value)} disabled={moveBusy}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              To
              <Select value={moveTo} onChange={(e: any) => setMoveTo(e.target.value)} disabled={moveBusy}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Reason (required for backward moves)
              <Input value={moveReason} onChange={(e: any) => setMoveReason(e.target.value)} disabled={moveBusy} />
            </label>
            <p className="pilaw-detail-note">
              Resulting: source {resultingAfterMove.from}, destination {resultingAfterMove.to}
            </p>
            <div className="pilaw-embedded-form-actions">
              <Button onClick={() => void handleMove()} disabled={moveBusy}>
                {moveBusy ? "Moving..." : "Move"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Adjust dialog */}
      <Modal open={Boolean(adjustVariant)} title="Manual adjustment (admin)" onClose={() => setAdjustVariant(null)}>
        {adjustVariant && (
          <div className="pilaw-embedded-form">
            <p>
              <strong>{productLabel(adjustVariant.product_type)}</strong> · {adjustVariant.size} · {adjustVariant.color}
            </p>
            <label>
              Type
              <Select value={adjustMode} onChange={(e: any) => setAdjustMode(e.target.value)} disabled={adjustBusy}>
                <option value="add">Add</option>
                <option value="remove">Remove</option>
              </Select>
            </label>
            <label>
              Quantity
              <Input
                type="number"
                min={1}
                value={adjustQty}
                onChange={(e: any) => setAdjustQty(e.target.value)}
                disabled={adjustBusy}
              />
            </label>
            <label>
              Reason (required)
              <Input value={adjustReason} onChange={(e: any) => setAdjustReason(e.target.value)} disabled={adjustBusy} />
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
