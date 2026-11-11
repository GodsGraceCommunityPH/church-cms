import writeExcelFile from "write-excel-file/browser";
import type { Cell, Row, SheetData } from "write-excel-file/browser";
import type { ExportSheet } from "./exportTypes";

const HEADER_STYLE = {
  fontWeight: "bold" as const,
  textColor: "#172033",
  backgroundColor: "#eef3e3",
  borderColor: "#cbd5e1",
  borderStyle: "thin" as const,
  align: "left" as const,
  alignVertical: "center" as const,
  wrap: true,
  height: 24,
};

export function buildSheetData(sheet: ExportSheet): SheetData {
  const headerRow: Row = sheet.columns.map(
    (column): Cell => ({ value: column.header, type: String, ...HEADER_STYLE }),
  );

  const dataRows: Row[] = sheet.rows.map((row) =>
    row.map((value): Cell => {
      if (value === null || value === "") return null;
      if (typeof value === "number") return { value, type: Number };
      return { value, type: String };
    }),
  );

  return [headerRow, ...dataRows];
}

export async function downloadExportSheet(sheet: ExportSheet) {
  await writeExcelFile(buildSheetData(sheet), {
    sheet: sheet.sheetName,
    columns: sheet.columns.map((column) => ({ width: column.width ?? 20 })),
    stickyRowsCount: 1,
  }).toFile(sheet.fileName);
}
