import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/Modal";
import { useAuth } from "../../features/auth/auth";
import {
  completeTraining,
  overrideCompleteTraining,
  reopenTrainingEnrollment,
  completeTrainingCycle,
  enrollBatchStudents,
  getAvailableMembers,
  getTrainingBatchWorkspace,
  saveAttendance,
  resetTrainingCycleForDemo,
  startTrainingCycle,
  updateTrainingSession,
  deleteTrainingSession,
  trainingErrorMessage,
  trainingStatusLabel,
} from "../../features/training/trainingService";

export default function TrainingBatch() {
  const { batchId, programSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const [workspace, setWorkspace] = useState<Awaited<ReturnType<typeof getTrainingBatchWorkspace>> | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [showStudents, setShowStudents] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState("");
  const [savingAttendance, setSavingAttendance] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSession, setSelectedSession] = useState<{ id: string; title: string; session_date: string | null } | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");

  const load = useCallback(async () => {
    if (!batchId) return false;
    setError("");
    try {
      setWorkspace(await getTrainingBatchWorkspace(batchId));
      return true;
    } catch (reason) {
      setError(trainingErrorMessage(reason));
      return false;
    }
  }, [batchId]);
  useEffect(() => { void load(); }, [load]);

  const filteredMembers = useMemo(() => {
    const keyword = search.toLowerCase();
    return members.filter((member) => `${member.first_name} ${member.last_name}`.toLowerCase().includes(keyword));
  }, [members, search]);

  const activeCycle = workspace
    ? ["open", "ongoing"].includes(workspace.batch.status)
    : false;
  const classStarted = workspace?.batch.status === "ongoing";
  const activeStudents = workspace?.enrollments.filter((student) => ["pending_enrollment", "in_progress", "for_remedial", "ready_for_completion"].includes(student.status)) ?? [];
  const completedStudents = workspace?.enrollments.filter((student) => student.status === "completed") ?? [];
  const attendanceCount = (studentId: string) => new Set(workspace?.attendance.filter((item) => item.member_training_id === studentId && (["present", "late"].includes(item.status) || (workspace.batch.excusedCounts && item.status === "excused"))).map((item) => item.session_id) ?? []).size;

  const openStudentPicker = useCallback(async () => {
    if (!workspace) return;
    setLoadingMembers(true);
    setError("");
    try {
      const data = await getAvailableMembers(workspace.program.id);
      setMembers(data);
      setSelected(new Set());
      setSearch("");
      setEnrollmentError("");
      setShowStudents(true);
    } catch (reason) {
      setError(trainingErrorMessage(reason));
    } finally {
      setLoadingMembers(false);
    }
  }, [workspace]);

  useEffect(() => {
    if (workspace && activeCycle && searchParams.get("addStudents") === "1") {
      setSearchParams({}, { replace: true });
      void openStudentPicker();
    }
  }, [activeCycle, openStudentPicker, searchParams, setSearchParams, workspace]);

  if (!workspace) return <p className="py-12 text-center text-slate-500">{error || "Loading batch..."}</p>;

  return (
    <div className="space-y-6" style={{ display: "grid", gap: 24 }}>
      <header>
        <Link to={`/admin/training/${programSlug}`} className="text-sm font-medium text-olive-700 hover:underline">← Back to {workspace.program.name}</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-medium text-olive-700">{workspace.program.name}</p><h1 className="mt-1 text-3xl font-bold">{activeCycle ? "Current Class" : "Previous Class"}</h1></div>
          {hasPermission("training.enroll") && activeCycle && (
            <Button
              disabled={loadingMembers}
              onClick={() => void openStudentPicker()}
            >
              {loadingMembers ? "Loading Members..." : "+ Add Students"}
            </Button>
          )}
        </div>
      </header>
      {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {notice && <p style={{ margin: 0, padding: "12px 16px", borderRadius: 10, background: "#ecfdf5", color: "#166534" }}>{notice}</p>}

      {activeCycle && (
        <div className="flex justify-end" style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={() => { setNotice(""); void load().then((loaded) => { if (loaded) setNotice("Training data reloaded from Supabase."); }); }}>Reload Data</Button>
          {workspace.batch.status === "open" && hasPermission("training.enroll") && <Button onClick={() => { if (!window.confirm("Start this class? All pending students will move to In Progress and attendance will open.")) return; void startTrainingCycle(workspace.batch.id).then(load).catch((reason) => setError(trainingErrorMessage(reason))); }}>Start Class</Button>}
          {hasPermission("admin.settings") && (
            <Button variant="secondary" onClick={() => {
              if (!window.confirm("Reset this current Training cycle for the demo? Active students will be cancelled and the cycle will move to history. Nothing will be deleted.")) return;
              setError("");
              void resetTrainingCycleForDemo(workspace.batch.id)
                .then((count) => {
                  window.alert(`${count} active student records were cancelled. Historical data was preserved.`);
                  navigate(`/admin/training/${programSlug}`);
                })
                .catch((reason) => setError(trainingErrorMessage(reason)));
            }}>Reset Current Training</Button>
          )}
          {hasPermission("training.complete") && (
          <Button
            variant="secondary"
            disabled={activeStudents.length > 0}
            title={activeStudents.length > 0 ? "Complete or cancel every active student first." : undefined}
            onClick={() => {
              if (!window.confirm("Complete this Training cycle? All students must already be graduated, withdrawn, or cancelled.")) return;
              void completeTrainingCycle(workspace.batch.id)
                .then(load)
                .catch((reason) => setError(trainingErrorMessage(reason)));
            }}
          >
            Complete Training Cycle
          </Button>
          )}
        </div>
      )}
      {activeCycle && activeStudents.length > 0 && hasPermission("training.complete") && <p style={{ margin: 0, color: "#64748b", textAlign: "right" }}>The class can close after all active students are completed, withdrawn, or cancelled.</p>}

      <div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ padding: 26, border: "1px solid #dbe3ec", borderRadius: 18, background: "#fff", boxShadow: "0 2px 8px rgba(15,23,42,.06)" }}>
          <h2 className="text-lg font-semibold">Sessions</h2>
          <p style={{ color: "#64748b", margin: "8px 0 0" }}>{workspace.sessions.length} required sessions · Attendance opens when the class starts.</p>
          <div className="mt-6 space-y-5">{workspace.sessions.length === 0 ? <p className="text-slate-500">No sessions configured.</p> : workspace.sessions.map((session) => (
            <article key={session.id} tabIndex={hasPermission("training.enroll") && activeCycle ? 0 : undefined} role={hasPermission("training.enroll") && activeCycle ? "button" : undefined} onClick={() => { if (!hasPermission("training.enroll") || !activeCycle) return; setSelectedSession(session); setSessionTitle(session.title); setSessionDate(session.session_date?.slice(0,10) ?? ""); }} onKeyDown={(event) => { if (["Enter"," "].includes(event.key)) event.currentTarget.click(); }} className="rounded-xl border border-slate-200 p-5" style={{ cursor: hasPermission("training.enroll") && activeCycle ? "pointer" : "default" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><p className="font-semibold">{session.title} <span style={{ color: "#64748b", fontWeight: 400 }}>· {session.session_date ? new Date(session.session_date).toLocaleDateString("en-PH") : "Date not recorded"}</span></p><span style={{ color: "#64748b" }}>Click to manage</span></div><div className="mt-4 space-y-3" onClick={(event) => event.stopPropagation()}>{activeStudents.map((student) => {
              const attendance = workspace.attendance.find((item) => item.member_training_id === student.id && item.session_id === session.id);
              const saveKey = `${student.id}:${session.id}`;
              return <div key={student.id} className="flex flex-col gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:flex-row sm:items-center" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(150px, 190px)", alignItems: "center", gap: 16, width: "100%", maxWidth: 620, padding: "11px 14px", borderRadius: 10, background: "#f8fafc", boxSizing: "border-box" }}><Link to={`/admin/training/${programSlug}/members/${student.id}`} className="font-medium hover:text-olive-700" style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>{student.firstName} {student.lastName}</Link>{hasPermission("training.attendance") ? <Select className="sm:w-44" style={{ width: "100%" }} value={attendance?.status ?? ""} disabled={!classStarted || savingAttendance === saveKey} onChange={(event) => { setSavingAttendance(saveKey); setError(""); void saveAttendance(student.id, session.id, event.target.value).then(load).catch((reason) => setError(trainingErrorMessage(reason))).finally(() => setSavingAttendance("")); }}><option value="" disabled>Select attendance</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></Select> : <span>{attendance ? trainingStatusLabel(attendance.status) : "Not recorded"}</span>}</div>;
            })}</div></article>
          ))}</div>
        </section>

      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ padding: 26, border: "1px solid #dbe3ec", borderRadius: 18, background: "#fff", boxShadow: "0 2px 8px rgba(15,23,42,.06)" }}>
        <h2 className="text-lg font-semibold">Students Enrolled ({activeStudents.length})</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginTop: 20 }}>{activeStudents.map((student) => (
          <article key={student.id} style={{ padding: 20, border: "1px solid #dbe3ec", borderRadius: 14, background: "#fff", boxShadow: "0 2px 6px rgba(15,23,42,.07)" }}><Link to={`/admin/training/${programSlug}/members/${student.id}`} state={{ returnTo: location.pathname }} style={{ color: "inherit", textDecoration: "none" }}><p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{student.firstName} {student.lastName}</p><p style={{ margin: "8px 0 0", color: "#64748b" }}>{student.status.replaceAll("_", " ")}</p><p style={{ margin: "8px 0 0", fontWeight: 600 }}>Attendance: {attendanceCount(student.id)} / {workspace.batch.requiredSessions}</p></Link>{attendanceCount(student.id) >= workspace.batch.requiredSessions && hasPermission("training.complete") && <Button style={{ marginTop: 14 }} onClick={() => void completeTraining(student.id).then(load).catch((reason) => setError(trainingErrorMessage(reason)))}>Complete Student</Button>}{attendanceCount(student.id) < workspace.batch.requiredSessions && hasPermission("admin.settings") && <Button variant="secondary" style={{ marginTop: 14 }} onClick={() => { if (!window.confirm("Exceptional override: complete this student before attendance requirements are satisfied?")) return; void overrideCompleteTraining(student.id).then(load).catch((reason) => setError(trainingErrorMessage(reason))); }}>Override Completion</Button>}</article>
        ))}</div>
      </section>

      {completedStudents.length > 0 && <section style={{ padding: 24, border: "1px solid #dbe3ec", borderRadius: 18, background: "#fff" }}><h2 style={{ marginTop: 0 }}>Completed Students ({completedStudents.length})</h2><div style={{ display: "grid", gap: 12 }}>{completedStudents.map((student) => <article key={student.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 16, border: "1px solid #e2e8f0", borderRadius: 12 }}><Link to={`/admin/training/${programSlug}/members/${student.id}`} state={{ returnTo: location.pathname }}>{student.firstName} {student.lastName}</Link>{hasPermission("admin.settings") && <Button variant="secondary" onClick={() => { if (!window.confirm("Reopen this completed student as In Progress? Attendance, notes, and history will be preserved.")) return; void reopenTrainingEnrollment(student.id).then(load).catch((reason) => setError(trainingErrorMessage(reason))); }}>Reopen Training</Button>}</article>)}</div></section>}

      <Modal open={showStudents} title="Add Students" onClose={() => setShowStudents(false)}>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members..." />
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {filteredMembers.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
              {members.length === 0
                ? "Every member already has an enrollment record for this program."
                : "No eligible members match your search."}
            </p>
          ) : filteredMembers.map((member) => (
            <label key={member.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"><input type="checkbox" checked={selected.has(member.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(member.id); else next.delete(member.id); return next; })} /><span>{member.first_name} {member.last_name}</span></label>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600">Selected ({selected.size})</p>
        {enrollmentError && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {enrollmentError}
          </p>
        )}
        <Button
          className="mt-3 w-full"
          disabled={selected.size === 0 || enrolling}
          onClick={() => {
            setEnrolling(true);
            setEnrollmentError("");
            void enrollBatchStudents(workspace.batch.id, Array.from(selected))
              .then(async (count) => {
                if (count === 0) {
                  setEnrollmentError(
                    "No students were enrolled. They may already have active enrollment records for this program.",
                  );
                  return;
                }
                setShowStudents(false);
                setSelected(new Set());
                await load();
              })
              .catch((reason) =>
                setEnrollmentError(trainingErrorMessage(reason)),
              )
              .finally(() => setEnrolling(false));
          }}
        >
          {enrolling ? "Enrolling Students..." : `Enroll Selected (${selected.size})`}
        </Button>
      </Modal>
      <Modal open={Boolean(selectedSession)} title="Manage Session" onClose={() => setSelectedSession(null)}>
        <div style={{ display: "grid", gap: 14 }}><label>Session Name<Input value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} /></label><label>Session Date<Input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} /></label><div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}><Button variant="secondary" onClick={() => setSelectedSession(null)}>Cancel</Button><Button variant="danger" onClick={() => { if (!selectedSession || !window.confirm("Remove this session? Sessions with attendance history cannot be removed.")) return; void deleteTrainingSession(selectedSession.id).then(() => { setSelectedSession(null); return load(); }).catch((reason) => setError(trainingErrorMessage(reason))); }}>Remove Session</Button><Button disabled={!sessionTitle.trim()} onClick={() => { if (!selectedSession) return; void updateTrainingSession(selectedSession.id,sessionTitle.trim(),sessionDate).then(() => { setSelectedSession(null); return load(); }).catch((reason) => setError(trainingErrorMessage(reason))); }}>Save Changes</Button></div></div>
      </Modal>
    </div>
  );
}
