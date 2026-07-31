import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import { useAuth } from "../../features/auth/auth";
import { getTrainingProgram } from "../../features/training/trainingPrograms";
import {
  deleteCancelledTrainingCycle,
  getOrCreateTrainingCycle,
  getProgramBatches,
  getTrainingProgramDetail,
  trainingErrorMessage,
  type TrainingBatch,
} from "../../features/training/trainingService";

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function TrainingProgram() {
  const { programSlug } = useParams();
  const navigate = useNavigate();
  const configuredProgram = getTrainingProgram(programSlug);
  const { hasPermission } = useAuth();
  const [trainingId, setTrainingId] = useState("");
  const [cycles, setCycles] = useState<TrainingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!configuredProgram) return;
    setLoading(true);
    setError("");
    try {
      const program = await getTrainingProgramDetail(configuredProgram.name);
      setTrainingId(program.id);
      setCycles(await getProgramBatches(program.id));
    } catch (reason) {
      setError(trainingErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [configuredProgram]);

  useEffect(() => { void load(); }, [load]);
  if (!configuredProgram) return <p>Training program not found.</p>;

  const currentCycle = cycles.find((cycle) => ["open", "ongoing"].includes(cycle.status));
  const previousCycles = cycles.filter((cycle) => !["open", "ongoing"].includes(cycle.status));

  async function openCurrentCycle() {
    if (!trainingId) return;
    setStarting(true);
    setError("");
    try {
      const cycle = currentCycle ?? await getOrCreateTrainingCycle(trainingId);
      navigate(`/admin/training/${programSlug}/cycles/${cycle.id}`);
    } catch (reason) {
      setError(trainingErrorMessage(reason));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6" style={{ display: "grid", gap: 26 }}>
      <header>
        <Link to="/admin/training" className="text-sm font-medium text-olive-700 hover:underline">← Back to Training</Link>
        <h1 className="mt-4 text-3xl font-bold">{configuredProgram.name}</h1>
        <p className="mt-2 text-slate-600">One current Training cycle with a preserved history of previous runs.</p>
      </header>

      {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {loading ? <p className="py-12 text-center text-slate-500">Loading Training...</p> : (
        <>
          {currentCycle ? (
            <Link
              to={`/admin/training/${programSlug}/cycles/${currentCycle.id}`}
              aria-label={`Manage current ${configuredProgram.name} Training`}
              onKeyDown={(event) => {
                if (event.key === " ") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
              className="group block cursor-pointer rounded-2xl border border-slate-200 bg-white p-8 text-inherit shadow-sm transition hover:-translate-y-0.5 hover:border-olive-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:ring-offset-2"
              style={{ display: "block", padding: 30, border: "1px solid #dbe3ec", borderRadius: 18, background: "#fff", color: "inherit", textDecoration: "none", boxShadow: "0 2px 8px rgba(15,23,42,.08)" }}
            >
              <div>
                    <dl className="mt-7 grid grid-cols-2 gap-x-10 gap-y-5 text-sm sm:grid-cols-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 24, marginTop: 26 }}>
                      <div><dt className="text-slate-500">Start date</dt><dd>{formatDate(currentCycle.startsOn)}</dd></div>
                      <div><dt className="text-slate-500">Students</dt><dd>{currentCycle.studentCount}</dd></div>
                      <div><dt className="text-slate-500">Status</dt><dd className="capitalize">{currentCycle.status}</dd></div>
                    </dl>
              </div>
            </Link>
          ) : (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8" style={{ padding: 30, border: "1px dashed #b9c6d6", borderRadius: 18, background: "#fff" }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Training</p>
              <h2 className="mt-3 text-xl font-semibold">No active Training</h2>
              <p className="mt-3 max-w-xl leading-6 text-slate-500">Start a new Training cycle when this program is ready to receive students.</p>
              {hasPermission("training.enroll") && (
                <Button className="mt-6" disabled={starting} onClick={() => void openCurrentCycle()}>
                  Start New Training
                </Button>
              )}
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold">Previous Training Runs</h2>
            {previousCycles.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No previous runs recorded.</p> : (
              <div className="mt-3 space-y-3" style={{ display: "grid", gap: 12 }}>{previousCycles.map((cycle) => (
                <div key={cycle.id} style={{ display: "flex", alignItems: "center", gap: 12 }}><Link to={`/admin/training/${programSlug}/cycles/${cycle.id}`} className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-olive-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:ring-offset-2" style={{ display: "flex", flex: 1, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20, padding: 22, border: "1px solid #dbe3ec", borderRadius: 14, color: "inherit", textDecoration: "none" }}>
                  <div><p className="font-semibold">{formatDate(cycle.startsOn)} – {formatDate(cycle.endsOn)}</p><p className="text-sm text-slate-500">{cycle.studentCount} students</p></div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{cycle.status}</span>
                </Link>{cycle.status === "cancelled" && hasPermission("admin.settings") && <Button variant="danger" onClick={() => { if (!window.confirm("Permanently delete this cancelled demo run and all of its cycle data? This cannot be undone.")) return; void deleteCancelledTrainingCycle(cycle.id).then(load).catch((reason) => setError(trainingErrorMessage(reason))); }}>Delete</Button>}</div>
              ))}</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
