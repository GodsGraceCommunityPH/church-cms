import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useAuth } from "../../features/auth/auth";
import { addTrainingNote, getMemberTrainingProfile, trainingErrorMessage, trainingStatusLabel, updateEnrollmentStatus, updateTrainingNote, type MemberTrainingProfile as Profile } from "../../features/training/trainingService";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : "Not recorded";
}

const panel = { padding: 24, border: "1px solid #dbe3ec", borderRadius: 16, background: "#fff", boxShadow: "0 2px 8px rgba(15,23,42,.06)" } as const;

export default function MemberTrainingProfile() {
  const { enrollmentId, programSlug } = useParams();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { if (!enrollmentId) return; try { setProfile(await getMemberTrainingProfile(enrollmentId)); setError(""); } catch (reason) { setError(trainingErrorMessage(reason)); } }, [enrollmentId]);
  useEffect(() => { void load(); }, [load]);
  const completedAttendance = useMemo(() => profile?.sessions.filter((session) => ["present", "late"].includes(session.status ?? "") || (profile.excusedCounts && session.status === "excused")).length ?? 0, [profile]);
  if (!profile) return <p style={{ padding: 40, textAlign: "center", color: error ? "#b91c1c" : "#64748b" }}>{error || "Loading Training Profile..."}</p>;
  const enrollment = profile.enrollment;
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? `/admin/training/${programSlug}`;
  const requiredSessions = profile.requiredSessions;
  const eligible = requiredSessions > 0 && completedAttendance >= requiredSessions;
  return <div style={{ display: "grid", gap: 22 }}>
    <header><Link to={returnTo}>← Back</Link><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginTop: 16 }}><div><p style={{ margin: 0, color: "#55613b", fontWeight: 700 }}>{profile.programName}</p><h1 style={{ margin: "5px 0 8px", fontSize: 30 }}>{enrollment.firstName} {enrollment.lastName}</h1><span style={{ display: "inline-block", padding: "5px 11px", borderRadius: 999, background: "#f1f5f9", fontWeight: 700 }}>{trainingStatusLabel(enrollment.status)}</span></div><Link to={`/admin/members/${enrollment.memberId}`} state={{ returnTo: location.pathname }} style={{ padding: "10px 16px", border: "1px solid #cbd5e1", borderRadius: 8, color: "inherit", textDecoration: "none" }}>View Member Profile</Link></div></header>
    {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
    <section style={panel}><h2 style={{ margin: 0, fontSize: 20 }}>Enrollment Summary</h2><dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 16, margin: "18px 0 0" }}><div><dt style={{ color: "#64748b" }}>Enrollment</dt><dd style={{ margin: "5px 0 0" }}>{formatDate(enrollment.enrolledAt)}</dd></div>{enrollment.startedAt && <div><dt style={{ color: "#64748b" }}>Started</dt><dd style={{ margin: "5px 0 0" }}>{formatDate(enrollment.startedAt)}</dd></div>}{enrollment.completedAt && <div><dt style={{ color: "#64748b" }}>Completed</dt><dd style={{ margin: "5px 0 0" }}>{formatDate(enrollment.completedAt)}</dd></div>}</dl></section>
    <section style={panel}><h2 style={{ margin: 0, fontSize: 20 }}>Progress</h2><p style={{ fontSize: 18, fontWeight: 700 }}>{completedAttendance} / {requiredSessions} sessions completed</p><div style={{ padding: 14, borderRadius: 12, background: eligible ? "#ecfdf5" : "#f8fafc" }}>☑ Required attendance {eligible ? "completed — Eligible for Completion" : "not yet completed"}</div><div style={{ display: "grid", gap: 9, marginTop: 16 }}>{profile.sessions.map((session) => <div key={session.sessionId} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 0", borderBottom: "1px solid #e2e8f0" }}><span>{session.title}</span><span>{session.status ? trainingStatusLabel(session.status) : "Not recorded"}</span></div>)}</div></section>
    {hasPermission("training.enroll") && enrollment.status === "pending_enrollment" && <section style={panel}><Button variant="danger" onClick={() => { if (!window.confirm("Cancel this enrollment? It can be restored later without creating a duplicate.")) return; void updateEnrollmentStatus(enrollment.id, "cancelled").then(load); }}>Cancel Enrollment</Button></section>}
    <section style={panel}><h2 style={{ margin: 0, fontSize: 20 }}>Trainer Notes</h2>{hasPermission("training.enroll") && <form style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }} onSubmit={(event) => { event.preventDefault(); if (!note.trim()) return; setSaving(true); void addTrainingNote(enrollment.id,note.trim()).then(() => { setNote(""); return load(); }).catch((reason) => setError(trainingErrorMessage(reason))).finally(() => setSaving(false)); }}><Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a training note..." /><Button type="submit" disabled={saving || !note.trim()}>Add Note</Button></form>}<div style={{ display: "grid", gap: 10, marginTop: 16 }}>{profile.notes.length ? profile.notes.map((item) => <article key={item.id} style={{ padding: 14, borderRadius: 10, background: "#f8fafc" }}><p style={{ margin: 0 }}>{item.note}</p><small>{item.author} · {formatDate(item.createdAt)}</small>{hasPermission("training.enroll") && <button style={{ display: "block", marginTop: 8 }} onClick={() => { const revised = window.prompt("Edit trainer note",item.note); if (!revised?.trim()) return; void updateTrainingNote(item.id,revised.trim()).then(load).catch((reason) => setError(trainingErrorMessage(reason))); }}>Edit</button>}</article>) : <p>No notes recorded.</p>}</div></section>
  </div>;
}
