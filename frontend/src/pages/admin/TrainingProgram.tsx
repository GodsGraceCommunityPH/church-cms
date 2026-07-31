import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import { useAuth } from "../../features/auth/auth";
import { getTrainingProgram } from "../../features/training/trainingPrograms";
import {
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

  async function openCurrentCycle(addStudents = false) {
    if (!trainingId) return;
    setStarting(true);
    setError("");
    try {
      const cycle = currentCycle ?? await getOrCreateTrainingCycle(trainingId);
      navigate(
        `/admin/training/${programSlug}/cycles/${cycle.id}${addStudents ? "?addStudents=1" : ""}`,
      );
    } catch (reason) {
      setError(trainingErrorMessage(reason));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <Link to="/admin/training" className="text-sm font-medium text-olive-700 hover:underline">← Back to Training</Link>
        <h1 className="mt-4 text-3xl font-bold">{configuredProgram.name}</h1>
        <p className="mt-2 text-slate-600">One current Training cycle with a preserved history of previous runs.</p>
      </header>

      {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {loading ? <p className="py-12 text-center text-slate-500">Loading Training...</p> : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-olive-700">Current Training</p>
                {currentCycle ? (
                  <>
                    <h2 className="mt-1 text-2xl font-semibold">{configuredProgram.name}</h2>
                    <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                      <div><dt className="text-slate-500">Start date</dt><dd>{formatDate(currentCycle.startsOn)}</dd></div>
                      <div><dt className="text-slate-500">Students</dt><dd>{currentCycle.studentCount}</dd></div>
                      <div><dt className="text-slate-500">Status</dt><dd className="capitalize">{currentCycle.status}</dd></div>
                    </dl>
                  </>
                ) : (
                  <><h2 className="mt-1 text-xl font-semibold">No active Training</h2><p className="mt-2 text-slate-500">Start a new cycle when the program is ready to receive students.</p></>
                )}
              </div>
              {hasPermission("training.enroll") && (
                <div className="flex flex-wrap gap-2">
                  <Button disabled={starting} onClick={() => void openCurrentCycle(!currentCycle)}>
                    {currentCycle ? "+ Add Students" : "Start New Training"}
                  </Button>
                  {currentCycle && <Button variant="secondary" onClick={() => void openCurrentCycle(false)}>Manage Training</Button>}
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Previous Training Runs</h2>
            {previousCycles.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No previous runs recorded.</p> : (
              <div className="mt-3 space-y-3">{previousCycles.map((cycle) => (
                <Link key={cycle.id} to={`/admin/training/${programSlug}/cycles/${cycle.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-olive-400">
                  <div><p className="font-semibold">{formatDate(cycle.startsOn)} – {formatDate(cycle.endsOn)}</p><p className="text-sm text-slate-500">{cycle.studentCount} students</p></div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{cycle.status}</span>
                </Link>
              ))}</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
