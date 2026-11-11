import { useCallback, useEffect, useState } from "react";
import { Download, Factory, RefreshCcw } from "lucide-react";
import Button from "../ui/Button";
import { useAuth } from "../../features/auth/auth";
import {
  downloadCsv,
  formatOrderDateTime,
  productionCsvFilename,
  productionReportRowsToCsv,
} from "../../features/fundraising/orderAccounting";
import { getProjectIlawProductionReport } from "../../features/fundraising/orderService";
import type { ProductionReport } from "../../features/fundraising/projectIlaw";

export default function ProductionReportPanel() {
  const { hasPermission } = useAuth();
  const canExport = hasPermission("project_ilaw.orders.export");
  const [report, setReport] = useState<ProductionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await getProjectIlawProductionReport());
    } catch {
      setError("The production report could not be generated.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleExport() {
    if (!canExport || !report || report.rows.length === 0) return;
    downloadCsv(
      productionCsvFilename(),
      productionReportRowsToCsv(report.rows),
    );
  }

  return (
    <section className="pilaw-panel pilaw-production" aria-labelledby="production-title">
      <div className="pilaw-production-heading">
        <div className="pilaw-breakdown-heading">
          <Factory size={18} aria-hidden="true" />
          <h2 id="production-title">Production quantities</h2>
        </div>
        <div className="pilaw-production-actions">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCcw size={16} aria-hidden="true" />
            Refresh
          </Button>
          {canExport && (
            <Button
              onClick={handleExport}
              disabled={loading || !report || report.rows.length === 0}
            >
              <Download size={16} aria-hidden="true" />
              Export production CSV
            </Button>
          )}
        </div>
      </div>

      <p className="pilaw-production-note">
        Only paid, non-cancelled orders count toward confirmed production. A
        production cutoff is not set until church leadership decides the date;
        while it is unset, every paid, non-cancelled order is included.
      </p>

      {report && (
        <dl className="pilaw-production-meta">
          <div>
            <dt>Production cutoff</dt>
            <dd>
              {report.cutoff
                ? new Date(`${report.cutoff}T00:00:00`).toLocaleDateString(
                    "en-PH",
                    { dateStyle: "medium" },
                  )
                : "Not set"}
            </dd>
          </div>
          <div>
            <dt>Confirmed units</dt>
            <dd>{report.totalQuantity}</dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{formatOrderDateTime(report.generatedAt)}</dd>
          </div>
        </dl>
      )}

      {error && (
        <div className="pilaw-error" role="alert">
          {error}
          <button type="button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <p className="pilaw-state">Generating the production report...</p>
      ) : report && report.rows.length === 0 ? (
        <p className="pilaw-state">
          No paid orders are counted yet. Confirmed production quantities appear
          here after a payment is manually confirmed.
        </p>
      ) : report ? (
        <div className="pilaw-table-wrap">
          <table className="pilaw-table pilaw-production-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Size</th>
                <th scope="col">Colour</th>
                <th scope="col">Confirmed quantity</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={`${row.productId}-${row.size}-${row.color}`}>
                  <td>{row.productName}</td>
                  <td>{row.productType === "eco_bag" ? "One Size" : row.size}</td>
                  <td>{row.color}</td>
                  <td>{row.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
