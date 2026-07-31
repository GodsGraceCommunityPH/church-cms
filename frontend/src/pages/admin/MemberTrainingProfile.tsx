import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { useAuth } from "../../features/auth/auth";
import {
  addTrainingNote,
  completeTraining,
  getMemberTrainingProfile,
  saveAttendance,
  scheduleRemedial,
  trainingErrorMessage,
  trainingStatusLabel,
  updateEnrollmentStatus,
  type MemberTrainingProfile as Profile,
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
    completed: "bg-green-100 text-green-800",
    in_progress: "bg-blue-100 text-blue-800",
    pending_enrollment: "bg-amber-100 text-amber-800",
    present: "bg-green-100 text-green-800",
    absent: "bg-red-100 text-red-800",
    excused: "bg-amber-100 text-amber-800",
    late: "bg-blue-100 text-blue-800",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[value] ?? "bg-slate-100 text-slate-700"}`}>{trainingStatusLabel(value)}</span>;
}

export default function MemberTrainingProfile() {
  const { enrollmentId, programSlug } = useParams();
  const { hasPermission } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [note, setNote] = useState("");
  const [remedialSessionId, setRemedialSessionId] = useState("");
  const [remedialDate, setRemedialDate] = useState("");
  const [remedialNotes, setRemedialNotes] = useState("");

  const canManage = hasPermission("training.enroll");
  const canRecordAttendance = hasPermission("training.attendance");
  const canComplete = hasPermission("training.complete");

  const load = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    try {
      setProfile(await getMemberTrainingProfile(enrollmentId));
      setError("");
    } catch (reason) {
      setError(trainingErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => { void load(); }, [load]);

  const missedSessions = useMemo(
    () => profile?.sessions.filter((session) => ["absent", "excused"].includes(session.status ?? "")) ?? [],
    [profile],
  );

  async function runAction(action: () => Promise<void>, message: string) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await action();
      await load();
      setSuccess(message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The update could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: TrainingWorkflowStatus) {
    if (["withdrawn", "cancelled"].includes(status) && !window.confirm(`Confirm ${trainingStatusLabel(status)}? History will be preserved.`)) return;
    if (!profile) return;
    if (status === "completed") {
      await runAction(() => completeTraining(profile.enrollment.id), "Training completed.");
    } else {
      await runAction(() => updateEnrollmentStatus(profile.enrollment.id, status), `Status updated to ${trainingStatusLabel(status)}.`);
    }
  }

  if (loading) return <p className="py-16 text-center text-slate-500">Loading Training Profile...</p>;
  if (!profile) return <div className="rounded-2xl border border-red-200 bg-white p-8 text-center text-red-600">{error || "Training Profile not found."}</div>;

  const enrollment = profile.enrollment;
  const started = enrollment.status !== "pending_enrollment" && enrollment.status !== "cancelled";
  const active = ["in_progress", "for_remedial", "ready_for_completion"].includes(enrollment.status);

  return (
    <div className="space-y-7">
      <header>
        <Link to={`/admin/training/${programSlug}`} className="text-sm font-medium text-olive-700 hover:underline">← Back to {profile.programName}</Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
          <div><p className="text-sm font-semibold text-olive-700">{profile.programName}</p><h1 className="mt-1 text-3xl font-bold">{enrollment.firstName} {enrollment.lastName}</h1><div className="mt-3"><StatusPill value={enrollment.status} /></div></div>
          <Button to={`/admin/members/${enrollment.memberId}`} variant="secondary">View Member Profile</Button>
        </div>
      </header>

      {success && <p className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{success}</p>}
      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Enrollment Summary</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          <div><dt className="text-sm text-slate-500">Enrollment date</dt><dd className="mt-1 font-medium">{formatDate(enrollment.enrolledAt)}</dd></div>
          {started && <div><dt className="text-sm text-slate-500">Start date</dt><dd className="mt-1 font-medium">{formatDate(enrollment.startedAt)}</dd></div>}
          {enrollment.status === "completed" && <div><dt className="text-sm text-slate-500">Completion date</dt><dd className="mt-1 font-medium">{formatDate(enrollment.completedAt)}</dd></div>}
        </dl>
      </section>

      {canManage && enrollment.status !== "completed" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Actions</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {enrollment.status === "pending_enrollment" && <><Button disabled={saving} onClick={() => void changeStatus("in_progress")}>Start Training</Button><Button disabled={saving} variant="danger" onClick={() => void changeStatus("cancelled")}>Cancel Enrollment</Button></>}
            {active && <>{canComplete && <Button disabled={saving} onClick={() => void changeStatus("completed")}>Complete Training</Button>}<Button disabled={saving} variant="danger" onClick={() => void changeStatus("withdrawn")}>Withdraw</Button></>}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Sessions and Attendance</h2>
        {profile.sessions.length === 0 ? <p className="mt-4 text-slate-500">No sessions recorded.</p> : (
          <div className="mt-5 space-y-3">{profile.sessions.map((session) => (
            <div key={session.sessionId} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium">{session.title}</p><p className="mt-1 text-sm text-slate-500">{formatDate(session.sessionDate)}</p></div>
              {canRecordAttendance ? <Select className="sm:w-48" value={session.status ?? ""} disabled={saving} onChange={(event) => void runAction(() => saveAttendance(enrollment.id, session.sessionId, event.target.value), "Attendance saved.")}><option value="" disabled>Select attendance</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></Select> : session.status ? <StatusPill value={session.status} /> : <span className="text-sm text-slate-500">Not recorded</span>}
            </div>
          ))}</div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Trainer Notes</h2>
        {canManage && <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (!note.trim()) return; void runAction(() => addTrainingNote(enrollment.id, note.trim()), "Note added.").then(() => setNote("")); }}><Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a training note..." /><Button type="submit" disabled={saving || !note.trim()}>Add Note</Button></form>}
        {profile.notes.length === 0 ? <p className="mt-4 text-slate-500">No notes recorded.</p> : <div className="mt-5 space-y-3">{profile.notes.map((item) => <article key={item.id} className="rounded-xl bg-slate-50 p-4"><p>{item.note}</p><p className="mt-2 text-xs text-slate-500">{item.author} · {formatDate(item.createdAt)}</p></article>)}</div>}
      </section>

      {missedSessions.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Remedial Schedule</h2>
          {canManage && <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (!remedialSessionId || !remedialDate) return; void runAction(() => scheduleRemedial(enrollment.id, remedialSessionId, remedialDate, remedialNotes), "Remedial schedule saved.").then(() => { setRemedialSessionId(""); setRemedialDate(""); setRemedialNotes(""); }); }}><Select value={remedialSessionId} onChange={(event) => setRemedialSessionId(event.target.value)}><option value="">Missed session</option>{missedSessions.map((session) => <option key={session.sessionId} value={session.sessionId}>{session.title}</option>)}</Select><Input type="date" value={remedialDate} onChange={(event) => setRemedialDate(event.target.value)} /><Input className="sm:col-span-2" value={remedialNotes} onChange={(event) => setRemedialNotes(event.target.value)} placeholder="Remedial notes..." /><Button type="submit" disabled={saving || !remedialSessionId || !remedialDate}>Save Remedial</Button></form>}
          {profile.remedials.length > 0 && <div className="mt-5 space-y-3">{profile.remedials.map((item) => <article key={item.id} className="rounded-xl border border-amber-200 bg-white p-4"><p className="font-medium">{item.sessionTitle}</p><p className="mt-1 text-sm">{formatDate(item.scheduledFor)}</p><p className="mt-1 text-sm text-slate-500">{item.notes ?? "No notes recorded"}</p></article>)}</div>}
        </section>
      )}
    </div>
  );
}
