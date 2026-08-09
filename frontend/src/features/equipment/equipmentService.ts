import { supabase } from "../../lib/supabase";
import type { EquipmentCategory, EquipmentInput, EquipmentItem, EquipmentMaintenance, MaintenanceStatus, MaintenanceType } from "./equipment";

const itemSelect = `
  id, name, tracking_type, category_id, quantity, condition, description, location,
  brand, model, serial_number, asset_tag, purchase_date, purchase_cost, notes,
  archived_at, created_at, updated_at,
  category:equipment_categories!equipment_items_category_id_fkey(id, name),
  custodian:members!equipment_items_custodian_member_id_fkey(id, first_name, last_name),
  maintenance:equipment_maintenance_history(id, maintenance_date, type, status, cost, notes, created_at)
`;

function mapMaintenance(row: any): EquipmentMaintenance {
  return { id: row.id, maintenanceDate: row.maintenance_date, type: row.type,
    status: row.status, cost: row.cost === null ? null : Number(row.cost),
    notes: row.notes ?? "", createdAt: row.created_at };
}
function mapItem(row: any): EquipmentItem {
  const category = Array.isArray(row.category) ? row.category[0] : row.category;
  const custodian = Array.isArray(row.custodian) ? row.custodian[0] : row.custodian;
  return {
    id: row.id, name: row.name, trackingType: row.tracking_type, categoryId: row.category_id,
    category: category?.name ?? "Uncategorized", quantity: row.quantity, condition: row.condition,
    description: row.description ?? "", location: row.location ?? "",
    custodian: custodian ? { id: custodian.id, name: `${custodian.first_name} ${custodian.last_name}`.trim() } : null,
    brand: row.brand ?? "", model: row.model ?? "", serialNumber: row.serial_number ?? "",
    assetTag: row.asset_tag ?? "", purchaseDate: row.purchase_date ?? "",
    purchaseCost: row.purchase_cost === null ? null : Number(row.purchase_cost), notes: row.notes ?? "",
    archivedAt: row.archived_at, createdAt: row.created_at, updatedAt: row.updated_at,
    maintenance: (row.maintenance ?? []).map(mapMaintenance).sort((a: EquipmentMaintenance, b: EquipmentMaintenance) => b.maintenanceDate.localeCompare(a.maintenanceDate)),
  };
}

export async function getEquipmentCategories(): Promise<EquipmentCategory[]> {
  const { data, error } = await supabase.from("equipment_categories").select("id, name, is_active").order("name");
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, isActive: row.is_active }));
}
export async function getEquipmentItems(): Promise<EquipmentItem[]> {
  const { data, error } = await supabase.from("equipment_items").select(itemSelect).order("name");
  if (error) throw error;
  return (data ?? []).map(mapItem);
}
export async function getEquipmentItem(id: string): Promise<EquipmentItem> {
  const { data, error } = await supabase.from("equipment_items").select(itemSelect).eq("id", id).single();
  if (error) throw error;
  return mapItem(data);
}
export async function getEquipmentCustodians() {
  const { data, error } = await supabase.from("members").select("id, first_name, last_name, membership_status").order("last_name").order("first_name");
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, name: `${row.first_name} ${row.last_name}`.trim(), active: row.membership_status !== "Inactive" }));
}
function payload(input: EquipmentInput) {
  return {
    name: input.name.trim(), tracking_type: input.trackingType, category_id: input.categoryId,
    quantity: input.trackingType === "individual" ? 1 : input.quantity, condition: input.condition,
    description: input.description.trim() || null, location: input.location.trim() || null,
    custodian_member_id: input.custodianMemberId || null, brand: input.brand.trim() || null,
    model: input.model.trim() || null, serial_number: input.serialNumber.trim() || null,
    asset_tag: input.assetTag.trim() || null, purchase_date: input.purchaseDate || null,
    purchase_cost: input.purchaseCost === "" ? null : Number(input.purchaseCost), notes: input.notes.trim() || null,
  };
}
export async function saveEquipmentItem(input: EquipmentInput, id?: string): Promise<string> {
  const query = id ? supabase.from("equipment_items").update(payload(input)).eq("id", id) : supabase.from("equipment_items").insert(payload(input));
  const { data, error } = await query.select("id").single();
  if (error) throw error;
  return data.id;
}
export async function archiveEquipmentItem(id: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase.from("equipment_items").update({ archived_at: new Date().toISOString(), archived_by: authData.user?.id ?? null }).eq("id", id);
  if (error) throw error;
}
export async function restoreEquipmentItem(id: string): Promise<void> {
  const { error } = await supabase.from("equipment_items").update({ archived_at: null, archived_by: null }).eq("id", id);
  if (error) throw error;
}
export async function addEquipmentMaintenance(input: { equipmentItemId: string; maintenanceDate: string; type: MaintenanceType; status: MaintenanceStatus; cost: string; notes: string; }): Promise<void> {
  const { error } = await supabase.from("equipment_maintenance_history").insert({ equipment_item_id: input.equipmentItemId, maintenance_date: input.maintenanceDate, type: input.type, status: input.status, cost: input.cost === "" ? null : Number(input.cost), notes: input.notes.trim() || null });
  if (error) throw error;
}
