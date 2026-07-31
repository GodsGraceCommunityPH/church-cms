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
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <Link
            to="/admin/training/pending"
            aria-label="Open Pending Enrollment"
            onKeyDown={(event) => {
              if (event.key === " ") {
                event.preventDefault();
                event.currentTarget.click();
              }
            }}
            className="group flex min-h-56 cursor-pointer flex-col rounded-2xl border border-amber-200 bg-amber-50 p-7 text-inherit shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Queue</p>
            <h2 className="mt-3 text-xl font-semibold">Pending Enrollment</h2>
            <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">
              Review waiting members and move them into their approved Training program.
            </p>
            <span className="mt-6 text-sm font-semibold text-amber-800 group-hover:text-amber-900">View pending enrollment →</span>
          </Link>

          {programs.map((program) => (
            <Link
              key={program.slug}
              to={`/admin/training/${program.slug}`}
              aria-label={`Open ${program.name} Training program`}
              onKeyDown={(event) => {
                if (event.key === " ") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
              className="group flex min-h-56 cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-7 text-inherit shadow-sm transition hover:-translate-y-0.5 hover:border-olive-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:ring-offset-2"
            >
              <h2 className="text-xl font-semibold">{program.name}</h2>
              <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5">
                <Stat label="Current training" value={program.activeBatches} />
                <Stat label="Students training" value={program.inProgress} />
                <Stat label="Ready to graduate" value={program.readyForGraduation} />
                <Stat label="Completed" value={program.completed} />
              </dl>
              <span className="mt-7 text-sm font-semibold text-olive-700 group-hover:text-olive-900">View program →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
