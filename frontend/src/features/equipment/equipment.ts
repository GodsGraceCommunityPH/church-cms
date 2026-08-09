export type EquipmentTrackingType = "individual" | "quantity";
export type EquipmentCondition = "working" | "damaged" | "for_repair" | "for_replacement" | "retired";
export type MaintenanceType = "inspection" | "repair" | "maintenance" | "replacement_part";
export type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface EquipmentCategory { id: string; name: string; isActive: boolean; }
export interface EquipmentCustodian { id: string; name: string; }
export interface EquipmentMaintenance {
  id: string; maintenanceDate: string; type: MaintenanceType; status: MaintenanceStatus;
  cost: number | null; notes: string; createdAt: string;
}
export interface EquipmentItem {
  id: string; name: string; trackingType: EquipmentTrackingType; categoryId: string;
  category: string; quantity: number; condition: EquipmentCondition; description: string;
  location: string; custodian: EquipmentCustodian | null; brand: string; model: string;
  serialNumber: string; assetTag: string; purchaseDate: string; purchaseCost: number | null;
  notes: string; archivedAt: string | null; createdAt: string; updatedAt: string;
  maintenance: EquipmentMaintenance[];
}
export interface EquipmentInput {
  name: string; trackingType: EquipmentTrackingType; categoryId: string; quantity: number;
  condition: EquipmentCondition; description: string; location: string;
  custodianMemberId: string; brand: string; model: string; serialNumber: string;
  assetTag: string; purchaseDate: string; purchaseCost: string; notes: string;
}

export const CONDITION_LABELS: Record<EquipmentCondition, string> = {
  working: "Working", damaged: "Damaged", for_repair: "For Repair",
  for_replacement: "For Replacement", retired: "Retired / Out of Service",
};
export const TRACKING_LABELS: Record<EquipmentTrackingType, string> = {
  individual: "Individual Asset", quantity: "Quantity Item",
};
export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  inspection: "Inspection", repair: "Repair", maintenance: "Maintenance",
  replacement_part: "Replacement Part",
};
export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled",
};
