import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import { useAuth } from "../../features/auth/auth";
import { archiveImportedTrainingEnrollments } from "../../features/training/trainingService";
import { useTrainingOverview } from "../../features/training/useTrainingOverview";

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}

export default function Training() {
  const { programs, loading, error, loadPrograms } = useTrainingOverview();
  const { hasPermission } = useAuth();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Training</h1>
          <p className="mt-2 text-slate-600">
            Guide members from enrollment through graduation and advancement.
          </p>
        </div>
        {hasPermission("admin.settings") && (
          <Button
            variant="secondary"
            onClick={() => {
              if (!window.confirm("Archive all imported Training enrollments? Operational lists will start empty, but audit data will be preserved.")) return;
              void archiveImportedTrainingEnrollments()
                .then((count) => {
                  window.alert(`${count} imported enrollment records archived.`);
                  void loadPrograms();
                })
                .catch((reason: unknown) =>
                  window.alert(reason instanceof Error ? reason.message : "Unable to archive imported Training data."),
                );
            }}
          >
            Reset Imported Data
          </Button>
        )}
      </header>

      {loading ? (
        <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500">
          Loading Training...
        </p>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-white py-12 text-center">
          <p className="text-red-600">{error}</p>
          <Button className="mt-4" variant="secondary" onClick={() => void loadPrograms()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article className="flex flex-col rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Queue</p>
            <h2 className="mt-1 text-xl font-semibold">Pending Enrollment</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600">
              Assign waiting members to a batch and begin their Training journey.
            </p>
            <Link
              to="/admin/training/pending"
              className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              Open pending queue
            </Link>
          </article>

          {programs.map((program) => (
            <article key={program.slug} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-semibold">{program.name}</h2>
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <Stat label="Active batches" value={program.activeBatches} />
                <Stat label="Students training" value={program.inProgress} />
                <Stat label="Ready to graduate" value={program.readyForGraduation} />
                <Stat label="Completed" value={program.completed} />
              </dl>
              <Link
                to={`/admin/training/${program.slug}`}
                className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                View batches
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
