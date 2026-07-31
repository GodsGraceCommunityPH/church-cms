import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { useAuth } from "../../features/auth/auth";
import { getTrainingProgram } from "../../features/training/trainingPrograms";
import {
  createTrainingBatch,
  assignBatchTrainer,
  getAssignableTrainers,
  getProgramBatches,
  getTrainingProgramDetail,
  trainingErrorMessage,
  type TrainingBatch,
  type TrainerOption,
} from "../../features/training/trainingService";

function formatDate(value: string | null) {
  if (!value) return "Schedule not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function TrainingProgram() {
  const { programSlug } = useParams();
  const configuredProgram = getTrainingProgram(programSlug);
  const { hasPermission } = useAuth();
  const [trainingId, setTrainingId] = useState("");
  const [batches, setBatches] = useState<TrainingBatch[]>([]);
  const [newBatchName, setNewBatchName] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!configuredProgram) return;
    setLoading(true);
    setError("");
    try {
      const program = await getTrainingProgramDetail(configuredProgram.name);
      setTrainingId(program.id);
      setBatches(await getProgramBatches(program.id));
      if (hasPermission("training.enroll")) {
        setTrainers(await getAssignableTrainers());
      }
    } catch (reason) {
      setError(trainingErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [configuredProgram, hasPermission]);

  useEffect(() => { void load(); }, [load]);

  if (!configuredProgram) return <p>Training program not found.</p>;

  return (
    <div className="space-y-6">
      <header>
        <Link to="/admin/training" className="text-sm font-medium text-olive-700 hover:underline">← Back to Training</Link>
        <h1 className="mt-4 text-3xl font-bold">{configuredProgram.name}</h1>
        <p className="mt-2 text-slate-600">Manage classes, students, sessions, requirements, and graduations by batch.</p>
      </header>

      {hasPermission("training.enroll") && trainingId && (
        <form
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newBatchName.trim()) return;
            setSaving(true);
            void createTrainingBatch(trainingId, newBatchName.trim())
              .then(async (batchId) => {
                if (trainerId) await assignBatchTrainer(batchId, trainerId);
                setNewBatchName("");
                setTrainerId("");
                return load();
              })
              .catch((reason) => setError(trainingErrorMessage(reason)))
              .finally(() => setSaving(false));
          }}
        >
          <Input value={newBatchName} onChange={(event) => setNewBatchName(event.target.value)} placeholder={`${configuredProgram.name} - August 2026`} />
          <Select value={trainerId} onChange={(event) => setTrainerId(event.target.value)}>
            <option value="">Trainer (optional)</option>
            {trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}
          </Select>
          <Button type="submit" disabled={saving || !newBatchName.trim()}>Create Batch</Button>
        </form>
      )}

      {loading ? <p className="py-12 text-center text-slate-500">Loading batches...</p> :
        error ? <div className="rounded-2xl border border-red-200 bg-white p-8 text-center text-red-600">{error}</div> :
        batches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <h2 className="text-lg font-semibold">No batches yet</h2>
            <p className="mt-2 text-slate-500">Create the first batch to begin enrolling students.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {batches.map((batch) => (
              <article key={batch.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-olive-700">{batch.status}</p>
                <h2 className="mt-1 text-xl font-semibold">{batch.name}</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Trainer</dt><dd>{batch.trainerName ?? "Not assigned"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Students</dt><dd>{batch.studentCount}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Starts</dt><dd>{formatDate(batch.startsOn)}</dd></div>
                </dl>
                <Link to={`/admin/training/${programSlug}/batches/${batch.id}`} className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100">
                  Open batch
                </Link>
              </article>
            ))}
          </div>
        )}
    </div>
  );
}
