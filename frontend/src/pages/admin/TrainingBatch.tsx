import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/Modal";
import { useAuth } from "../../features/auth/auth";
import {
  completeTraining,
  reopenTrainingEnrollment,
  completeTrainingCycle,
  completeRemedial,
  closeTrainingSessionEditing,
  enrollBatchStudents,
  getAvailableMembers,
  getCancelledTrainingEnrollments,
  getTrainingBatchWorkspace,
  isActiveTrainingStatus,
  reopenTrainingSession,
  restoreTrainingEnrollment,
  saveAttendance,
  scheduleRemedial,
  resetTrainingCycleForDemo,
  startTrainingCycle,
  rescheduleTrainingSession,
  withdrawTrainingEnrollment,
  trainingErrorMessage,
  attendanceStatusLabel,
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
  const [cancelledEnrollments, setCancelledEnrollments] = useState<Awaited<ReturnType<typeof getCancelledTrainingEnrollments>>>([]);
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
  const [sessionReason, setSessionReason] = useState("");
  const [selectedAbsence, setSelectedAbsence] = useState<{ enrollmentId: string; sessionId: string; studentName: string; sessionTitle: string; remedialId?: string } | null>(null);
  const [remedialDate, setRemedialDate] = useState(new Date().toISOString().slice(0, 10));
  const [remedialNotes, setRemedialNotes] = useState("");

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
  const activeStudents = workspace?.enrollments.filter((student) => isActiveTrainingStatus(student.status)) ?? [];
  const completedStudents = workspace?.enrollments.filter((student) => student.status === "completed") ?? [];
  const regularSessions = workspace?.sessions.slice(0, workspace.batch.requiredSessions) ?? [];
  const attendanceFor = (studentId: string, sessionId: string) => workspace?.attendance.find((item) => item.member_training_id === studentId && item.session_id === sessionId);
  const remedialFor = (studentId: string, sessionId: string) => workspace?.remedials.find((item) => item.member_training_id === studentId && item.session_id === sessionId && item.status !== "cancelled");
  const obligationSatisfied = (studentId: string, sessionId: string) => {
    const attendance = attendanceFor(studentId, sessionId);
    return Boolean(attendance && (["present", "late"].includes(attendance.status) || (workspace?.batch.excusedCounts && attendance.status === "excused") || (attendance.status === "absent" && remedialFor(studentId, sessionId)?.status === "completed")));
  };
  const attendanceCount = (studentId: string) => regularSessions.filter((session) => obligationSatisfied(studentId, session.id)).length;
  const currentSessionIndex = classStarted
    ? activeStudents.length === 0
      ? 0
      : regularSessions.findIndex((session) => activeStudents.some((student) => !attendanceFor(student.id, session.id)))
    : -1;
  const visibleSessions = !classStarted
    ? []
    : currentSessionIndex < 0
      ? regularSessions
      : regularSessions.slice(0, currentSessionIndex + 1);
  const unresolvedAbsences = activeStudents.flatMap((student) => regularSessions.flatMap((session) => {
    const attendance = attendanceFor(student.id, session.id);
    const remedial = remedialFor(student.id, session.id);
    return attendance?.status === "absent" && remedial?.status !== "completed"
      ? [{ student, session, remedial }]
      : [];
  }));

  const openStudentPicker = useCallback(async () => {
    if (!workspace) return;
    setLoadingMembers(true);
    setError("");
    try {
      const [data, cancelled] = await Promise.all([
        getAvailableMembers(workspace.program.id),
        getCancelledTrainingEnrollments(workspace.program.id),
      ]);
      setMembers(data);
      setCancelledEnrollments(cancelled);
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
              if (!window.confirm("Reset this Current Class for the demo? Active students will be cancelled and the class will move to history. Nothing will be deleted.")) return;
              setError("");
              void resetTrainingCycleForDemo(workspace.batch.id)
                .then((count) => {
                  window.alert(`${count} active student records were cancelled. Historical data was preserved.`);
                  navigate(`/admin/training/${programSlug}`);
                })
                .catch((reason) => setError(trainingErrorMessage(reason)));
            }}>Reset Current Class</Button>
          )}
          {hasPermission("training.complete") && (
          <Button
            variant="secondary"
            onClick={() => {
              if (!window.confirm("Close this class? All students must already be completed, withdrawn, or cancelled.")) return;
              void completeTrainingCycle(workspace.batch.id)
                .then(async (result) => {
                  if (!result.closed) {
                    setError(`This class cannot be closed yet. ${result.pending} pending, ${result.active} active, and ${result.incompleteRemedials} incomplete remedial record(s) remain.`);
                    return;
                  }
                  setNotice("Class closed successfully. All Training history was preserved.");
                  await load();
                })
                .catch((reason) => setError(trainingErrorMessage(reason)));
            }}
          >
            Close Class
          </Button>
          )}
        </div>
      )}
      {activeCycle && activeStudents.length > 0 && hasPermission("training.complete") && <p style={{ margin: 0, color: "#64748b", textAlign: "right" }}>The class can close after all active students are completed, withdrawn, or cancelled.</p>}

      <div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ padding: "clamp(16px, 4vw, 26px)", border: "1px solid #dbe3ec", borderRadius: 18, background: "#fff", boxShadow: "0 2px 8px rgba(15,23,42,.06)", minWidth: 0 }}>
          <h2 className="text-lg font-semibold">Sessions</h2>
          <p style={{ color: "#64748b", margin: "8px 0 0" }}>{workspace.batch.requiredSessions} required sessions · Future weeks appear after the current week is recorded for every active student.</p>
          {!classStarted ? <p style={{ margin: "20px 0 0", padding: 16, borderRadius: 12, background: "#f8fafc", color: "#64748b" }}>Week 1 will open when the class starts.</p> : <div className="mt-6 space-y-5">{visibleSessions.length === 0 ? <p className="text-slate-500">No sessions configured.</p> : visibleSessions.map((session, visibleIndex) => {
            const isCurrent = currentSessionIndex === visibleIndex;
            const isReopened = Boolean(session.attendance_reopened_at);
            const canEditAttendance = isCurrent || isReopened;
            return (
            <article key={session.id} tabIndex={hasPermission("training.enroll") && activeCycle ? 0 : undefined} role={hasPermission("training.enroll") && activeCycle ? "button" : undefined} onClick={() => { if (!hasPermission("training.enroll") || !activeCycle) return; setSelectedSession(session); setSessionTitle(session.title); setSessionDate(session.session_date?.slice(0,10) ?? ""); }} onKeyDown={(event) => { if (["Enter"," "].includes(event.key)) event.currentTarget.click(); }} className="rounded-xl border border-slate-200 p-5" style={{ cursor: hasPermission("training.enroll") && activeCycle ? "pointer" : "default", padding: "clamp(14px, 3.5vw, 20px)", border: isCurrent ? "2px solid #667b38" : "1px solid #dbe3ec", borderRadius: 14, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div><p className="font-semibold" style={{ margin: 0 }}>{session.title} <span style={{ color: "#64748b", fontWeight: 400 }}>· {session.session_date ? new Date(session.session_date).toLocaleDateString("en-PH") : "Date not recorded"}</span></p><small style={{ color: isCurrent ? "#4d5f2a" : "#64748b" }}>{isCurrent ? "Current session" : isReopened ? "Reopened for correction" : "Completed · Read-only"}</small></div><div onClick={(event) => event.stopPropagation()}>{!isCurrent && hasPermission("admin.settings") && (isReopened ? <Button variant="secondary" onClick={() => { if (!window.confirm("Close this correction window? The session will become read-only again.")) return; void closeTrainingSessionEditing(session.id, "Corrections completed").then(load).catch((reason) => setError(trainingErrorMessage(reason))); }}>Close Editing</Button> : <Button variant="secondary" onClick={() => { if (!window.confirm("Reopen this completed session for attendance corrections? This action is audited.")) return; const reason = window.prompt("Reason for reopening this session") ?? ""; void reopenTrainingSession(session.id, reason).then(load).catch((reasonValue) => setError(trainingErrorMessage(reasonValue))); }}>Reopen Session for Editing</Button>)}</div></div><div className="mt-4 space-y-3" onClick={(event) => event.stopPropagation()}>{activeStudents.map((student) => {
              const attendance = attendanceFor(student.id, session.id);
              const saveKey = `${student.id}:${session.id}`;
              return <div key={student.id} className="training-attendance-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", borderRadius: 10, background: "#f8fafc", boxSizing: "border-box", minWidth: 0 }}><Link to={`/admin/training/${programSlug}/members/${student.id}`} state={{ returnTo: location.pathname }} className="font-medium hover:text-olive-700" style={{ color: "inherit", textDecoration: "none", fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{student.firstName} {student.lastName}</Link>{hasPermission("training.attendance") && canEditAttendance ? <Select className="sm:w-44" style={{ width: "100%", minWidth: 0 }} value={attendance?.status ?? ""} disabled={savingAttendance === saveKey} onChange={(event) => { setSavingAttendance(saveKey); setError(""); void saveAttendance(student.id, session.id, event.target.value).then(load).catch((reason) => setError(trainingErrorMessage(reason))).finally(() => setSavingAttendance("")); }}><option value="" disabled>Select attendance</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></Select> : <span style={{ color: "#475569" }}>{attendanceStatusLabel(attendance?.status)}</span>}</div>;
            })}</div></article>
          );})}</div>}
        </section>

      </div>

      {activeCycle && unresolvedAbsences.length > 0 && <section style={{ padding: "clamp(16px, 4vw, 24px)", border: "1px solid #f3d36b", borderRadius: 18, background: "#fffbeb", minWidth: 0 }}><h2 style={{ margin: 0 }}>Remedial Attendance</h2><p style={{ margin: "8px 0 18px", color: "#64748b" }}>Only unresolved absences appear here. Completing remedial attendance satisfies the missed week without changing the original absence.</p><div style={{ display: "grid", gap: 12 }}>{unresolvedAbsences.map(({ student, session, remedial }) => <article key={`${student.id}:${session.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, padding: 16, border: "1px solid #f3d36b", borderRadius: 12, background: "#fff" }}><div><strong>{student.firstName} {student.lastName}</strong><p style={{ margin: "5px 0 0", color: "#64748b" }}>{session.title}: Absent{remedial ? ` · Remedial scheduled ${new Date(remedial.scheduled_for).toLocaleDateString("en-PH")}` : ""}</p></div>{hasPermission("training.attendance") && (remedial ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Button variant="secondary" onClick={() => { setSelectedAbsence({ enrollmentId: student.id, sessionId: session.id, studentName: `${student.firstName} ${student.lastName}`, sessionTitle: session.title, remedialId: remedial.id }); setRemedialDate(remedial.scheduled_for.slice(0, 10)); setRemedialNotes(remedial.notes ?? ""); }}>Edit Schedule</Button><Button onClick={() => { if (!window.confirm(`Mark ${student.firstName}'s remedial for ${session.title} complete?`)) return; void completeRemedial(remedial.id, new Date().toISOString().slice(0,10)).then(load).catch((reason) => setError(trainingErrorMessage(reason))); }}>Complete Remedial</Button></div> : <Button onClick={() => { setSelectedAbsence({ enrollmentId: student.id, sessionId: session.id, studentName: `${student.firstName} ${student.lastName}`, sessionTitle: session.title }); setRemedialDate(new Date().toISOString().slice(0,10)); setRemedialNotes(""); }}>Schedule Remedial</Button>)}</article>)}</div></section>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ padding: "clamp(16px, 4vw, 26px)", border: "1px solid #dbe3ec", borderRadius: 18, background: "#fff", boxShadow: "0 2px 8px rgba(15,23,42,.06)", minWidth: 0 }}>
        <h2 className="text-lg font-semibold">Students Enrolled ({activeStudents.length})</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginTop: 20 }}>{activeStudents.map((student) => (
          <article key={student.id} style={{ padding: "clamp(18px, 4vw, 22px)", border: "1px solid #dbe3ec", borderRadius: 14, background: "#fff", boxShadow: "0 2px 6px rgba(15,23,42,.07)", minWidth: 0 }}><Link to={`/admin/training/${programSlug}/members/${student.id}`} state={{ returnTo: location.pathname }} style={{ color: "inherit", textDecoration: "none" }}><p style={{ margin: 0, fontSize: 17, fontWeight: 700, overflowWrap: "anywhere" }}>{student.firstName} {student.lastName}</p><p style={{ margin: "8px 0 0", color: "#64748b" }}>{trainingStatusLabel(student.status)}</p><p style={{ margin: "8px 0 0", fontWeight: 600 }}>Attendance: {attendanceCount(student.id)} / {workspace.batch.requiredSessions}</p></Link><div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>{student.status === "ready_for_completion" && hasPermission("training.complete") && <Button onClick={() => void completeTraining(student.id).then(load).catch((reason) => setError(trainingErrorMessage(reason)))}>Complete Student</Button>}{student.status === "in_progress" && hasPermission("training.enroll") && <Button variant="danger" onClick={() => { if (!window.confirm("Withdraw this student? Attendance, notes, dates, and history will be preserved.")) return; const reason = window.prompt("Reason for withdrawal") ?? ""; void withdrawTrainingEnrollment(student.id, reason).then(load).catch((reasonValue) => setError(trainingErrorMessage(reasonValue))); }}>Withdraw</Button>}</div></article>
        ))}</div>
      </section>

      {completedStudents.length > 0 && <section style={{ padding: "clamp(16px, 4vw, 24px)", border: "1px solid #dbe3ec", borderRadius: 18, background: "#fff" }}><h2 style={{ marginTop: 0 }}>Completed Students ({completedStudents.length})</h2><div style={{ display: "grid", gap: 12 }}>{completedStudents.map((student) => <article key={student.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 16, border: "1px solid #e2e8f0", borderRadius: 12 }}><Link to={`/admin/training/${programSlug}/members/${student.id}`} state={{ returnTo: location.pathname }}>{student.firstName} {student.lastName}</Link>{hasPermission("admin.settings") && <Button variant="secondary" onClick={() => { if (!window.confirm("Reopen this completed student as In Progress? Attendance, notes, dates, and audit history will be preserved.")) return; const reason = window.prompt("Reason for reopening this completion") ?? ""; void reopenTrainingEnrollment(student.id, reason).then(load).catch((reasonValue) => setError(trainingErrorMessage(reasonValue))); }}>Reopen Training</Button>}</article>)}</div></section>}

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
        {cancelledEnrollments.length > 0 && <section style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}><h3 style={{ margin: 0, fontSize: 16 }}>Cancelled enrollments</h3><p style={{ margin: "5px 0 12px", color: "#64748b", fontSize: 14 }}>{workspace.batch.status === "open" ? "Restore the original attempt instead of creating a duplicate." : "Restoration is available before the next class starts."}</p><div style={{ display: "grid", gap: 8 }}>{cancelledEnrollments.map((item) => <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: 12, border: "1px solid #e2e8f0", borderRadius: 10 }}><span>{item.firstName} {item.lastName}</span><Button variant="secondary" disabled={workspace.batch.status !== "open"} onClick={() => { if (!window.confirm(`Restore ${item.firstName} ${item.lastName} to Pending Enrollment in this class?`)) return; void restoreTrainingEnrollment(item.id, workspace.batch.id, "Restored from Current Class enrollment picker").then(async () => { setNotice(`${item.firstName} ${item.lastName} was restored to Pending Enrollment.`); setShowStudents(false); await load(); }).catch((reason) => setEnrollmentError(trainingErrorMessage(reason))); }}>Restore Enrollment</Button></div>)}</div></section>}
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
                setNotice(`${count} student${count === 1 ? "" : "s"} enrolled successfully.`);
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
        <div style={{ display: "grid", gap: 14 }}><p style={{ margin: 0 }}><strong>{sessionTitle}</strong></p><label>Session Date<Input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} /></label><label>Reason (optional)<Input value={sessionReason} onChange={(event) => setSessionReason(event.target.value)} placeholder="Reason for schedule change" /></label><p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Session IDs, attendance, remedials, and week numbers are preserved.</p><div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}><Button variant="secondary" onClick={() => setSelectedSession(null)}>Cancel</Button><Button disabled={!sessionDate} onClick={() => { if (!selectedSession) return; void rescheduleTrainingSession(selectedSession.id,sessionDate,false,sessionReason).then(() => { setSelectedSession(null); return load(); }).catch((reason) => setError(trainingErrorMessage(reason))); }}>Update This Session Only</Button><Button disabled={!sessionDate} onClick={() => { if (!selectedSession || !window.confirm("Move this session and every succeeding regular session by the same number of days?")) return; void rescheduleTrainingSession(selectedSession.id,sessionDate,true,sessionReason).then(() => { setSelectedSession(null); return load(); }).catch((reason) => setError(trainingErrorMessage(reason))); }}>Update This and Succeeding Sessions</Button></div></div>
      </Modal>
      <Modal open={Boolean(selectedAbsence)} title={selectedAbsence?.remedialId ? "Update Remedial Schedule" : "Schedule Remedial Attendance"} onClose={() => setSelectedAbsence(null)}>
        {selectedAbsence && <div style={{ display: "grid", gap: 14 }}><p style={{ margin: 0 }}><strong>{selectedAbsence.studentName}</strong><br />Missed session: {selectedAbsence.sessionTitle}</p><label>Remedial Date<Input type="date" value={remedialDate} onChange={(event) => setRemedialDate(event.target.value)} /></label><label>Notes<Input value={remedialNotes} onChange={(event) => setRemedialNotes(event.target.value)} placeholder="Optional remedial details" /></label><div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 10 }}><Button variant="secondary" onClick={() => setSelectedAbsence(null)}>Cancel</Button><Button disabled={!remedialDate} onClick={() => void scheduleRemedial(selectedAbsence.enrollmentId, selectedAbsence.sessionId, remedialDate, remedialNotes).then(async () => { const updated = Boolean(selectedAbsence.remedialId); setSelectedAbsence(null); setNotice(updated ? "Remedial schedule updated." : "Remedial attendance scheduled."); await load(); }).catch((reason) => setError(trainingErrorMessage(reason)))}>{selectedAbsence.remedialId ? "Update Remedial Schedule" : "Schedule Remedial"}</Button></div></div>}
      </Modal>
    </div>
  );
}
