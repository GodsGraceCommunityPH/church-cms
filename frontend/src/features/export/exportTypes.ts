export type ExportCell = string | number | null;

export interface ExportColumn {
  header: string;
  width?: number;
}

export interface ExportSheet {
  fileName: string;
  sheetName: string;
  columns: ExportColumn[];
  rows: ExportCell[][];
}
