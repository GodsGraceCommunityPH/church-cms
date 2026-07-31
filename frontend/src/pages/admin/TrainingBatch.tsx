import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/Modal";
import { useAuth } from "../../features/auth/auth";
import {
  createTrainingRequirement,
  createTrainingSession,
  enrollBatchStudents,
  getAvailableMembers,
  getTrainingBatchWorkspace,
  saveAttendance,
  trainingErrorMessage,
} from "../../features/training/trainingService";

export default function TrainingBatch() {
  const { batchId, programSlug } = useParams();
  const { hasPermission } = useAuth();
  const [workspace, setWorkspace] = useState<Awaited<ReturnType<typeof getTrainingBatchWorkspace>> | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [showStudents, setShowStudents] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [requirementName, setRequirementName] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!batchId) return;
    try { setWorkspace(await getTrainingBatchWorkspace(batchId)); }
    catch (reason) { setError(trainingErrorMessage(reason)); }
  }, [batchId]);
  useEffect(() => { void load(); }, [load]);

  const filteredMembers = useMemo(() => {
    const keyword = search.toLowerCase();
    return members.filter((member) => `${member.first_name} ${member.last_name}`.toLowerCase().includes(keyword));
  }, [members, search]);

  if (!workspace) return <p className="py-12 text-center text-slate-500">{error || "Loading batch..."}</p>;

  return (
    <div className="space-y-6">
      <header>
        <Link to={`/admin/training/${programSlug}`} className="text-sm font-medium text-olive-700 hover:underline">← Back to {workspace.program.name}</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-medium text-olive-700">{workspace.program.name}</p><h1 className="text-3xl font-bold">{workspace.batch.name}</h1><p className="mt-2 text-slate-600">Trainer: {workspace.batch.trainerName ?? "Not assigned"}</p></div>
          {hasPermission("training.enroll") && <Button onClick={() => void getAvailableMembers(workspace.program.id).then((data) => { setMembers(data); setShowStudents(true); })}>+ Add Students</Button>}
        </div>
      </header>
      {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Sessions</h2>
          {hasPermission("training.enroll") && <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!sessionName.trim()) return; void createTrainingSession(workspace.batch.id, sessionName.trim(), null).then(() => { setSessionName(""); return load(); }); }}><Input value={sessionName} onChange={(event) => setSessionName(event.target.value)} placeholder="Week 1" /><Button type="submit">Add</Button></form>}
          <div className="mt-4 space-y-3">{workspace.sessions.length === 0 ? <p className="text-slate-500">No sessions configured.</p> : workspace.sessions.map((session) => (
            <article key={session.id} className="rounded-xl border border-slate-200 p-3"><p className="font-medium">{session.title}</p><div className="mt-2 space-y-2">{workspace.enrollments.map((student) => (
              <div key={student.id} className="flex items-center justify-between gap-2 text-sm"><span>{student.firstName} {student.lastName}</span>{hasPermission("training.attendance") && <select className="rounded-lg border border-slate-300 p-1" defaultValue="" onChange={(event) => void saveAttendance(student.id, session.id, event.target.value)}><option value="" disabled>Attendance</option><option value="present">Present</option><option value="late">Late</option><option value="excused">Excused</option><option value="absent">Absent</option></select>}</div>
            ))}</div></article>
          ))}</div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Program requirements</h2>
          {hasPermission("training.enroll") && <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!requirementName.trim()) return; void createTrainingRequirement(workspace.program.id, requirementName.trim()).then(() => { setRequirementName(""); return load(); }); }}><Input value={requirementName} onChange={(event) => setRequirementName(event.target.value)} placeholder="Memory Verse" /><Button type="submit">Add</Button></form>}
          <ul className="mt-4 space-y-2">{workspace.requirements.length === 0 ? <li className="text-slate-500">No requirements configured.</li> : workspace.requirements.map((requirement) => <li key={requirement.id} className="rounded-xl border border-slate-200 p-3">□ {requirement.name}</li>)}</ul>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Students ({workspace.enrollments.length})</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{workspace.enrollments.map((student) => (
          <Link key={student.id} to={`/admin/training/${programSlug}/members/${student.id}`} className="rounded-xl border border-slate-200 p-4 hover:border-olive-400"><p className="font-semibold">{student.firstName} {student.lastName}</p><p className="text-sm text-slate-500">{student.status.replaceAll("_", " ")}</p></Link>
        ))}</div>
      </section>

      <Modal open={showStudents} title="Add Students" onClose={() => setShowStudents(false)}>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members..." />
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{filteredMembers.map((member) => (
          <label key={member.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"><input type="checkbox" checked={selected.has(member.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(member.id); else next.delete(member.id); return next; })} /><span>{member.first_name} {member.last_name}</span></label>
        ))}</div>
        <p className="mt-3 text-sm text-slate-600">Selected ({selected.size})</p>
        <Button className="mt-3 w-full" disabled={selected.size === 0} onClick={() => void enrollBatchStudents(workspace.batch.id, Array.from(selected)).then(() => { setShowStudents(false); setSelected(new Set()); return load(); })}>Enroll Selected</Button>
      </Modal>
    </div>
  );
}
