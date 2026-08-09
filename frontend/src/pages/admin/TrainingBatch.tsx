import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, GripVertical, Pencil } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import SearchableSelect from "../../components/ui/SearchableSelect";
import Textarea from "../../components/ui/Textarea";
import Modal from "../../components/Modal";
import { useAuth } from "../../features/auth/auth";
import {
  completeTraining,
  completeTrainingCycle,
  completeRemedial,
  correctCompletedStudentSessionRecord,
  enrollBatchStudents,
  getAvailableMembers,
  getGuideCandidates,
  getCancelledTrainingEnrollments,
  getTrainingBatchWorkspace,
  isActiveTrainingStatus,
  saveAttendance,
  saveSessionRequirement,
  saveTrainingRosterOrder,
  saveTrainingProgramRequirement,
  setTrainingProgramRequirementActive,
  setTrainingSessionRequirements,
  scheduleRemedial,
  startTrainingCycle,
  updateTrainingSessionDetails,
  restoreTrainingEnrollment,
  withdrawTrainingEnrollment,
  trainingErrorMessage,
  attendanceStatusLabel,
  trainingStatusLabel,
} from "../../features/training/trainingService";

const attendanceBadgeStyle = (status: string | null | undefined) => {
  const styles: Record<string, { background: string; color: string; border: string }> = {
    present: { background: "#dcfce7", color: "#166534", border: "#bbf7d0" },
    late: { background: "#fef3c7", color: "#92400e", border: "#fde68a" },
    excused: { background: "#dbeafe", color: "#1e40af", border: "#bfdbfe" },
    absent: { background: "#fee2e2", color: "#b91c1c", border: "#fecaca" },
  };
  return styles[status ?? ""] ?? { background: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
};

export default function TrainingBatch() {
  const { batchId, programSlug } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const [workspace, setWorkspace] = useState<Awaited<ReturnType<typeof getTrainingBatchWorkspace>> | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; first_name: string; last_name: string; cell_group_id?: string | null; cell_groups?: Array<{ name: string }> }>>([]);
  const [cancelledEnrollments, setCancelledEnrollments] = useState<Awaited<ReturnType<typeof getCancelledTrainingEnrollments>>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [guideCandidates, setGuideCandidates] = useState<Array<{ id: string; first_name: string; last_name: string; email?: string | null }>>([]);
  const [guidesByStudent, setGuidesByStudent] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [showStudents, setShowStudents] = useState(false);
  const [hasEnrollmentDraft, setHasEnrollmentDraft] = useState(false);
  const [enrollmentDraftHydrated, setEnrollmentDraftHydrated] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState("");
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, string | null>>({});
  const [completionSession, setCompletionSession] = useState<{ id: string; title: string; sessionDate: string | null } | null>(null);
  const [completingSession, setCompletingSession] = useState(false);
  const [savingRequirement, setSavingRequirement] = useState("");
  const [showRequirement, setShowRequirement] = useState(false);
  const [showAddRequirementName, setShowAddRequirementName] = useState(false);
  const [requirementSession, setRequirementSession] = useState<{ id: string; title: string } | null>(null);
  const [newRequirementName, setNewRequirementName] = useState("");
  const [addingRequirement, setAddingRequirement] = useState(false);
  const [sessionRequirementDraft, setSessionRequirementDraft] = useState<string[]>([]);
  const [savingRequirementAssignments, setSavingRequirementAssignments] = useState(false);
  const [correction, setCorrection] = useState<{ enrollmentId: string; studentName: string; sessionId: string; sessionTitle: string; sessionDate: string | null; currentAttendance: string | null } | null>(null);
  const [correctedAttendance, setCorrectedAttendance] = useState("");
  const [correctedRequirements, setCorrectedRequirements] = useState<Record<string, boolean>>({});
  const [correctionReason, setCorrectionReason] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSession, setSelectedSession] = useState<{ id: string; title: string; session_date: string | null; display_order: number } | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [savingSession, setSavingSession] = useState(false);
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
  const [rosterOrder, setRosterOrder] = useState<string[]>([]);
  const [genderSectionOrder, setGenderSectionOrder] = useState<string[]>(["female", "male"]);
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);
  const [draggedGenderSection, setDraggedGenderSection] = useState<string | null>(null);
  const [savingRosterOrder, setSavingRosterOrder] = useState(false);
  const rosterOrderRef = useRef<string[]>([]);
  const genderSectionOrderRef = useRef<string[]>(["female", "male"]);
  const persistRosterOrderRef = useRef<(nextRosterOrder: string[], nextGenderOrder: string[]) => Promise<void>>(async () => undefined);
  const [selectedAbsence, setSelectedAbsence] = useState<{ enrollmentId: string; sessionId: string; studentName: string; sessionTitle: string; remedialId?: string } | null>(null);
  const [remedialDate, setRemedialDate] = useState(new Date().toISOString().slice(0, 10));
  const [remedialNotes, setRemedialNotes] = useState("");
  const studentAccent = (value: string) => {
    const palette = [{ bg: "#fee2e2", border: "#fca5a5", text: "#9f1239" }, { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" }, { bg: "#dcfce7", border: "#86efac", text: "#166534" }, { bg: "#ede9fe", border: "#c4b5fd", text: "#5b21b6" }];
    return palette[Array.from(value).reduce((total, character) => total + character.charCodeAt(0), 0) % palette.length];
  };
  const enrollmentDraftKey = batchId ? `ggccc-training-enrollment-draft:${batchId}` : "";

  useEffect(() => {
    if (!enrollmentDraftKey) return;
    try {
      const draft = JSON.parse(window.localStorage.getItem(enrollmentDraftKey) ?? "null") as { selected?: string[] } | null;
      setHasEnrollmentDraft(Boolean(draft?.selected?.length));
    } catch {
      window.localStorage.removeItem(enrollmentDraftKey);
      setHasEnrollmentDraft(false);
    }
  }, [enrollmentDraftKey]);

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
  const activeStudents = useMemo(() => {
    const students = workspace?.enrollments.filter((student) => isActiveTrainingStatus(student.status)) ?? [];
    const order = new Map(rosterOrder.map((id, index) => [id, index]));
    return [...students].sort((left, right) =>
      (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [rosterOrder, workspace]);
  const completedStudents = workspace?.enrollments.filter((student) => student.status === "completed") ?? [];
  const historicalStudents = workspace?.enrollments ?? [];
  const regularSessions = useMemo(
    () => workspace?.sessions.slice(0, workspace.batch.requiredSessions) ?? [],
    [workspace],
  );
  const attendanceFor = (studentId: string, sessionId: string) => workspace?.attendance.find((item) => item.member_training_id === studentId && item.session_id === sessionId);
  const attendanceDraftKey = (studentId: string, sessionId: string) => `${studentId}:${sessionId}`;
  const attendanceStatusFor = (studentId: string, sessionId: string) => {
    const key = attendanceDraftKey(studentId, sessionId);
    return Object.prototype.hasOwnProperty.call(attendanceDraft, key)
      ? attendanceDraft[key]
      : attendanceFor(studentId, sessionId)?.status ?? null;
  };
  const remedialFor = (studentId: string, sessionId: string) => workspace?.remedials.find((item) => item.member_training_id === studentId && item.session_id === sessionId && item.status !== "cancelled");
  const obligationSatisfied = (studentId: string, sessionId: string) => {
    const attendance = attendanceFor(studentId, sessionId);
    return Boolean(attendance && (["present", "late"].includes(attendance.status) || (workspace?.batch.excusedCounts && attendance.status === "excused") || (attendance.status === "absent" && remedialFor(studentId, sessionId)?.status === "completed")));
  };
  const attendanceCount = (studentId: string) => regularSessions.filter((session) => obligationSatisfied(studentId, session.id)).length;
  const requirementCompleted = (studentId: string, sessionId: string, requirementId: string) => workspace?.requirementProgress.some((item: any) => item.member_training_id === studentId && item.training_session_id === sessionId && item.program_requirement_id === requirementId && item.completed) ?? false;
  const requirementsForSession = (sessionId: string) => workspace?.requirements.filter((requirement) => workspace.sessionRequirements.some((assignment) => assignment.sessionId === sessionId && assignment.requirementId === requirement.id)) ?? [];
  const currentSessionIndex = classStarted
    ? activeStudents.length === 0
      ? 0
      : regularSessions.findIndex((session) => activeStudents.some((student) => !attendanceFor(student.id, session.id)))
    : -1;
  const visibleSessions = regularSessions;
  const focusedSessionIndex = Math.max(0, regularSessions.findIndex((session) => session.id === focusedSessionId));
  const focusedSession = regularSessions[focusedSessionIndex] ?? null;
  const focusedSessionIsCurrent = Boolean(focusedSession && focusedSession.id === regularSessions[currentSessionIndex]?.id);
  const focusedSessionIsCompleted = Boolean(
    focusedSession && classStarted && (currentSessionIndex < 0 || focusedSessionIndex < currentSessionIndex),
  );
  const normalizedGender = (value: string | null) => value?.trim().toLowerCase() ?? "";
  const genderGroups = [
    ...genderSectionOrder.map((key) => ({
      key,
      label: key.toUpperCase(),
      students: activeStudents.filter((student) => normalizedGender(student.gender) === key),
    })),
    {
      key: "not_recorded",
      label: "GENDER NOT RECORDED",
      students: activeStudents.filter((student) => !["female", "male"].includes(normalizedGender(student.gender))),
    },
  ].filter((group) => group.students.length > 0);
  const attendanceGroups = genderGroups;
  const unresolvedAbsences = activeStudents.flatMap((student) => regularSessions.flatMap((session) => {
    const attendance = attendanceFor(student.id, session.id);
    const remedial = remedialFor(student.id, session.id);
    return attendance?.status === "absent" && remedial?.status !== "completed"
      ? [{ student, session, remedial }]
      : [];
  }));
  const completionSummary = completionSession
    ? activeStudents.reduce((summary, student) => {
        const status = attendanceStatusFor(student.id, completionSession.id);
        const resolvedStatus: "present" | "late" | "excused" | "notMarked" =
          status === "present" || status === "late" || status === "excused" ? status : "notMarked";
        summary[resolvedStatus] += 1;
        return summary;
      }, { present: 0, late: 0, excused: 0, notMarked: 0 })
    : { present: 0, late: 0, excused: 0, notMarked: 0 };
  const focusedAttendanceSummary = focusedSession
    ? activeStudents.reduce((summary, student) => {
        const status = focusedSessionIsCurrent
          ? attendanceStatusFor(student.id, focusedSession.id)
          : attendanceFor(student.id, focusedSession.id)?.status ?? null;
        if (!status && !focusedSessionIsCurrent) return summary;
        const resolvedStatus: "present" | "late" | "excused" | "absent" | "notMarked" = status
          ? status === "present" || status === "late" || status === "excused" ? status : "absent"
          : "notMarked";
        summary[resolvedStatus] += 1;
        return summary;
      }, { present: 0, late: 0, excused: 0, absent: 0, notMarked: 0 })
    : { present: 0, late: 0, excused: 0, absent: 0, notMarked: 0 };

  useEffect(() => {
    if (!regularSessions.length) {
      setFocusedSessionId(null);
      return;
    }
    setFocusedSessionId((current) => {
      if (current && regularSessions.some((session) => session.id === current)) return current;
      if (currentSessionIndex >= 0) return regularSessions[currentSessionIndex]?.id ?? regularSessions[0].id;
      return regularSessions[regularSessions.length - 1].id;
    });
  }, [currentSessionIndex, regularSessions]);

  useEffect(() => {
    if (!workspace) return;
    const nextRosterOrder = workspace.enrollments.map((student) => student.id);
    setRosterOrder(nextRosterOrder);
    rosterOrderRef.current = nextRosterOrder;
    const savedSections = workspace.batch.genderSectionOrder.filter((section) => ["female", "male"].includes(section));
    const nextGenderOrder = savedSections.length === 2 ? savedSections : ["female", "male"];
    setGenderSectionOrder(nextGenderOrder);
    genderSectionOrderRef.current = nextGenderOrder;
  }, [workspace]);

  const persistRosterOrder = async (nextRosterOrder: string[], nextGenderOrder: string[]) => {
    if (!batchId || savingRosterOrder) return;
    setSavingRosterOrder(true);
    setError("");
    setNotice("");
    try {
      await saveTrainingRosterOrder(batchId, nextRosterOrder, nextGenderOrder);
      setNotice("Order Saved");
      await load();
    } catch (reason) {
      setError(trainingErrorMessage(reason));
      await load();
    } finally {
      setSavingRosterOrder(false);
    }
  };
  persistRosterOrderRef.current = persistRosterOrder;

  const reorderStudent = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const sourceStudent = activeStudents.find((student) => student.id === sourceId);
    const targetStudent = activeStudents.find((student) => student.id === targetId);
    if (!sourceStudent || !targetStudent || normalizedGender(sourceStudent.gender) !== normalizedGender(targetStudent.gender)) return;
    const nextOrder = [...rosterOrder];
    const sourceIndex = nextOrder.indexOf(sourceId);
    const targetIndex = nextOrder.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, sourceId);
    rosterOrderRef.current = nextOrder;
    setRosterOrder(nextOrder);
    void persistRosterOrder(nextOrder, genderSectionOrder);
  };

  const moveStudentWithinSection = (studentId: string, direction: -1 | 1) => {
    const group = genderGroups.find((item) => item.students.some((student) => student.id === studentId));
    if (!group) return;
    const index = group.students.findIndex((student) => student.id === studentId);
    const target = group.students[index + direction];
    if (target) reorderStudent(studentId, target.id);
  };

  const reorderGenderSection = (source: string, target: string) => {
    if (source === target || !["female", "male"].includes(source) || !["female", "male"].includes(target)) return;
    const nextOrder = [...genderSectionOrder];
    const sourceIndex = nextOrder.indexOf(source);
    const targetIndex = nextOrder.indexOf(target);
    nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, source);
    genderSectionOrderRef.current = nextOrder;
    setGenderSectionOrder(nextOrder);
    void persistRosterOrder(rosterOrder, nextOrder);
  };

  useEffect(() => {
    const root = document.querySelector(".training-gender-groups");
    if (!root || !batchId) return;

    let drag: {
      pointerId: number;
      type: "student" | "group";
      sourceId: string;
      sourceElement: HTMLElement;
      ghost: HTMLElement;
      offsetY: number;
      changed: boolean;
    } | null = null;

    const studentIdForRow = (row: Element | null) => {
      const href = row?.querySelector<HTMLAnchorElement>('a[href*="/members/"]')?.getAttribute("href") ?? "";
      return href.match(/\/members\/([^/?#]+)/)?.[1] ?? "";
    };
    const groupKeyForSection = (section: Element | null) => {
      const label = section?.querySelector(":scope > header strong")?.textContent?.trim().toLowerCase() ?? "";
      return label === "female" || label === "male" ? label : "";
    };
    const moveInOrder = (order: string[], source: string, target: string) => {
      if (!source || !target || source === target) return order;
      const next = [...order];
      const sourceIndex = next.indexOf(source);
      const targetIndex = next.indexOf(target);
      if (sourceIndex < 0 || targetIndex < 0) return order;
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      return next;
    };
    const finishDrag = () => {
      if (!drag) return;
      const completedDrag = drag;
      drag = null;
      completedDrag.ghost.remove();
      completedDrag.sourceElement.classList.remove("training-drag-source");
      document.body.classList.remove("training-pointer-dragging");
      setDraggedStudentId(null);
      setDraggedGenderSection(null);
      if (completedDrag.changed) {
        void persistRosterOrderRef.current(rosterOrderRef.current, genderSectionOrderRef.current);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || savingRosterOrder) return;
      const handle = (event.target as Element).closest<HTMLElement>(".training-drag-handle");
      if (!handle || !root.contains(handle)) return;
      const row = handle.closest<HTMLElement>(".training-attendance-row");
      const section = handle.closest<HTMLElement>(".training-gender-group");
      const type = row ? "student" : "group";
      const sourceElement = row ?? section;
      const sourceId = row ? studentIdForRow(row) : groupKeyForSection(section);
      if (!sourceElement || !sourceId) return;

      event.preventDefault();
      const bounds = sourceElement.getBoundingClientRect();
      const ghost = sourceElement.cloneNode(true) as HTMLElement;
      ghost.classList.add("training-drag-ghost", `training-drag-ghost-${type}`);
      if (type === "group") {
        ghost.querySelector(":scope > div")?.remove();
      }
      ghost.style.left = `${bounds.left}px`;
      ghost.style.top = `${bounds.top}px`;
      ghost.style.width = `${bounds.width}px`;
      document.body.appendChild(ghost);
      sourceElement.classList.add("training-drag-source");
      document.body.classList.add("training-pointer-dragging");
      drag = { pointerId: event.pointerId, type, sourceId, sourceElement, ghost, offsetY: event.clientY - bounds.top, changed: false };
      if (type === "student") setDraggedStudentId(sourceId);
      else setDraggedGenderSection(sourceId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      drag.ghost.style.top = `${event.clientY - drag.offsetY}px`;
      if (event.clientY < 80) window.scrollBy({ top: -12, behavior: "auto" });
      else if (event.clientY > window.innerHeight - 80) window.scrollBy({ top: 12, behavior: "auto" });

      const hovered = document.elementFromPoint(event.clientX, event.clientY);
      if (drag.type === "student") {
        const targetRow = hovered?.closest<HTMLElement>(".training-attendance-row") ?? null;
        const sameSection = targetRow?.closest(".training-gender-group") === drag.sourceElement.closest(".training-gender-group");
        const targetId = sameSection ? studentIdForRow(targetRow) : "";
        const next = moveInOrder(rosterOrderRef.current, drag.sourceId, targetId);
        if (next !== rosterOrderRef.current) {
          rosterOrderRef.current = next;
          setRosterOrder(next);
          drag.changed = true;
        }
      } else {
        const targetSection = hovered?.closest<HTMLElement>(".training-gender-group") ?? null;
        const targetKey = groupKeyForSection(targetSection);
        const next = moveInOrder(genderSectionOrderRef.current, drag.sourceId, targetKey);
        if (next !== genderSectionOrderRef.current) {
          genderSectionOrderRef.current = next;
          setGenderSectionOrder(next);
          drag.changed = true;
        }
      }
    };
    const preventNativeDrag = (event: Event) => event.preventDefault();
    root.addEventListener("pointerdown", onPointerDown as EventListener);
    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", finishDrag);
    document.addEventListener("pointercancel", finishDrag);
    root.addEventListener("dragstart", preventNativeDrag);
    return () => {
      finishDrag();
      root.removeEventListener("pointerdown", onPointerDown as EventListener);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", finishDrag);
      document.removeEventListener("pointercancel", finishDrag);
      root.removeEventListener("dragstart", preventNativeDrag);
    };
  }, [batchId, focusedSessionId, savingRosterOrder, workspace]);

  const openStudentPicker = useCallback(async () => {
    if (!workspace) return;
    setEnrollmentDraftHydrated(false);
    setLoadingMembers(true);
    setError("");
    try {
      const [data, cancelled, guides] = await Promise.all([
        getAvailableMembers(workspace.program.id),
        getCancelledTrainingEnrollments(workspace.program.id),
        getGuideCandidates(),
      ]);
      setMembers(data);
      setCancelledEnrollments(cancelled);
      setGuideCandidates(guides);
      const storedDraft = enrollmentDraftKey ? window.localStorage.getItem(enrollmentDraftKey) : null;
      let draft: { selected?: string[]; guidesByStudent?: Record<string, string>; search?: string } | null = null;
      try { draft = storedDraft ? JSON.parse(storedDraft) : null; }
      catch { if (enrollmentDraftKey) window.localStorage.removeItem(enrollmentDraftKey); }
      const eligibleIds = new Set(data.map((member) => member.id));
      const restoredSelected = (draft?.selected ?? []).filter((id) => eligibleIds.has(id));
      setGuidesByStudent(Object.fromEntries(Object.entries(draft?.guidesByStudent ?? {}).filter(([id]) => restoredSelected.includes(id))));
      setSelected(new Set(restoredSelected));
      setSearch(draft?.search ?? "");
      setHasEnrollmentDraft(restoredSelected.length > 0);
      setEnrollmentError("");
      setShowStudents(true);
      setEnrollmentDraftHydrated(true);
    } catch (reason) {
      setError(trainingErrorMessage(reason));
    } finally {
      setLoadingMembers(false);
    }
  }, [enrollmentDraftKey, workspace]);

  useEffect(() => {
    if (!showStudents || !enrollmentDraftHydrated || !enrollmentDraftKey) return;
    if (selected.size === 0 && Object.keys(guidesByStudent).length === 0 && !search) {
      window.localStorage.removeItem(enrollmentDraftKey);
      setHasEnrollmentDraft(false);
      return;
    }
    window.localStorage.setItem(enrollmentDraftKey, JSON.stringify({ selected: Array.from(selected), guidesByStudent, search }));
    setHasEnrollmentDraft(selected.size > 0);
  }, [enrollmentDraftHydrated, enrollmentDraftKey, guidesByStudent, search, selected, showStudents]);

  const resetStudentDraft = () => {
    setSelected(new Set());
    setGuidesByStudent({});
    setSearch("");
    setEnrollmentError("");
    if (enrollmentDraftKey) window.localStorage.removeItem(enrollmentDraftKey);
    setHasEnrollmentDraft(false);
    setEnrollmentDraftHydrated(false);
  };
  const requestCloseStudentPicker = () => {
    setShowStudents(false);
  };

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
              {loadingMembers ? "Loading Members..." : hasEnrollmentDraft ? "Continue Enrollment" : "+ Add Enrollment"}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}><h2 className="text-lg font-semibold" style={{ margin: 0 }}>Sessions</h2>{focusedSessionIsCurrent && focusedSession && hasPermission("training.attendance") && <Button disabled={activeStudents.length === 0 || completingSession} onClick={() => setCompletionSession({ id: focusedSession.id, title: focusedSession.title, sessionDate: focusedSession.session_date })}>Complete Session</Button>}</div>
          <p style={{ color: "#64748b", margin: "8px 0 0" }}>{workspace.batch.requiredSessions} required sessions · Future attendance remains locked, but its requirements may be configured in advance.</p>
          {!classStarted && <p style={{ margin: "16px 0 0", padding: 14, borderRadius: 10, background: "#f8fafc", color: "#64748b" }}>Attendance will open when the class starts. Session names, dates, and requirements may be configured now.</p>}
          {focusedSession && <><nav aria-label="Training session navigation" className="training-session-navigation"><Button variant="secondary" disabled={focusedSessionIndex === 0} onClick={() => setFocusedSessionId(regularSessions[focusedSessionIndex - 1]?.id ?? null)}><ChevronLeft size={17} aria-hidden="true" /> Previous Session</Button><span>Week {focusedSession.display_order} of {regularSessions.length}</span><Button variant="secondary" disabled={focusedSessionIndex >= regularSessions.length - 1} onClick={() => setFocusedSessionId(regularSessions[focusedSessionIndex + 1]?.id ?? null)}>Next Session <ChevronRight size={17} aria-hidden="true" /></Button></nav><dl className="training-attendance-summary" aria-label="Session attendance summary">{([
            { key: "present", label: "Present", color: "#15803d", background: "#ecfdf3" },
            ...(focusedSessionIsCompleted
              ? [{ key: "absent" as const, label: "Absent", color: "#dc2626", background: "#fef2f2" }]
              : [{ key: "notMarked" as const, label: "Not Marked", color: "#64748b", background: "#f8fafc" }]),
            { key: "late", label: "Late", color: "#b45309", background: "#fffbeb" },
            { key: "excused", label: "Excused", color: "#1d4ed8", background: "#eff6ff" },
          ] as const).map((item) => <div key={item.key} style={{ borderColor: item.color, background: item.background }}><dt><span aria-hidden="true" style={{ background: item.color }} />{item.label}</dt><dd>{focusedAttendanceSummary[item.key]}</dd></div>)}</dl></>}
          <div className="mt-6 space-y-5">{visibleSessions.length === 0 ? <p className="text-slate-500">No sessions configured.</p> : visibleSessions.filter((session) => session.id === focusedSession?.id).map((session) => {
            const visibleIndex = regularSessions.findIndex((item) => item.id === session.id);
            const isCurrent = classStarted && currentSessionIndex === visibleIndex;
            const isCompleted = classStarted && (currentSessionIndex < 0 || visibleIndex < currentSessionIndex);
            const isFuture = !classStarted || (currentSessionIndex >= 0 && visibleIndex > currentSessionIndex);
            const canEditAttendance = isCurrent;
            return (
            <article key={session.id} className="rounded-xl border border-slate-200 p-5" style={{ padding: "clamp(14px, 3vw, 20px)", border: "1px solid #dbe3ec", borderRadius: 14, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}><div style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 14, color: "#475569" }}>Week {session.display_order}</strong><div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}><p className="font-semibold" style={{ margin: 0, fontSize: 17, overflowWrap: "anywhere" }}>{session.title}</p>{!isCompleted && hasPermission("training.attendance") && <button type="button" className="training-icon-button" aria-label={`Edit Week ${session.display_order} session details`} title="Edit Session" onClick={() => { setSelectedSession(session); setSessionTitle(session.title); setSessionDate(session.session_date?.slice(0,10) ?? ""); }}><Pencil size={15} aria-hidden="true" /></button>}</div><small style={{ display: "block", marginTop: 4, color: "#64748b" }}>{session.session_date ? new Date(session.session_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "Date not recorded"}</small><small style={{ display: "block", marginTop: 3, color: isCurrent ? "#4d5f2a" : "#64748b" }}>{isCurrent ? "Current session" : isCompleted ? "Completed · Read-only" : "Upcoming session"}</small></div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{!isCompleted && hasPermission("training.enroll") && <Button variant="secondary" style={{ minHeight: 34, padding: "7px 11px", fontSize: 13 }} onClick={() => { setRequirementSession({ id: session.id, title: session.title }); setSessionRequirementDraft(workspace.sessionRequirements.filter((assignment) => assignment.sessionId===session.id).map((assignment) => assignment.requirementId)); }}>Manage Requirements</Button>}</div></div>{isCurrent && activeStudents.length > 0 && <p style={{ margin: "10px 0 0", color: "#475569", fontSize: 14 }}>Check each student who attended. Unchecked students remain Not Marked until this session is completed.</p>}<div className="mt-4 space-y-3">{isFuture ? <div style={{ padding: 12, borderRadius: 9, background: "#f8fafc", color: "#64748b" }}>{requirementsForSession(session.id).length ? `Requirements: ${requirementsForSession(session.id).map((requirement) => requirement.name).join(", ")}` : "No additional requirements"}</div> : <div className="training-gender-groups">{attendanceGroups.map((group) => <section key={group.key} className="training-gender-group"><header>{group.key !== "not_recorded" && hasPermission("training.attendance") && <button type="button" className="training-drag-handle" draggable={!savingRosterOrder} aria-label={`Reorder ${group.label} section`} title={`Drag to reorder ${group.label} section`} onDragStart={() => setDraggedGenderSection(group.key)} onDragEnd={() => setDraggedGenderSection(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedGenderSection) reorderGenderSection(draggedGenderSection, group.key); setDraggedGenderSection(null); }} onKeyDown={(event) => { if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); const direction = event.key === "ArrowUp" ? -1 : 1; const target = genderSectionOrder[genderSectionOrder.indexOf(group.key) + direction]; if (target) reorderGenderSection(group.key, target); } }}><GripVertical size={16} aria-hidden="true" /></button>}<strong>{group.label}</strong><span>{group.students.length}</span></header><div>{group.students.map((student) => {
              const attendance = attendanceFor(student.id, session.id);
              const saveKey = `${student.id}:${session.id}`;
              const resolvedAttendance = canEditAttendance ? attendanceStatusFor(student.id, session.id) : attendance?.status ?? null;
              const checkedIn = Boolean(resolvedAttendance && ["present", "late", "excused"].includes(resolvedAttendance));
              const accent = studentAccent(student.id);
              const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
              return <div key={student.id} className="training-attendance-row" onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedStudentId) reorderStudent(draggedStudentId, student.id); setDraggedStudentId(null); }}>
                {hasPermission("training.attendance") && <button type="button" className="training-drag-handle" draggable={!savingRosterOrder} aria-label={`Reorder ${student.firstName} ${student.lastName}`} title="Drag to reorder student" onDragStart={() => setDraggedStudentId(student.id)} onDragEnd={() => setDraggedStudentId(null)} onKeyDown={(event) => { if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); moveStudentWithinSection(student.id, event.key === "ArrowUp" ? -1 : 1); } }}><GripVertical size={17} aria-hidden="true" /></button>}
                <Link to={`/admin/training/${programSlug}/members/${student.id}`} state={{ returnTo: location.pathname }} className="training-student-identity"><span aria-hidden="true" style={{ background: accent.bg, color: accent.text }}>{initials}</span><span><strong>{student.firstName} {student.lastName}</strong><small>Guide: {student.guideName ?? "Not assigned"}</small></span></Link>
                <div className="training-row-controls"><div className="training-row-attendance">{hasPermission("training.attendance") && canEditAttendance ? <div><label><input aria-label={`Mark ${student.firstName} ${student.lastName} present`} type="checkbox" checked={checkedIn} disabled={completingSession} onChange={(event) => { setError(""); setNotice(""); setAttendanceDraft((current) => ({ ...current, [saveKey]: event.target.checked ? "present" : null })); }} />Present</label>{checkedIn && <Select aria-label={`Attendance status for ${student.firstName} ${student.lastName}`} value={resolvedAttendance ?? "present"} disabled={completingSession} onChange={(event) => setAttendanceDraft((current) => ({ ...current, [saveKey]: event.target.value }))}><option value="present">Present</option><option value="late">Late</option><option value="excused">Excused</option></Select>}</div> : <span style={{ border: `1px solid ${attendanceBadgeStyle(attendance?.status).border}`, background: attendanceBadgeStyle(attendance?.status).background, color: attendanceBadgeStyle(attendance?.status).color }}>{attendanceStatusLabel(attendance?.status)}</span>}</div>{requirementsForSession(session.id).map((requirement) => { const checked = requirementCompleted(student.id, session.id, requirement.id); const requirementKey = `${student.id}:${session.id}:${requirement.id}`; return <label className="training-requirement-control" key={requirement.id}><input type="checkbox" checked={checked} disabled={!canEditAttendance || !hasPermission("training.attendance") || savingRequirement === requirementKey} onChange={(event) => { setSavingRequirement(requirementKey); setError(""); void saveSessionRequirement(student.id, session.id, requirement.id, event.target.checked).then(load).then(() => setNotice(`${requirement.name} progress saved.`)).catch((reason) => setError(trainingErrorMessage(reason))).finally(() => setSavingRequirement("")); }} />{requirement.name}</label>; })}</div>
                <div className="training-row-actions">{isCompleted && hasPermission("training.attendance") && <button type="button" className="training-icon-button" aria-label={`Edit ${student.firstName} ${student.lastName}'s attendance record`} title="Attendance Correction" onClick={() => { const requirementValues: Record<string, boolean> = {}; requirementsForSession(session.id).forEach((requirement) => { requirementValues[requirement.id] = requirementCompleted(student.id,session.id,requirement.id); }); setCorrection({ enrollmentId: student.id, studentName: `${student.firstName} ${student.lastName}`, sessionId: session.id, sessionTitle: session.title, sessionDate: session.session_date, currentAttendance: attendance?.status ?? null }); setCorrectedAttendance(attendance?.status ?? ""); setCorrectedRequirements(requirementValues); setCorrectionReason(""); }}><Pencil size={15} aria-hidden="true" /></button>}</div>
              </div>;
            })}</div></section>)}</div>}</div></article>
          );})}{activeStudents.length > 0 && <div style={{ marginTop: 14, padding: "12px 14px", border: "1px dashed #3b82f6", borderRadius: 10, background: "#eff6ff", color: "#1d4ed8", fontSize: 14 }}>ⓘ Click a student name to view their Training Profile and full progress.</div>}</div>
        </section>

      </div>

      {activeCycle && unresolvedAbsences.length > 0 && <section style={{ padding: "clamp(16px, 4vw, 24px)", border: "1px solid #f3d36b", borderRadius: 18, background: "#fffbeb", minWidth: 0 }}><h2 style={{ margin: 0 }}>Remedial Attendance</h2><p style={{ margin: "8px 0 18px", color: "#64748b" }}>Only unresolved absences appear here. Completing remedial attendance satisfies the missed week without changing the original absence.</p><div style={{ display: "grid", gap: 12 }}>{unresolvedAbsences.map(({ student, session, remedial }) => <article key={`${student.id}:${session.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, padding: 16, border: "1px solid #f3d36b", borderRadius: 12, background: "#fff" }}><div><strong>{student.firstName} {student.lastName}</strong><p style={{ margin: "5px 0 0", color: "#64748b" }}>{session.title}: Absent{remedial ? ` · Remedial scheduled ${new Date(remedial.scheduled_for).toLocaleDateString("en-PH")}` : ""}</p></div>{hasPermission("training.attendance") && (remedial ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Button variant="secondary" onClick={() => { setSelectedAbsence({ enrollmentId: student.id, sessionId: session.id, studentName: `${student.firstName} ${student.lastName}`, sessionTitle: session.title, remedialId: remedial.id }); setRemedialDate(remedial.scheduled_for.slice(0, 10)); setRemedialNotes(remedial.notes ?? ""); }}>Edit Schedule</Button><Button onClick={() => { if (!window.confirm(`Mark ${student.firstName}'s remedial for ${session.title} complete?`)) return; void completeRemedial(remedial.id, new Date().toISOString().slice(0,10)).then(load).catch((reason) => setError(trainingErrorMessage(reason))); }}>Complete Remedial</Button></div> : <Button onClick={() => { setSelectedAbsence({ enrollmentId: student.id, sessionId: session.id, studentName: `${student.firstName} ${student.lastName}`, sessionTitle: session.title }); setRemedialDate(new Date().toISOString().slice(0,10)); setRemedialNotes(""); }}>Schedule Remedial</Button>)}</article>)}</div></section>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ padding: "clamp(16px, 4vw, 26px)", border: "1px solid #dbe3ec", borderRadius: 18, background: "#fff", boxShadow: "0 2px 8px rgba(15,23,42,.06)", minWidth: 0 }}>
        <h2 className="text-lg font-semibold">Students Enrolled ({activeStudents.length})</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginTop: 20 }}>{activeStudents.map((student) => (
          <article key={student.id} style={{ padding: "clamp(18px, 4vw, 22px)", border: "1px solid #dbe3ec", borderRadius: 14, background: "#fff", boxShadow: "0 2px 6px rgba(15,23,42,.07)", minWidth: 0 }}><Link to={`/admin/training/${programSlug}/members/${student.id}`} state={{ returnTo: location.pathname }} style={{ color: "inherit", textDecoration: "none" }}><p style={{ margin: 0, fontSize: 17, fontWeight: 700, overflowWrap: "anywhere" }}>{student.firstName} {student.lastName}</p><p style={{ margin: "8px 0 0", color: "#64748b" }}>{trainingStatusLabel(student.status)}</p><p style={{ margin: "8px 0 0", fontWeight: 600 }}>Attendance: {attendanceCount(student.id)} / {workspace.batch.requiredSessions}</p></Link><div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>{student.status === "ready_for_completion" && hasPermission("training.complete") && <Button onClick={() => void completeTraining(student.id).then(load).catch((reason) => setError(trainingErrorMessage(reason)))}>Complete Student</Button>}{student.status === "in_progress" && hasPermission("training.enroll") && <Button variant="danger" onClick={() => { if (!window.confirm("Withdraw this student? Attendance, notes, dates, and history will be preserved.")) return; const reason = window.prompt("Reason for withdrawal") ?? ""; void withdrawTrainingEnrollment(student.id, reason).then(load).catch((reasonValue) => setError(trainingErrorMessage(reasonValue))); }}>Withdraw</Button>}</div></article>
        ))}</div>
      </section>

      {!activeCycle && <section style={{ padding: "clamp(16px, 4vw, 24px)", border: "1px solid #dbe3ec", borderRadius: 18, background: "#fff" }}><h2 style={{ marginTop: 0 }}>Historical Class Roster ({historicalStudents.length})</h2><p style={{ margin: "-6px 0 16px", color: "#64748b" }}>Every enrollment that belonged to this class is included, regardless of its final status.</p>{historicalStudents.length === 0 ? <p style={{ margin: 0, color: "#64748b" }}>No students belonged to this class.</p> : <div style={{ display: "grid", gap: 12 }}>{historicalStudents.map((student) => <article key={student.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 16, border: "1px solid #e2e8f0", borderRadius: 12 }}><Link to={`/admin/training/${programSlug}/members/${student.id}`} state={{ returnTo: location.pathname }}>{student.firstName} {student.lastName}</Link><span style={{ color: "#64748b" }}>{trainingStatusLabel(student.status)}</span></article>)}</div>}</section>}
      {activeCycle && completedStudents.length > 0 && <section style={{ padding: "clamp(16px, 4vw, 24px)", border: "1px solid #dbe3ec", borderRadius: 18, background: "#fff" }}><h2 style={{ marginTop: 0 }}>Completed Students ({completedStudents.length})</h2><p style={{ margin: "-6px 0 16px", color: "#64748b" }}>Completed records are read-only. Open a student to view completion details and history.</p><div style={{ display: "grid", gap: 12 }}>{completedStudents.map((student) => <article key={student.id} style={{ padding: 16, border: "1px solid #e2e8f0", borderRadius: 12 }}><Link to={`/admin/training/${programSlug}/members/${student.id}`} state={{ returnTo: location.pathname }}>{student.firstName} {student.lastName}</Link></article>)}</div></section>}

      <Modal open={showStudents} title="Add Enrollment" onClose={requestCloseStudentPicker}>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members..." />
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {filteredMembers.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
              {members.length === 0
                ? "Every member already has an enrollment record for this program."
                : "No eligible members match your search."}
            </p>
          ) : filteredMembers.map((member) => (
            <div key={member.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(210px,100%),1fr))", gap: 10, alignItems: "center", padding: 12, border: "1px solid #e2e8f0", borderRadius: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><input type="checkbox" checked={selected.has(member.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(member.id); else { next.delete(member.id); setGuidesByStudent((guides) => { const copy = { ...guides }; delete copy[member.id]; return copy; }); } return next; })} /><span style={{ overflowWrap: "anywhere" }}>{member.first_name} {member.last_name}</span></label>
              {selected.has(member.id) && <div style={{ display: "grid", gap: 10 }}><div><small style={{ display: "block", color: "#64748b" }}>Cell Group</small><strong>{member.cell_groups?.[0]?.name ?? "Not assigned"}</strong></div><label style={{ fontSize: 13, color: "#475569" }}>Guide (optional)<SearchableSelect value={guidesByStudent[member.id] ?? ""} onChange={(guideId) => setGuidesByStudent((current) => ({ ...current, [member.id]: guideId }))} placeholder="Search and select Guide" options={guideCandidates.filter((guide) => guide.id !== member.id).map((guide) => ({ id: guide.id, label: `${guide.first_name} ${guide.last_name}${guide.email ? ` — ${guide.email}` : ""}` }))} /></label></div>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600">Selected ({selected.size})</p>
        {cancelledEnrollments.length > 0 && (
          <section style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Cancelled Enrollments</h3>
            <p style={{ margin: "5px 0 12px", color: "#64748b", fontSize: 14 }}>
              Restore the original enrollment attempt to this Current Class. Existing attendance, notes, and history are preserved.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {cancelledEnrollments.map((item) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: 12, border: "1px solid #e2e8f0", borderRadius: 10 }}>
                  <div>
                    <strong>{item.firstName} {item.lastName}</strong>
                    <small style={{ display: "block", marginTop: 4, color: "#64748b" }}>Cancelled</small>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={enrolling}
                    onClick={() => {
                      const destination = workspace.batch.status === "ongoing" ? "In Progress" : "Pending Enrollment";
                      if (!window.confirm(`Restore ${item.firstName} ${item.lastName} to ${destination} in this Current Class?`)) return;
                      setEnrolling(true);
                      setEnrollmentError("");
                      void restoreTrainingEnrollment(item.id, workspace.batch.id, "Restored from Current Class enrollment picker")
                        .then(async (restoredStatus) => {
                          setShowStudents(false);
                          await load();
                          setNotice(`${item.firstName} ${item.lastName} was restored to ${trainingStatusLabel(restoredStatus)}.`);
                        })
                        .catch((reason) => setEnrollmentError(trainingErrorMessage(reason)))
                        .finally(() => setEnrolling(false));
                    }}
                  >
                    Restore Enrollment
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
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
            void enrollBatchStudents(workspace.batch.id, Array.from(selected).map((memberId) => ({ memberId, guideMemberId: guidesByStudent[memberId] })))
              .then(async (count) => {
                if (count === 0) {
                  setEnrollmentError(
                    "No students were enrolled. They may already have active enrollment records for this program.",
                  );
                  return;
                }
                setShowStudents(false);
                resetStudentDraft();
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
        <Button className="mt-2 w-full" variant="secondary" disabled={enrolling} onClick={requestCloseStudentPicker}>Cancel</Button>
      </Modal>
      <Modal open={Boolean(completionSession)} title="Complete Session" onClose={() => { if (!completingSession) setCompletionSession(null); }}>
        {completionSession && <form onSubmit={(event) => {
          event.preventDefault();
          setCompletingSession(true);
          setError("");
          setNotice("");
          void (async () => {
            try {
              for (const student of activeStudents) {
                const draftedStatus = attendanceStatusFor(student.id, completionSession.id);
                const finalStatus = draftedStatus && ["present", "late", "excused"].includes(draftedStatus)
                  ? draftedStatus
                  : "absent";
                await saveAttendance(student.id, completionSession.id, finalStatus);
              }
              const completedTitle = completionSession.title;
              const completedSessionId = completionSession.id;
              const completedIndex = regularSessions.findIndex((session) => session.id === completedSessionId);
              setFocusedSessionId(regularSessions[completedIndex + 1]?.id ?? completedSessionId);
              setCompletionSession(null);
              setAttendanceDraft((current) => Object.fromEntries(
                Object.entries(current).filter(([key]) => !key.endsWith(`:${completedSessionId}`)),
              ));
              await load();
              setNotice(`${completedTitle} completed. Unchecked students were recorded as Absent.`);
            } catch (reason) {
              setError(trainingErrorMessage(reason));
              await load();
            } finally {
              setCompletingSession(false);
            }
          })();
        }} style={{ display: "grid", gap: 16 }}>
          <div><strong>{completionSession.title}</strong><p style={{ margin: "5px 0 0", color: "#64748b" }}>{completionSession.sessionDate ? new Date(completionSession.sessionDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "Date not recorded"}</p></div>
          <p style={{ margin: 0, color: "#475569" }}>Review the attendance summary before completing this session.</p>
          <dl style={{ display: "grid", gap: 9, margin: 0 }}>
            {([
              { key: "present", label: "Present" },
              { key: "late", label: "Late" },
              { key: "excused", label: "Excused" },
              { key: "notMarked", label: "Not Marked" },
            ] as const).map((item) => {
              const style = item.key === "notMarked"
                ? { background: "#f1f5f9", color: "#475569" }
                : attendanceBadgeStyle(item.key);
              return <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "9px 11px", borderRadius: 9, background: style.background, color: style.color }}><dt style={{ fontWeight: 700 }}>{item.label}</dt><dd style={{ margin: 0, fontWeight: 800 }}>{completionSummary[item.key]}</dd></div>;
            })}
          </dl>
          {completionSummary.notMarked > 0 && <div role="note" style={{ padding: 12, border: "1px solid #fcd34d", borderRadius: 10, background: "#fffbeb", color: "#92400e" }}>⚠ {completionSummary.notMarked} Not Marked student{completionSummary.notMarked === 1 ? "" : "s"} will be recorded as Absent.</div>}
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Requirements are saved independently and will not be changed.</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}><Button type="button" variant="secondary" disabled={completingSession} onClick={() => setCompletionSession(null)}>Cancel</Button><Button type="submit" disabled={completingSession || activeStudents.length === 0}>{completingSession ? "Completing Session..." : "Complete Session"}</Button></div>
        </form>}
      </Modal>
      <Modal open={Boolean(correction)} title="Attendance Correction" onClose={() => { if (!savingCorrection) setCorrection(null); }}>
        {correction && <form onSubmit={(event) => {
          event.preventDefault();
          if (!correctionReason.trim()) return;
          setSavingCorrection(true);
          setError("");
          void correctCompletedStudentSessionRecord(
            correction.enrollmentId,
            correction.sessionId,
            correctedAttendance || null,
            requirementsForSession(correction.sessionId).map((requirement) => ({ requirementId: requirement.id, completed: Boolean(correctedRequirements[requirement.id]) })),
            correctionReason.trim(),
          ).then(async () => {
            await load();
            setCorrection(null);
            setNotice(`${correction.studentName}'s ${correction.sessionTitle} record was corrected. The completed session remains read-only.`);
          }).catch((reason) => setError(trainingErrorMessage(reason))).finally(() => setSavingCorrection(false));
        }} style={{ display: "grid", gap: 16 }}>
          <p style={{ margin: "-6px 0 0", color: "#64748b" }}>{correction.sessionTitle} · {correction.sessionDate ? new Date(correction.sessionDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "Date not recorded"}</p>
          <div style={{ display: "grid", gap: 5, padding: 14, borderRadius: 10, background: "#f8fafc" }}><span style={{ color: "#64748b", fontSize: 13 }}>Student</span><strong>{correction.studentName}</strong></div>
          <div style={{ display: "grid", gap: 5 }}><span style={{ color: "#64748b", fontSize: 13 }}>Current Attendance</span><strong>{attendanceStatusLabel(correction.currentAttendance)}</strong></div>
          <label style={{ display: "grid", gap: 7 }}>Correct Attendance To<Select aria-label="Correct attendance to" value={correctedAttendance} onChange={(event) => setCorrectedAttendance(event.target.value)} disabled={savingCorrection}><option value="">Not Recorded</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option></Select></label>
          <fieldset style={{ margin: 0, padding: 14, border: "1px solid #dbe3ec", borderRadius: 10 }}><legend style={{ padding: "0 6px", fontWeight: 600 }}>Requirements</legend>{requirementsForSession(correction.sessionId).length === 0 ? <p style={{ margin: 0, color: "#64748b" }}>No additional requirements were assigned to this session.</p> : <div style={{ display: "grid", gap: 10 }}>{requirementsForSession(correction.sessionId).map((requirement) => <label key={requirement.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 36 }}><input type="checkbox" checked={Boolean(correctedRequirements[requirement.id])} disabled={savingCorrection} onChange={(event) => setCorrectedRequirements((current) => ({ ...current, [requirement.id]: event.target.checked }))} />{requirement.name}{!requirement.isActive && <small style={{ color: "#64748b" }}>(inactive)</small>}</label>)}</div>}</fieldset>
          <label style={{ display: "grid", gap: 7 }}>Reason *<Textarea autoFocus required rows={4} value={correctionReason} disabled={savingCorrection} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Attendance was accidentally marked Absent instead of Present." /></label>
          <div role="note" style={{ padding: 12, border: "1px solid #bfdbfe", borderRadius: 10, background: "#eff6ff", color: "#1e40af", fontSize: 14 }}>The previous value, corrected value, user, timestamp, and reason will be preserved in the audit history.</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}><Button type="button" variant="secondary" disabled={savingCorrection} onClick={() => setCorrection(null)}>Cancel</Button><Button type="submit" disabled={savingCorrection || !correctionReason.trim()}>{savingCorrection ? "Saving Correction..." : "Save Correction"}</Button></div>
        </form>}
      </Modal>
      <Modal open={showRequirement} title="Requirement Library" onClose={() => setShowRequirement(false)}>
        <div style={{ display: "grid", gap: 14 }}><p style={{ margin: 0, color: "#64748b" }}>Reusable requirement names do not apply to a session until assigned from that session's Manage Requirements action.</p><div style={{ display: "grid", gap: 8 }}>{workspace.requirements.length===0 ? <p style={{ margin: 0 }}>No requirement names configured.</p> : workspace.requirements.map((requirement) => <div key={requirement.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 12, border: "1px solid #e2e8f0", borderRadius: 9 }}><span>{requirement.name}<small style={{ display: "block", color: requirement.isActive ? "#166534" : "#64748b" }}>{requirement.isActive ? "Active" : "Inactive"}</small></span><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="secondary" style={{ minHeight: 32, padding: "6px 10px", fontSize: 13 }} onClick={() => { const name=window.prompt("Rename requirement",requirement.name)?.trim(); if (!name || name===requirement.name) return; void saveTrainingProgramRequirement(workspace.program.id,name,requirement.id).then(load).catch((reason) => setError(trainingErrorMessage(reason))); }}>Edit</Button><Button variant="secondary" style={{ minHeight: 32, padding: "6px 10px", fontSize: 13 }} onClick={() => { const nextActive=!requirement.isActive; if (!window.confirm(`${nextActive ? "Reactivate" : "Deactivate"} ${requirement.name}? Existing assignments and progress will be preserved.`)) return; void setTrainingProgramRequirementActive(requirement.id,nextActive).then(load).catch((reason) => setError(trainingErrorMessage(reason))); }}>{requirement.isActive ? "Deactivate" : "Reactivate"}</Button></div></div>)}</div><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><Button onClick={() => { setShowRequirement(false); setNewRequirementName(""); setShowAddRequirementName(true); }}>+ Add Requirement Name</Button><Button variant="secondary" onClick={() => setShowRequirement(false)}>Close</Button></div></div>
      </Modal>
      <Modal open={showAddRequirementName} title="Add Requirement Name" onClose={() => { if (!addingRequirement) setShowAddRequirementName(false); }}>
        <div style={{ display: "grid", gap: 14 }}><label>Requirement Name *<Input autoFocus value={newRequirementName} onChange={(event) => setNewRequirementName(event.target.value)} placeholder="e.g. Manual" /></label><p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>This creates a reusable requirement name. You can then assign it to specific sessions.</p><div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}><Button variant="secondary" disabled={addingRequirement} onClick={() => setShowAddRequirementName(false)}>Cancel</Button><Button disabled={!newRequirementName.trim() || addingRequirement} onClick={() => { setAddingRequirement(true); void saveTrainingProgramRequirement(workspace.program.id,newRequirementName.trim()).then(async () => { setShowAddRequirementName(false); setNotice("Requirement name added."); await load(); }).catch((reason) => setError(trainingErrorMessage(reason))).finally(() => setAddingRequirement(false)); }}>{addingRequirement ? "Adding..." : "Add Requirement"}</Button></div></div>
      </Modal>
      <Modal open={Boolean(requirementSession)} title="Manage Requirements" onClose={() => { if (!savingRequirementAssignments) setRequirementSession(null); }}>
        {requirementSession && <div style={{ display: "grid", gap: 14 }}><p style={{ margin: 0 }}><strong>{requirementSession.title}</strong></p><fieldset style={{ margin: 0, padding: 14, border: "1px solid #dbe3ec", borderRadius: 10 }}><legend style={{ padding: "0 6px" }}>Available requirements</legend>{workspace.requirements.filter((requirement) => requirement.isActive || sessionRequirementDraft.includes(requirement.id)).length===0 ? <p style={{ margin: 0, color: "#64748b" }}>No active requirement names available.</p> : <div style={{ display: "grid", gap: 10 }}>{workspace.requirements.filter((requirement) => requirement.isActive || sessionRequirementDraft.includes(requirement.id)).map((requirement) => { const hasProgress=workspace.requirementProgress.some((progress: any) => progress.training_session_id===requirementSession.id && progress.program_requirement_id===requirement.id); const checked=sessionRequirementDraft.includes(requirement.id); return <label key={requirement.id} style={{ display: "flex", alignItems: "center", gap: 9 }}><input type="checkbox" checked={checked} disabled={savingRequirementAssignments || (!requirement.isActive && !checked) || (checked && hasProgress)} onChange={(event) => setSessionRequirementDraft((current) => event.target.checked ? [...current,requirement.id] : current.filter((id) => id!==requirement.id))} />{requirement.name}{!requirement.isActive ? " (Inactive)" : ""}{checked && hasProgress ? <small style={{ color: "#92400e" }}>(student progress recorded; removal blocked)</small> : null}</label>; })}</div>}</fieldset>{sessionRequirementDraft.length===0 && <p style={{ margin: 0, color: "#64748b" }}>No additional requirements</p>}<div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><Button variant="secondary" disabled={savingRequirementAssignments} onClick={() => { setRequirementSession(null); setShowRequirement(true); }}>Requirement Library</Button><div style={{ display: "flex", gap: 10 }}><Button variant="secondary" disabled={savingRequirementAssignments} onClick={() => setRequirementSession(null)}>Cancel</Button><Button disabled={savingRequirementAssignments} onClick={() => { setSavingRequirementAssignments(true); void setTrainingSessionRequirements(requirementSession.id,sessionRequirementDraft).then(async () => { setRequirementSession(null); setNotice(`${requirementSession.title} requirements saved.`); await load(); }).catch((reason) => setError(trainingErrorMessage(reason))).finally(() => setSavingRequirementAssignments(false)); }}>{savingRequirementAssignments ? "Saving..." : "Save"}</Button></div></div></div>}
      </Modal>
      <Modal open={Boolean(selectedSession)} title="Edit Session" onClose={() => { if (!savingSession) setSelectedSession(null); }}>
        {selectedSession && <form onSubmit={(event) => {
          event.preventDefault();
          const normalizedTitle = sessionTitle.trim();
          if (!normalizedTitle || (selectedSession.session_date && !sessionDate)) return;
          setSavingSession(true);
          setError("");
          void updateTrainingSessionDetails(selectedSession.id, normalizedTitle, sessionDate || null)
            .then(async () => {
              setSelectedSession(null);
              await load();
              setNotice(`Week ${selectedSession.display_order} was updated.`);
            })
            .catch((reason) => setError(trainingErrorMessage(reason)))
            .finally(() => setSavingSession(false));
        }} style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 5, padding: 12, borderRadius: 9, background: "#f8fafc" }}><span style={{ color: "#64748b", fontSize: 13 }}>Week</span><strong>Week {selectedSession.display_order}</strong></div>
          <label style={{ display: "grid", gap: 7 }}>Session Name *<Input autoFocus required maxLength={120} value={sessionTitle} disabled={savingSession} onChange={(event) => setSessionTitle(event.target.value)} placeholder="e.g. Orientation" /></label>
          <label style={{ display: "grid", gap: 7 }}>Session Date{selectedSession.session_date ? " *" : ""}<Input required={Boolean(selectedSession.session_date)} type="date" value={sessionDate} disabled={savingSession} onChange={(event) => setSessionDate(event.target.value)} />{!selectedSession.session_date && <small style={{ color: "#64748b" }}>Optional for this legacy session. Saving the name will not invent a date.</small>}</label>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>The week number, session order, attendance, requirements, and progress will not change.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}><Button type="button" variant="secondary" disabled={savingSession} onClick={() => setSelectedSession(null)}>Cancel</Button><Button type="submit" disabled={savingSession || !sessionTitle.trim() || (Boolean(selectedSession.session_date) && !sessionDate)}>{savingSession ? "Saving Changes..." : "Save Changes"}</Button></div>
        </form>}
      </Modal>
      <Modal open={Boolean(selectedAbsence)} title={selectedAbsence?.remedialId ? "Update Remedial Schedule" : "Schedule Remedial Attendance"} onClose={() => setSelectedAbsence(null)}>
        {selectedAbsence && <div style={{ display: "grid", gap: 14 }}><p style={{ margin: 0 }}><strong>{selectedAbsence.studentName}</strong><br />Missed session: {selectedAbsence.sessionTitle}</p><label>Remedial Date<Input type="date" value={remedialDate} onChange={(event) => setRemedialDate(event.target.value)} /></label><label>Notes<Input value={remedialNotes} onChange={(event) => setRemedialNotes(event.target.value)} placeholder="Optional remedial details" /></label><div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 10 }}><Button variant="secondary" onClick={() => setSelectedAbsence(null)}>Cancel</Button><Button disabled={!remedialDate} onClick={() => void scheduleRemedial(selectedAbsence.enrollmentId, selectedAbsence.sessionId, remedialDate, remedialNotes).then(async () => { const updated = Boolean(selectedAbsence.remedialId); setSelectedAbsence(null); setNotice(updated ? "Remedial schedule updated." : "Remedial attendance scheduled."); await load(); }).catch((reason) => setError(trainingErrorMessage(reason)))}>{selectedAbsence.remedialId ? "Update Remedial Schedule" : "Schedule Remedial"}</Button></div></div>}
      </Modal>
    </div>
  );
}
