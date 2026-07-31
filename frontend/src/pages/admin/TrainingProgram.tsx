import { Link, useParams } from "react-router-dom";
import { getTrainingProgram } from "../../features/training/trainingPrograms";

export default function TrainingProgram() {
  const { programSlug } = useParams();
  const program = getTrainingProgram(programSlug);

  if (!program) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold">Training program not found</h1>
        <Link
          to="/admin/training"
          className="mt-4 inline-block font-medium text-olive-700 underline"
        >
          Back to Training
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header style={{ margin: "8px 0 32px" }}>
        <Link
          to="/admin/training"
          className="text-sm font-medium text-olive-700 hover:underline"
        >
          ← Back to Training
        </Link>
        <h1 className="mt-4 text-3xl font-bold">{program.name}</h1>
        <p className="mt-2 text-slate-600">
          Program details will be available when the Training backend is ready.
        </p>
      </header>

      <div
        className="rounded-2xl border border-slate-200 bg-white text-center"
        style={{ padding: "64px 16px" }}
      >
        <h2 className="text-xl font-semibold">No program data yet</h2>
        <p className="mt-2 text-slate-500">
          Enrollment, completion, and class participation will appear here in a
          future Training sprint.
        </p>
      </div>
    </div>
  );
}
