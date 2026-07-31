import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import { useTrainingOverview } from "../../features/training/useTrainingOverview";

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-slate-900">
        {value ?? "—"}
      </dd>
    </div>
  );
}

export default function Training() {
  const { programs, loading, error, loadPrograms } = useTrainingOverview();

  return (
    <div className="space-y-8">
      <header style={{ margin: "8px 0 32px" }}>
        <h1 className="text-3xl font-bold" style={{ margin: 0 }}>
          Training
        </h1>
        <p className="text-slate-600" style={{ margin: "8px 0 0" }}>
          Manage member training progress and class participation.
        </p>
      </header>

      {loading ? (
        <p
          className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500"
          style={{ margin: 0, padding: "48px 16px" }}
        >
          Loading Training programs...
        </p>
      ) : error ? (
        <div
          className="rounded-2xl border border-slate-200 bg-white py-12 text-center"
          style={{ padding: "48px 16px" }}
        >
          <p className="text-red-600" style={{ margin: 0 }}>
            {error}
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => void loadPrograms()}
          >
            Try again
          </Button>
        </div>
      ) : programs.length === 0 ? (
        <div
          className="rounded-2xl border border-slate-200 bg-white py-16 text-center"
          style={{ padding: "64px 16px" }}
        >
          <h2 className="text-xl font-semibold" style={{ margin: 0 }}>
            No Training programs found
          </h2>
          <p className="mt-2 text-slate-500">
            Training programs will appear here when they are available.
          </p>
        </div>
      ) : (
        <>
          <p
            className="rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800"
            style={{ margin: 0, padding: "12px 16px" }}
          >
            Enrollment statistics will appear when the Training backend is ready.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {programs.map((program) => (
              <article
                key={program.slug}
                className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white"
                style={{ padding: "20px" }}
              >
                <h2
                  className="text-xl font-semibold text-slate-900"
                  style={{ margin: 0 }}
                >
                  {program.name}
                </h2>

                <dl className="mt-6 grid grid-cols-3 gap-4">
                  <Stat label="Total enrolled" value={program.totalEnrolled} />
                  <Stat label="Completed" value={program.completed} />
                  <Stat label="In progress" value={program.inProgress} />
                </dl>

                <Link
                  to={`/admin/training/${program.slug}`}
                  className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  View program
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
