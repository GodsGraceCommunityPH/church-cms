import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Boxes, PackageCheck, RotateCcw, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { useAuth } from "../../features/auth/auth";
import { CONDITION_LABELS, type EquipmentCondition, type EquipmentItem } from "../../features/equipment/equipment";
import { getEquipmentItems, restoreEquipmentItem } from "../../features/equipment/equipmentService";

type Sort = "az" | "za" | "recent" | "quantity_desc" | "quantity_asc";
function badgeClass(condition: EquipmentCondition) { return `equipment-badge equipment-badge-${condition}`; }

export default function Equipment() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("equipment.manage");
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [condition, setCondition] = useState("all");
  const [sort, setSort] = useState<Sort>("az");
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await getEquipmentItems()); }
    catch { setError("Equipment data could not be loaded. Please try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const active = items.filter((item) => !item.archivedAt);
  const categories = [...new Set(items.map((item) => item.category))].sort();
  const locations = [...new Set(items.map((item) => item.location).filter(Boolean))].sort();
  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => Boolean(item.archivedAt) === showArchived)
      .filter((item) => !keyword || [item.name, item.category, item.location, item.custodian?.name, item.brand, item.model, item.assetTag, item.serialNumber].some((value) => value?.toLowerCase().includes(keyword)))
      .filter((item) => category === "all" || item.category === category)
      .filter((item) => location === "all" || item.location === location)
      .filter((item) => condition === "all" || item.condition === condition)
      .sort((a, b) => sort === "za" ? b.name.localeCompare(a.name) : sort === "recent" ? b.createdAt.localeCompare(a.createdAt) : sort === "quantity_desc" ? b.quantity - a.quantity : sort === "quantity_asc" ? a.quantity - b.quantity : a.name.localeCompare(b.name));
  }, [category, condition, items, location, search, showArchived, sort]);

  async function restore(id: string) { try { await restoreEquipmentItem(id); await load(); } catch { setError("This item could not be restored."); } }

  return <div className="equipment-page">
    <header className="equipment-header"><div><h1>Equipment &amp; Assets</h1><p>Track church-owned items, their condition, location, and current custodian.</p></div>{canManage && <Button to="/admin/equipment/new">Add Item</Button>}</header>
    <section className="equipment-summary" aria-label="Equipment summary">
      <div><Boxes /><span>Total Items<strong>{active.length}</strong></span></div>
      <div><PackageCheck /><span>Total Quantity<strong>{active.reduce((sum, item) => sum + item.quantity, 0)}</strong></span></div>
      <div><Wrench /><span>Needs Repair<strong>{active.filter((item) => item.condition === "for_repair").length}</strong></span></div>
      <div><Archive /><span>For Replacement<strong>{active.filter((item) => item.condition === "for_replacement").length}</strong></span></div>
    </section>
    <section className="equipment-panel">
      <div className="equipment-toolbar">
        <Input aria-label="Search equipment" placeholder="Search equipment, tags, models, or custodians..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select aria-label="Category filter" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All Categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</Select>
        <Select aria-label="Location filter" value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">All Locations</option>{locations.map((value) => <option key={value}>{value}</option>)}</Select>
        <Select aria-label="Condition filter" value={condition} onChange={(event) => setCondition(event.target.value)}><option value="all">All Conditions</option>{Object.entries(CONDITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Select aria-label="Sort equipment" value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="az">A–Z</option><option value="za">Z–A</option><option value="recent">Recently Added</option><option value="quantity_desc">Quantity: High → Low</option><option value="quantity_asc">Quantity: Low → High</option></Select>
      </div>
      <label className="equipment-archived-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Show archived items</label>
      {error && <div className="equipment-error">{error} <button onClick={() => void load()}>Try again</button></div>}
      {loading ? <p className="equipment-state">Loading equipment...</p> : visible.length === 0 ? <div className="equipment-state"><PackageCheck size={38} /><strong>{showArchived ? "No archived equipment." : items.length ? "No equipment matches these filters." : "No equipment has been added yet."}</strong>{canManage && !showArchived && items.length === 0 && <Button to="/admin/equipment/new">Add First Item</Button>}</div> : <div className="equipment-list">
        <div className="equipment-list-head"><span>Item</span><span>Category</span><span>Quantity</span><span>Location</span><span>Condition</span><span>Custodian</span></div>
        {visible.map((item) => <div key={item.id} className="equipment-list-row" role="link" tabIndex={0} aria-label={`Open ${item.name}`} onClick={() => navigate(`/admin/equipment/${item.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/admin/equipment/${item.id}`); } }}>
          <span data-label="Item"><strong>{item.name}</strong><small>{item.brand || item.model ? `${item.brand} ${item.model}`.trim() : item.trackingType === "individual" ? "Individual Asset" : "Quantity Item"}</small></span>
          <span data-label="Category">{item.category}</span><span data-label="Quantity">{item.quantity}</span><span data-label="Location">{item.location || "Not recorded"}</span><span data-label="Condition"><em className={badgeClass(item.condition)}>{CONDITION_LABELS[item.condition]}</em></span><span data-label="Custodian">{item.custodian?.name || "Not assigned"}{item.archivedAt && canManage && <button className="equipment-restore" onClick={(event) => { event.stopPropagation(); void restore(item.id); }}><RotateCcw size={14} /> Restore</button>}</span>
        </div>)}
      </div>}
    </section>
  </div>;
}
