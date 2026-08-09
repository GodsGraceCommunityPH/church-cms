import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import SearchableSelect from "../../components/ui/SearchableSelect";
import Modal from "../../components/Modal";
import { useAuth } from "../../features/auth/auth";
import { addTrainingNote, attendanceStatusLabel, changeTrainingGuide, getGuideCandidates, getMemberTrainingProfile, trainingErrorMessage, trainingStatusLabel, updateTrainingNote, type MemberTrainingProfile as Profile } from "../../features/training/trainingService";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : "Not recorded";
}

const panel = { padding: "clamp(16px, 4vw, 24px)", border: "1px solid #dbe3ec", borderRadius: 16, background: "#fff", boxShadow: "0 2px 8px rgba(15,23,42,.06)", minWidth: 0 } as const;
const labelStyle = { color: "#64748b" } as const;
const attendanceAppearance: Record<string, { background: string; color: string; dot: string }> = {
  present: { background: "#ecfdf5", color: "#166534", dot: "#22c55e" },
  late: { background: "#fffbeb", color: "#92400e", dot: "#f59e0b" },
  absent: { background: "#fef2f2", color: "#b91c1c", dot: "#ef4444" },
  excused: { background: "#f1f5f9", color: "#475569", dot: "#94a3b8" },
  not_recorded: { background: "#f8fafc", color: "#64748b", dot: "#cbd5e1" },
};

export default function MemberTrainingProfile() {
  const { enrollmentId, programSlug } = useParams();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideCandidates, setGuideCandidates] = useState<Awaited<ReturnType<typeof getGuideCandidates>>>([]);
  const [newGuideId, setNewGuideId] = useState("");
  const [guideReason, setGuideReason] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const load = useCallback(async () => { if (!enrollmentId) return; try { setProfile(await getMemberTrainingProfile(enrollmentId)); setError(""); } catch (reason) { setError(trainingErrorMessage(reason)); } }, [enrollmentId]);
  useEffect(() => { void load(); }, [load]);
  const completedAttendance = useMemo(() => profile?.sessions.filter((session) => ["present", "late"].includes(session.status ?? "") || (profile.excusedCounts && session.status === "excused") || (session.status === "absent" && session.remedialStatus === "completed")).length ?? 0, [profile]);
  if (!profile) return <p style={{ padding: 40, textAlign: "center", color: error ? "#b91c1c" : "#64748b" }}>{error || "Loading Training Profile..."}</p>;

  const enrollment = profile.enrollment;
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? `/admin/training/${programSlug}`;
  const eligible = profile.requiredSessions > 0 && completedAttendance >= profile.requiredSessions;
  const currentGuide = profile.guideHistory.find((item) => !item.endedAt);
  const activeEnrollment = ["pending_enrollment", "in_progress", "for_remedial", "ready_for_completion"].includes(enrollment.status);
  const visibleProfileSessions = showAllSessions ? profile.sessions : profile.sessions.slice(0, 5);

  const openGuideDialog = async () => {
    try { setGuideCandidates(await getGuideCandidates()); setNewGuideId(""); setGuideReason(""); setShowGuide(true); }
    catch (reason) { setError(trainingErrorMessage(reason)); }
  };

  return <div style={{ display: "grid", gap: 22 }}>
    <header><Link to={returnTo}>← Back to Current Class</Link><div style={{ marginTop: 16 }}><p style={{ margin: 0, color: "#55613b", fontWeight: 700 }}>{profile.programName}</p><h1 style={{ margin: "5px 0 8px", fontSize: "clamp(26px,5vw,36px)" }}>{enrollment.firstName} {enrollment.lastName}</h1><span style={{ display: "inline-block", padding: "5px 11px", borderRadius: 999, background: "#f1f5f9", fontWeight: 700 }}>{trainingStatusLabel(enrollment.status)}</span></div></header>
    {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}

    <section style={panel}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}><h2 style={{ margin: 0, fontSize: 20 }}>Enrollment Overview</h2>{activeEnrollment && hasPermission("training.enroll") && <button type="button" className="training-icon-button" aria-label="Change Guide" title="Change Guide" onClick={() => void openGuideDialog()}><Pencil size={16} aria-hidden="true" /></button>}</div><dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(150px,100%),1fr))", gap: 16, margin: "18px 0 0" }}>
      <div><dt style={labelStyle}>Cell Group</dt><dd>{profile.cellGroupName ?? "Not recorded"}</dd></div><div><dt style={labelStyle}>Guide</dt><dd>{currentGuide?.guideName ?? "Guide not assigned"}</dd></div><div><dt style={labelStyle}>Status</dt><dd>{trainingStatusLabel(enrollment.status)}</dd></div>
    </dl></section>

    <section style={panel}><h2 style={{ margin: 0, fontSize: 20 }}>Progress</h2><p style={{ fontSize: 18, fontWeight: 700 }}>{completedAttendance} / {profile.requiredSessions} sessions completed</p><div style={{ padding: 14, borderRadius: 12, background: eligible ? "#ecfdf5" : "#f8fafc" }}>Required attendance {eligible ? "completed — Eligible for Completion" : "not yet completed"}</div>
      {profile.requirements.length > 0 && <div style={{ marginTop: 18 }}><h3 style={{ margin: "0 0 10px", fontSize: 17 }}>Additional Requirements <small style={{ color: "#64748b", fontWeight: 400 }}>(progress only)</small></h3><div style={{ display: "grid", gap: 8 }}>{profile.requirements.map((requirement) => { const assignedSessions=profile.sessions.filter((session) => session.requirements.some((item) => item.id===requirement.id)); const completed=assignedSessions.filter((session) => session.requirements.some((item) => item.id===requirement.id && item.completed)).length; return <div key={requirement.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 10, background: "#f8fafc", borderRadius: 9 }}><span>{requirement.name}{!requirement.isActive ? " (Inactive)" : ""}</span><strong>{completed} / {assignedSessions.length}</strong></div>; })}</div></div>}
      <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 14, marginTop: 20 }} aria-label="Attendance legend">{[{ key: "present", label: "Present" }, { key: "late", label: "Late" }, { key: "absent", label: "Absent" }, { key: "excused", label: "Excused" }].map((item) => <span key={item.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}><span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: attendanceAppearance[item.key].dot }} />{item.label}</span>)}</div>
      {profile.requirements.length > 0 && <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 14, marginTop: 10, fontSize: 13 }} aria-label="Requirement legend"><span>☑ Completed</span><span>☐ Not completed</span></div>}
      <div style={{ display: "grid", gap: 9, marginTop: 12 }}>{visibleProfileSessions.map((session) => { const attendanceKey = session.status?.toLowerCase() ?? "not_recorded"; const appearance = attendanceAppearance[attendanceKey] ?? attendanceAppearance.not_recorded; return <div key={session.sessionId} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(160px,100%),1fr))", alignItems: "center", gap: 14, padding: "14px 12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff" }}><div><strong>{session.title}</strong><small style={{ display: "block", marginTop: 4, color: "#64748b" }}>{formatDate(session.sessionDate)}</small></div><div><small style={{ display: "block", marginBottom: 5, color: "#64748b" }}>Attendance</small><span style={{ display: "inline-flex", padding: "4px 9px", borderRadius: 7, background: appearance.background, color: appearance.color, fontWeight: 700, fontSize: 13 }}>{attendanceStatusLabel(session.status)}</span>{session.status === "absent" && session.remedialStatus && <small style={{ display: "block", marginTop: 4, color: session.remedialStatus === "completed" ? "#166534" : "#92400e" }}>Remedial {session.remedialStatus}{session.remedialCompletedAt ? ` · ${formatDate(session.remedialCompletedAt)}` : ""}</small>}</div><div><small style={{ display: "block", marginBottom: 5, color: "#64748b" }}>Requirements</small>{session.requirements.length===0 ? <span style={{ color: "#64748b" }}>No additional requirements</span> : session.requirements.map((item) => <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}><input type="checkbox" checked={item.completed} readOnly tabIndex={-1} aria-label={`${item.name}: ${item.completed ? "Completed" : "Not completed"}`} style={{ pointerEvents: "none", accentColor: "#4f6f2a" }} /><span>{item.name}</span></label>)}</div></div>; })}</div>
      {profile.sessions.length > 5 && <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}><Button variant="secondary" onClick={() => setShowAllSessions((current) => !current)}>{showAllSessions ? "Show Recent 5 Sessions" : "View Full History"}</Button></div>}
    </section>

    {profile.guideHistory.length > 1 && <section style={panel}><h2 style={{ margin: 0, fontSize: 20 }}>Guide History</h2><div style={{ display: "grid", gap: 10, marginTop: 16 }}>{profile.guideHistory.map((assignment) => <article key={assignment.id} style={{ padding: 12, borderRadius: 10, background: "#f8fafc" }}><strong>{assignment.guideName}</strong><p style={{ margin: "5px 0 0", color: "#64748b" }}>{assignment.endedAt ? `${formatDate(assignment.assignedAt)} – ${formatDate(assignment.endedAt)}` : `Current · Assigned ${formatDate(assignment.assignedAt)}`}</p>{assignment.changeReason && <small>Reason: {assignment.changeReason}</small>}</article>)}</div></section>}

    <section style={panel}><h2 style={{ margin: 0, fontSize: 20 }}>Trainer Notes</h2>{hasPermission("training.enroll") && enrollment.status !== "completed" && <form style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }} onSubmit={(event) => { event.preventDefault(); if (!note.trim()) return; setSaving(true); void addTrainingNote(enrollment.id, note.trim()).then(() => { setNote(""); return load(); }).catch((reason) => setError(trainingErrorMessage(reason))).finally(() => setSaving(false)); }}><Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a training note..." /><Button type="submit" disabled={saving || !note.trim()}>Add Note</Button></form>}<div style={{ display: "grid", gap: 10, marginTop: 16 }}>{profile.notes.length ? profile.notes.map((item) => <article key={item.id} style={{ padding: 14, borderRadius: 10, background: "#f8fafc" }}><p style={{ margin: 0 }}>{item.note}</p><small>{item.author} · {formatDate(item.createdAt)}</small>{hasPermission("training.enroll") && enrollment.status !== "completed" && <button style={{ display: "block", marginTop: 8 }} onClick={() => { const revised = window.prompt("Edit trainer note", item.note); if (!revised?.trim()) return; void updateTrainingNote(item.id, revised.trim()).then(load).catch((reason) => setError(trainingErrorMessage(reason))); }}>Edit</button>}</article>) : <p>No notes recorded.</p>}</div></section>

    <Modal open={showGuide} title="Change Guide" onClose={() => setShowGuide(false)}><div style={{ display: "grid", gap: 14 }}><p style={{ margin: 0 }}>Current Guide: <strong>{currentGuide?.guideName ?? "Not assigned"}</strong></p><label>New Guide *<SearchableSelect value={newGuideId} onChange={setNewGuideId} placeholder="Search and select Guide" options={guideCandidates.filter((guide) => guide.id !== enrollment.memberId && guide.id !== currentGuide?.guideMemberId).map((guide) => ({ id: guide.id, label: `${guide.first_name} ${guide.last_name}${guide.email ? ` — ${guide.email}` : ""}` }))} /></label><label>Reason (optional)<Input value={guideReason} onChange={(event) => setGuideReason(event.target.value)} /></label><div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}><Button variant="secondary" onClick={() => setShowGuide(false)}>Cancel</Button><Button disabled={!newGuideId || saving} onClick={() => { setSaving(true); void changeTrainingGuide(enrollment.id, newGuideId, guideReason).then(async () => { setShowGuide(false); await load(); }).catch((reason) => setError(trainingErrorMessage(reason))).finally(() => setSaving(false)); }}>{saving ? "Changing..." : "Change Guide"}</Button></div></div></Modal>
  </div>;
}
