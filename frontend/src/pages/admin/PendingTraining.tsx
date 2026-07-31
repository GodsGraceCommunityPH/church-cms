import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import {
  getPendingTrainingEnrollments,
  trainingErrorMessage,
  updateEnrollmentStatus,
  type PendingTrainingEnrollment,
} from "../../features/training/trainingService";

function waitingDays(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

export default function PendingTraining() {
  const [items, setItems] = useState<PendingTrainingEnrollment[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await getPendingTrainingEnrollments());
    } catch (reason) {
      setError(trainingErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) =>
      `${item.firstName} ${item.lastName} ${item.programName}`.toLowerCase().includes(keyword),
    );
  }, [items, search]);

  return (
    <div className="space-y-6" style={{ display: "grid", gap: 24 }}>
      <header>
        <Link to="/admin/training" className="text-sm font-medium text-olive-700 hover:underline">← Back to Training</Link>
        <h1 className="mt-4 text-3xl font-bold">Pending Enrollment</h1>
        <p className="mt-2 text-slate-600">Members approved for Training who are waiting to begin.</p>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-4" style={{ padding: 24, border: "1px solid #dbe3ec", borderRadius: 18, background: "#fff" }}>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members or programs..." />
        {loading ? <p className="py-12 text-center text-slate-500">Loading pending enrollments...</p> :
          error ? <p className="py-12 text-center text-red-600">{error}</p> :
          filtered.length === 0 ? <p className="py-12 text-center text-slate-500">No members are waiting to begin Training.</p> :
          <div className="mt-4 space-y-3" style={{ display: "grid", gap: 14, marginTop: 18 }}>
            {filtered.map((item) => (
              <article key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, padding: 20, border: "1px solid #dbe3ec", borderRadius: 14, boxShadow: "0 1px 4px rgba(15,23,42,.06)" }}>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{item.firstName} {item.lastName}</h2>
                  <p className="text-sm text-slate-600">{item.programName} · Waiting {waitingDays(item.enrolledAt)} days</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (window.confirm("Cancel this incorrect enrollment? Its history will be preserved.")) {
                        void updateEnrollmentStatus(item.id, "cancelled").then(load);
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </article>
            ))}
          </div>
        }
      </section>
    </div>
  );
}
