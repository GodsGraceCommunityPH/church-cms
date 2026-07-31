import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { useAuth } from "../../features/auth/auth";
import {
  addTrainingNote,
  assignBatchTrainer,
  assignEnrollmentBatch,
  completeTraining,
  getMemberTrainingProfile,
  getAssignableTrainers,
  getNextProgram,
  getTrainingBatches,
  saveAttendance,
  scheduleRemedial,
  trainingErrorMessage,
  trainingStatusLabel,
  updateEnrollmentStatus,
  type MemberTrainingProfile as Profile,
  type TrainingBatchOption,
  type TrainerOption,
  type TrainingWorkflowStatus,
} from "../../features/training/trainingService";

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function StatusPill({ value }: { value: string }) {
  const styles: Record<string, string> = {
    complete: "bg-green-100 text-green-800",
    completed: "bg-green-100 text-green-800",
    pending: "bg-amber-100 text-amber-800",
    missing: "bg-red-100 text-red-800",
    for_remedial: "bg-orange-100 text-orange-800",
    present: "bg-green-100 text-green-800",
    absent: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[value] ?? "bg-slate-100 text-slate-700"}`}>
      {trainingStatusLabel(value)}
    </span>
  );
}

export default function MemberTrainingProfile() {
  const { enrollmentId, programSlug } = useParams();
  const { hasPermission } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [batches, setBatches] = useState<TrainingBatchOption[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [note, setNote] = useState("");
  const [remedialDate, setRemedialDate] = useState("");
  const [remedialNotes, setRemedialNotes] = useState("");

  const canManage = hasPermission("training.enroll");
  const canRecordAttendance = hasPermission("training.attendance");
  const canComplete = hasPermission("training.complete");
  const canRecommend = hasPermission("training.recommend");

  const load = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    setError("");
    try {
      const nextProfile = await getMemberTrainingProfile(enrollmentId);
      setProfile(nextProfile);
      setBatches(await getTrainingBatches(nextProfile.programId));
      if (hasPermission("training.enroll")) {
        setTrainers(await getAssignableTrainers());
      }
    } catch (reason) {
      setError(trainingErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, hasPermission]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: () => Promise<void>, message: string) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(message);
      await load();
    } catch (reason) {
      setError(trainingErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: TrainingWorkflowStatus) {
    if (
      ["completed", "withdrawn", "cancelled"].includes(status) &&
      !window.confirm(`Confirm changing this enrollment to ${trainingStatusLabel(status)}?`)
    ) {
      return;
    }
    if (!profile) return;
    if (status === "completed") {
      const nextProgram = canRecommend
        ? await getNextProgram(profile.programName)
        : null;
      await runAction(
        () =>
          completeTraining(
            profile.enrollment.id,
            nextProgram?.id ?? null,
            nextProgram ? `Eligible for ${nextProgram.name}` : "",
          ),
        nextProgram
          ? `Training completed and ${nextProgram.name} eligibility recorded.`
          : "Training completed.",
      );
      return;
    }
    await runAction(
      () => updateEnrollmentStatus(profile.enrollment.id, status),
      `Status updated to ${trainingStatusLabel(status)}.`,
    );
  }

  if (loading) return <p className="py-16 text-center text-slate-500">Loading Training Profile...</p>;
  if (!profile || error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
        <p className="text-red-600">{error || "Training Profile not found."}</p>
        <Button variant="secondary" className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  const enrollment = profile.enrollment;
  const fullName = `${enrollment.firstName} ${enrollment.lastName}`.trim();

  return (
    <div className="space-y-6">
      <header>
        <Link to={`/admin/training/${programSlug}`} className="text-sm font-medium text-olive-700 hover:underline">
          ← Back to {profile.programName}
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-olive-700">{profile.programName}</p>
            <h1 className="text-3xl font-bold">{fullName}</h1>
            <div className="mt-2"><StatusPill value={enrollment.status} /></div>
          </div>
          <Button to={`/admin/members/${enrollment.memberId}`} variant="secondary">
            View Member Profile
          </Button>
        </div>
      </header>

      {success && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{success}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-sm text-slate-500">Enrollment date</p><p className="font-medium">{formatDate(enrollment.enrolledAt)}</p></div>
        {enrollment.status !== "pending_enrollment" && <div><p className="text-sm text-slate-500">Start date</p><p className="font-medium">{formatDate(enrollment.startedAt)}</p></div>}
        <div><p className="text-sm text-slate-500">Class / batch</p><p className="font-medium">{enrollment.batchName ?? "Not recorded"}</p></div>
        {enrollment.status === "completed" && <div><p className="text-sm text-slate-500">Completion date</p><p className="font-medium">{formatDate(enrollment.completedAt)}</p></div>}
      </section>

      {canManage && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Administrator actions</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {enrollment.status === "pending_enrollment" && <>
              <Button disabled={saving} onClick={() => void changeStatus("in_progress")}>Start Training</Button>
              <Button disabled={saving} variant="danger" onClick={() => void changeStatus("withdrawn")}>Withdraw</Button>
              <Button disabled={saving} variant="danger" onClick={() => void changeStatus("cancelled")}>Cancel Enrollment</Button>
            </>}
            {["in_progress", "for_remedial"].includes(enrollment.status) && <>
              <Button disabled={saving} onClick={() => void changeStatus("ready_for_completion")}>Mark Ready for Graduation</Button>
              <Button disabled={saving} variant="secondary" onClick={() => void changeStatus("pending_enrollment")}>Return to Pending</Button>
              <Button disabled={saving} variant="danger" onClick={() => void changeStatus("withdrawn")}>Withdraw</Button>
            </>}
            {enrollment.status === "ready_for_completion" && <>
              {canComplete && <Button disabled={saving} onClick={() => void changeStatus("completed")}>Graduate Student</Button>}
              <Button disabled={saving} variant="secondary" onClick={() => void changeStatus("in_progress")}>Return to Training</Button>
            </>}
            {enrollment.status === "completed" && canRecommend && (
              <Button disabled={saving} onClick={() => void changeStatus("completed")}>Recommend for Next Program</Button>
            )}
          </div>
          <label className="mt-5 block text-sm font-medium">
            Assign class or batch
            <Select
              className="mt-2"
              value={enrollment.batchId ?? ""}
              disabled={saving}
              onChange={(event) =>
                void runAction(
                  () => assignEnrollmentBatch(enrollment.id, event.target.value || null),
                  "Class or batch assignment updated.",
                )
              }
            >
              <option value="">Not recorded</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}{batch.trainerName ? ` — ${batch.trainerName}` : ""}
                </option>
              ))}
            </Select>
          </label>
          {enrollment.batchId && (
            <label className="mt-4 block text-sm font-medium">
              Assign trainer
              <Select
                className="mt-2"
                value=""
                disabled={saving}
                onChange={(event) =>
                  void runAction(
                    () => assignBatchTrainer(enrollment.batchId!, event.target.value || null),
                    "Trainer assignment updated.",
                  )
                }
              >
                <option value="">Select trainer</option>
                {trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>{trainer.name}</option>
                ))}
              </Select>
            </label>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Sessions and attendance</h2>
        {profile.sessions.length === 0 ? (
          <p className="mt-4 text-slate-500">Sessions and attendance not recorded.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {profile.sessions.map((session) => (
              <div key={session.sessionId} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium">{session.title}</p><p className="text-sm text-slate-500">{formatDate(session.sessionDate)}</p></div>
                {canRecordAttendance ? (
                  <Select
                    value={session.status ?? ""}
                    disabled={saving}
                    onChange={(event) =>
                      void runAction(
                        () => saveAttendance(enrollment.id, session.sessionId, event.target.value),
                        "Attendance recorded.",
                      )
                    }
                  >
                    <option value="" disabled>Record attendance</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                    <option value="absent">Absent</option>
                  </Select>
                ) : session.status ? <StatusPill value={session.status} /> : <span>Not recorded</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Trainer notes</h2>
          {canManage && (
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!note.trim()) return;
                void runAction(() => addTrainingNote(enrollment.id, note.trim()), "Note added.").then(() => setNote(""));
              }}
            >
              <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a training note..." />
              <Button type="submit" disabled={saving || !note.trim()}>Add</Button>
            </form>
          )}
          {profile.notes.length === 0 ? <p className="mt-4 text-slate-500">Not recorded</p> : (
            <div className="mt-4 space-y-3">{profile.notes.map((item) => (
              <article key={item.id} className="rounded-xl bg-slate-50 p-3"><p>{item.note}</p><p className="mt-2 text-xs text-slate-500">{item.author} · {formatDate(item.createdAt)}</p></article>
            ))}</div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Remedial schedule</h2>
          {canManage && (
            <form
              className="mt-4 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!remedialDate) return;
                void runAction(
                  () => scheduleRemedial(enrollment.id, remedialDate, remedialNotes),
                  "Remedial scheduled.",
                ).then(() => { setRemedialDate(""); setRemedialNotes(""); });
              }}
            >
              <Input type="date" value={remedialDate} onChange={(event) => setRemedialDate(event.target.value)} />
              <Input value={remedialNotes} onChange={(event) => setRemedialNotes(event.target.value)} placeholder="Remedial notes..." />
              <Button type="submit" disabled={saving || !remedialDate}>Schedule remedial</Button>
            </form>
          )}
          {profile.remedials.length === 0 ? <p className="mt-4 text-slate-500">Not recorded</p> : (
            <div className="mt-4 space-y-3">{profile.remedials.map((item) => (
              <article key={item.id} className="rounded-xl bg-slate-50 p-3"><StatusPill value={item.status} /><p className="mt-2">{formatDate(item.scheduledFor)}</p><p className="text-sm text-slate-500">{item.notes ?? "No notes recorded"}</p></article>
            ))}</div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Advancement eligibility / recommendation</h2>
        {!canRecommend && <p className="mt-2 text-sm text-slate-500">Recommendation actions require training.recommend permission.</p>}
        {profile.advancement.length === 0 ? <p className="mt-4 text-slate-500">Not recorded</p> : (
          <div className="mt-4 space-y-3">{profile.advancement.map((item) => (
            <article key={`${item.nextProgram}-${item.recommendedAt}`} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{item.nextProgram}</p><StatusPill value={item.status} /></div>
              <p className="mt-2 text-sm text-slate-600">{item.recommendation ?? "No recommendation note recorded"}</p>
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
}
