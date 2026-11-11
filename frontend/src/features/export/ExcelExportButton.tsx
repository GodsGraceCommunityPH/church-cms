import { useState } from "react";
import { Download } from "lucide-react";
import Button from "../../components/ui/Button";
import { downloadExportSheet } from "./excelExport";
import type { ExportSheet } from "./exportTypes";
import { EmptyExportError, ExportPermissionError } from "./exportUtils";

interface ExcelExportButtonProps {
  onExport: () => Promise<ExportSheet>;
  label?: string;
  hint?: string;
  disabled?: boolean;
}

type ExportStatus = {
  kind: "success" | "error";
  message: string;
};

export default function ExcelExportButton({
  onExport,
  label = "Export to Excel",
  hint,
  disabled = false,
}: ExcelExportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ExportStatus | null>(null);

  async function handleExport() {
    if (busy) return;

    setBusy(true);
    setStatus(null);

    try {
      const sheet = await onExport();
      await downloadExportSheet(sheet);
      const count = sheet.rows.length;
      setStatus({
        kind: "success",
        message: `Exported ${count} ${count === 1 ? "record" : "records"} to ${sheet.fileName}.`,
      });
    } catch (error) {
      if (error instanceof EmptyExportError || error instanceof ExportPermissionError) {
        setStatus({ kind: "error", message: error.message });
      } else {
        console.error("[Export] Unable to create Excel workbook", error);
        setStatus({
          kind: "error",
          message: "Unable to create the Excel export. Please try again.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="excel-export">
      <div className="excel-export-bar">
        {hint && <p className="excel-export-hint">{hint}</p>}
        <Button
          type="button"
          variant="secondary"
          className="excel-export-button"
          disabled={disabled || busy}
          aria-busy={busy}
          onClick={() => void handleExport()}
        >
          <Download size={16} aria-hidden="true" />
          {busy ? "Preparing Excel..." : label}
        </Button>
      </div>
      {status && (
        <p
          role="status"
          className={`excel-export-status excel-export-status-${status.kind}`}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
