import type { ExportCell, ExportColumn, ExportSheet } from "./exportTypes";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export class EmptyExportError extends Error {
  constructor(message = "No records match the current filters, so there is nothing to export.") {
    super(message);
    this.name = "EmptyExportError";
  }
}

export class ExportPermissionError extends Error {
  constructor(message = "You do not have permission to export these records.") {
    super(message);
    this.name = "ExportPermissionError";
  }
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatExportDate(value: string | null | undefined): string {
  if (!value) return "";

  const datePart = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (datePart) {
    const year = Number(datePart[1]);
    const month = Number(datePart[2]);
    const day = Number(datePart[3]);
    if (month < 1 || month > 12) return "";
    return `${MONTHS[month - 1]} ${day}, ${year}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCDate()}, ${parsed.getUTCFullYear()}`;
}

export function normalizeGenderLabel(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  return "Unknown / Not Set";
}

export function toExportText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function sanitizeFilePart(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60)
    .replace(/^_+|_+$/g, "");

  return cleaned || "Records";
}

export function buildExportFileName(subject: string, date = new Date()) {
  const fileDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `GGCCC_${sanitizeFilePart(subject)}_${fileDate}.xlsx`;
}

export function sanitizeSheetName(value: string, fallback = "Records") {
  const cleaned = value
    .replace(/[[\]:*?/\\]/g, "-")
    .replace(/^'+|'+$/g, "")
    .trim()
    .slice(0, 31)
    .trim();

  return cleaned || fallback;
}

export function createExportSheet(input: {
  subject: string;
  sheetName: string;
  columns: ExportColumn[];
  rows: ExportCell[][];
  date?: Date;
}): ExportSheet {
  return {
    fileName: buildExportFileName(input.subject, input.date),
    sheetName: sanitizeSheetName(input.sheetName),
    columns: input.columns,
    rows: input.rows,
  };
}

export function assertExportHasRows(sheet: ExportSheet) {
  if (sheet.rows.length === 0) throw new EmptyExportError();
  return sheet;
}
