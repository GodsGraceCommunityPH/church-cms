import { supabase } from "../../lib/supabase";
import { TRAINING_PROGRAMS } from "./trainingPrograms";

export type TrainingWorkflowStatus =
  | "pending_enrollment"
  | "in_progress"
  | "for_remedial"
  | "ready_for_completion"
  | "completed"
  | "withdrawn"
  | "cancelled";

export const ACTIVE_TRAINING_STATUSES: TrainingWorkflowStatus[] = [
  "pending_enrollment",
  "in_progress",
  "for_remedial",
  "ready_for_completion",
];

export interface TrainingProgramSummary {
  name: string;
  slug: string;
  totalEnrolled: number | null;
  completed: number | null;
  inProgress: number | null;
  activeBatches: number;
  readyForGraduation: number;
}

export interface TrainingEnrollment {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  status: TrainingWorkflowStatus;
  enrolledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  withdrawnAt: string | null;
  batchId: string | null;
  batchName: string | null;
  trainerName: string | null;
}

export interface TrainingProgramDetail {
  id: string;
  name: string;
  enrollments: TrainingEnrollment[];
}

export interface TrainingSessionAttendance {
  sessionId: string;
  title: string;
  sessionDate: string | null;
  status: string | null;
  notes: string | null;
  remedialStatus: string | null;
  remedialCompletedAt: string | null;
}

export interface TrainingNote {
  id: string;
  note: string;
  createdAt: string;
  author: string;
}

export interface TrainingRemedial {
  id: string;
  sessionId: string | null;
  sessionTitle: string;
  scheduledFor: string;
  status: string;
  notes: string | null;
  completedAt: string | null;
}

export interface MemberTrainingProfile {
  enrollment: TrainingEnrollment;
  programId: string;
  programName: string;
  sessions: TrainingSessionAttendance[];
  notes: TrainingNote[];
  remedials: TrainingRemedial[];
  requiredSessions: number;
  excusedCounts: boolean;
}

export interface TrainingBatchOption {
  id: string;
  name: string;
  trainerName: string | null;
}

export interface TrainerOption {
  id: string;
  name: string;
}

interface TrainingRow {
  id: string;
  name: string;
}

function normalizedProgramName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function programNamesMatch(left: string, right: string) {
  const normalizedLeft = normalizedProgramName(left);
  const normalizedRight = normalizedProgramName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

interface MemberTrainingRow {
  training_id: string;
  workflow_status: string | null;
  batch_id: string | null;
}

export function normalizeTrainingStatus(status: string) {
  return status.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export function asWorkflowStatus(status: string | null): TrainingWorkflowStatus {
  const normalized = normalizeTrainingStatus(status ?? "");
  if (normalized === "not_started") return "pending_enrollment";
  if (normalized === "in_progress") return "in_progress";
  if (normalized === "completed") return "completed";
  if (
    [
      "pending_enrollment",
      "for_remedial",
      "ready_for_completion",
      "withdrawn",
      "cancelled",
    ].includes(normalized)
  ) {
    return normalized as TrainingWorkflowStatus;
  }
  return "pending_enrollment";
}

export function isCompletedTrainingStatus(status: string) {
  return asWorkflowStatus(status) === "completed";
}

export function isInProgressTrainingStatus(status: string) {
  return ["in_progress", "for_remedial", "ready_for_completion"].includes(
    asWorkflowStatus(status),
  );
}

export function isActiveTrainingStatus(status: string) {
  return ACTIVE_TRAINING_STATUSES.includes(asWorkflowStatus(status));
}

export function trainingStatusLabel(status: string) {
  return asWorkflowStatus(status)
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function trainingErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const value = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };
    if (value.code === "42501") return "You do not have permission to perform this Training action.";
    if (value.code === "23505") return "This member already has an active enrollment in this Training program.";
    if (value.code === "23503") return "This record has Training history and cannot be deleted. Archive it instead.";
    if (value.code === "PGRST202") return "This Training action is unavailable because the required database migration has not been applied.";
    if (value.code?.startsWith("PGRST")) return "Training data could not be loaded. Please reload and try again.";
    if (value.message) return value.message;
  }
  if (error instanceof Error && error.message.startsWith("Attendance")) return error.message;
  return "The Training request could not be completed. Please try again.";
}

export async function getTrainingOverview(): Promise<TrainingProgramSummary[]> {
  const [trainingsResult, enrollmentResult, batchResult] = await Promise.all([
    supabase.from("trainings").select("id, name"),
    supabase
      .from("member_trainings")
      .select("training_id, workflow_status, batch_id")
      .is("archived_at", null),
    supabase
      .from("training_batches")
      .select("id, training_id, status")
      .in("status", ["open", "ongoing"]),
  ]);
  if (trainingsResult.error) throw trainingsResult.error;
  if (enrollmentResult.error) throw enrollmentResult.error;
  if (batchResult.error) throw batchResult.error;
  const trainings = (trainingsResult.data ?? []) as TrainingRow[];
  const enrollments = (enrollmentResult.data ?? []) as MemberTrainingRow[];

  return TRAINING_PROGRAMS.map((program) => {
    const training = trainings.find(
      (item) => programNamesMatch(item.name, program.name),
    );
    const programEnrollments = training
      ? enrollments.filter((item) => item.training_id === training.id)
      : [];

    return {
      ...program,
      totalEnrolled: programEnrollments.length,
      completed: programEnrollments.filter((item) =>
        isCompletedTrainingStatus(item.workflow_status ?? ""),
      ).length,
      inProgress: programEnrollments.filter((item) =>
        isActiveTrainingStatus(item.workflow_status ?? ""),
      ).length,
      activeBatches: training
        ? (batchResult.data ?? []).filter(
            (batch) => batch.training_id === training.id,
          ).length
        : 0,
      readyForGraduation: programEnrollments.filter(
        (item) => item.workflow_status === "ready_for_completion",
      ).length,
    };
  });
}

function mapEnrollment(item: any): TrainingEnrollment {
  return {
    id: item.id,
    memberId: item.member_id,
    firstName: item.members?.first_name ?? "",
    lastName: item.members?.last_name ?? "",
    status: asWorkflowStatus(item.workflow_status),
    enrolledAt: item.created_at,
    startedAt: item.started_at,
    completedAt: item.completed_at,
    cancelledAt: item.cancelled_at ?? null,
    withdrawnAt: item.withdrawn_at ?? null,
    batchId: item.batch_id,
    batchName: item.batchName ?? null,
    trainerName: item.trainerName ?? null,
  };
}

const ENROLLMENT_SELECT = `
  id,
  member_id,
  workflow_status,
  created_at,
  started_at,
  completed_at,
  cancelled_at,
  withdrawn_at,
  batch_id,
  members ( first_name, last_name )
`;

export async function getTrainingProgramDetail(
  programName: string,
): Promise<TrainingProgramDetail> {
  const { data: programs, error: programError } = await supabase
    .from("trainings")
    .select("id, name");
  if (programError) throw programError;
  const program = (programs ?? []).find(
    (item) => programNamesMatch(item.name, programName),
  );
  if (!program) throw new Error(`Training program "${programName}" was not found in Supabase. Apply migration 018, then reload the page.`);

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("member_trainings")
    .select(ENROLLMENT_SELECT)
    .eq("training_id", program.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (enrollmentError) throw enrollmentError;

  const batchIds = Array.from(
    new Set((enrollments ?? []).map((item: any) => item.batch_id).filter(Boolean)),
  );
  const { data: batches, error: batchError } = batchIds.length
    ? await supabase
        .from("training_batches")
        .select("id, name, trainer_user_id")
        .in("id", batchIds)
    : { data: [], error: null };
  if (batchError) throw batchError;
  const trainerIds = Array.from(
    new Set((batches ?? []).map((item: any) => item.trainer_user_id).filter(Boolean)),
  );
  const { data: trainers, error: trainerError } = trainerIds.length
    ? await supabase.from("users").select("id, display_name").in("id", trainerIds)
    : { data: [], error: null };
  if (trainerError) throw trainerError;
  const trainersById = new Map(
    (trainers ?? []).map((item: any) => [item.id, item.display_name]),
  );
  const batchesById = new Map(
    (batches ?? []).map((item: any) => [
      item.id,
      {
        name: item.name,
        trainerName: trainersById.get(item.trainer_user_id) ?? null,
      },
    ]),
  );

  return {
    id: program.id,
    name: program.name,
    enrollments: (enrollments ?? []).map((item: any) => {
      const batch = batchesById.get(item.batch_id) as
        | { name: string; trainerName: string | null }
        | undefined;
      return mapEnrollment({
        ...item,
        batchName: batch?.name,
        trainerName: batch?.trainerName,
      });
    }),
  };
}

export async function getMemberTrainingProfile(
  enrollmentId: string,
): Promise<MemberTrainingProfile> {
  const { data: enrollment, error: enrollmentError } = await supabase
    .from("member_trainings")
    .select(`
      id,
      member_id,
      training_id,
      workflow_status,
      created_at,
      started_at,
      completed_at,
      cancelled_at,
      withdrawn_at,
      batch_id
    `)
    .eq("id", enrollmentId)
    .single();
  if (enrollmentError) throw enrollmentError;
  const enrollmentRecord = enrollment as any;

  const [memberResult, programResult] = await Promise.all([
    supabase
      .from("members")
      .select("first_name, last_name")
      .eq("id", enrollmentRecord.member_id)
      .single(),
    supabase
      .from("trainings")
      .select("id, name")
      .eq("id", enrollmentRecord.training_id)
      .single(),
  ]);
  if (memberResult.error) throw memberResult.error;
  if (programResult.error) throw programResult.error;
  const programRecord = programResult.data;
  const hydratedEnrollment = {
    ...enrollmentRecord,
    members: memberResult.data,
  };
  const { data: batchConfiguration, error: batchConfigurationError } = enrollmentRecord.batch_id
    ? await supabase.from("training_batches").select("required_sessions, excused_counts").eq("id", enrollmentRecord.batch_id).single()
    : { data: null, error: null };
  if (batchConfigurationError) throw batchConfigurationError;

  const [sessionResult, attendanceResult, notesResult, remedialResult] =
    await Promise.all([
      enrollmentRecord.batch_id
        ? supabase
            .from("training_sessions")
            .select("id, title, session_date, display_order")
            .eq("batch_id", enrollmentRecord.batch_id)
            .order("display_order")
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("training_attendance")
        .select("session_id, status, notes")
        .eq("member_training_id", enrollmentId),
      supabase
        .from("training_notes")
        .select("id, note, created_at, created_by")
        .eq("member_training_id", enrollmentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("training_remedials")
        .select("id, session_id, scheduled_for, status, notes, completed_at")
        .eq("member_training_id", enrollmentId)
        .order("scheduled_for", { ascending: false }),
    ]);

  for (const result of [
    sessionResult,
    attendanceResult,
    notesResult,
    remedialResult,
  ]) {
    if (result.error) throw result.error;
  }

  const attendanceBySession = new Map(
    (attendanceResult.data ?? []).map((item: any) => [item.session_id, item]),
  );
  const noteAuthorIds = Array.from(
    new Set((notesResult.data ?? []).map((item: any) => item.created_by).filter(Boolean)),
  );
  const { data: noteAuthors, error: noteAuthorError } = noteAuthorIds.length
    ? await supabase.from("users").select("id, display_name").in("id", noteAuthorIds)
    : { data: [], error: null };
  if (noteAuthorError) throw noteAuthorError;
  const noteAuthorsById = new Map(
    (noteAuthors ?? []).map((item: any) => [item.id, item.display_name]),
  );
  const sessionTitles = new Map(
    (sessionResult.data ?? []).map((session: any) => [session.id, session.title]),
  );
  const remedialsBySession = new Map(
    (remedialResult.data ?? [])
      .filter((item: any) => item.session_id && item.status !== "cancelled")
      .map((item: any) => [item.session_id, item]),
  );

  return {
    enrollment: mapEnrollment(hydratedEnrollment),
    programId: programRecord.id,
    programName: programRecord.name,
    sessions: (sessionResult.data ?? []).map((session: any) => {
      const attendance = attendanceBySession.get(session.id) as any;
      const remedial = remedialsBySession.get(session.id) as any;
      return {
        sessionId: session.id,
        title: session.title,
        sessionDate: session.session_date,
        status: attendance?.status ?? null,
        notes: attendance?.notes ?? null,
        remedialStatus: remedial?.status ?? null,
        remedialCompletedAt: remedial?.completed_at ?? null,
      };
    }),
    notes: (notesResult.data ?? []).map((note: any) => ({
      id: note.id,
      note: note.note,
      createdAt: note.created_at,
      author: noteAuthorsById.get(note.created_by) ?? "Portal user",
    })),
    remedials: (remedialResult.data ?? []).map((item: any) => ({
      id: item.id,
      sessionId: item.session_id,
      sessionTitle: sessionTitles.get(item.session_id) ?? "Session not recorded",
      scheduledFor: item.scheduled_for,
      status: item.status,
      notes: item.notes,
      completedAt: item.completed_at,
    })),
    requiredSessions: batchConfiguration?.required_sessions ?? sessionResult.data?.length ?? 0,
    excusedCounts: batchConfiguration?.excused_counts ?? false,
  };
}

export async function cancelTrainingEnrollment(enrollmentId: string, reason = "") {
  const { error } = await supabase.rpc("cancel_training_enrollment", {
    p_enrollment_id: enrollmentId,
    p_reason: reason || null,
  });
  if (error) throw error;
}

export async function restoreTrainingEnrollment(enrollmentId: string, batchId: string, reason = "") {
  const { error } = await supabase.rpc("restore_training_enrollment", {
    p_enrollment_id: enrollmentId,
    p_batch_id: batchId,
    p_reason: reason || null,
  });
  if (error) throw error;
}

export async function withdrawTrainingEnrollment(enrollmentId: string, reason = "") {
  const { error } = await supabase.rpc("withdraw_training_enrollment", {
    p_enrollment_id: enrollmentId,
    p_reason: reason || null,
  });
  if (error) throw error;
}

export async function getTrainingBatches(trainingId: string) {
  const { data, error } = await supabase
    .from("training_batches")
    .select("id, name, trainer_user_id")
    .eq("training_id", trainingId)
    .order("name");
  if (error) throw error;
  const trainerIds = Array.from(
    new Set((data ?? []).map((item: any) => item.trainer_user_id).filter(Boolean)),
  );
  const { data: trainers, error: trainerError } = trainerIds.length
    ? await supabase.from("users").select("id, display_name").in("id", trainerIds)
    : { data: [], error: null };
  if (trainerError) throw trainerError;
  const trainersById = new Map(
    (trainers ?? []).map((item: any) => [item.id, item.display_name]),
  );
  return (data ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    trainerName: trainersById.get(item.trainer_user_id) ?? null,
  })) as TrainingBatchOption[];
}

export async function assignEnrollmentBatch(
  enrollmentId: string,
  batchId: string | null,
) {
  const { error } = await supabase
    .from("member_trainings")
    .update({ batch_id: batchId })
    .eq("id", enrollmentId);
  if (error) throw error;
}

export async function getAssignableTrainers() {
  const { data, error } = await supabase
    .from("users")
    .select(`
      id,
      display_name,
      user_roles!user_roles_user_id_fkey (
        roles ( code )
      )
    `)
    .eq("is_active", true)
    .order("display_name");
  if (error) throw error;
  return (data ?? [])
    .filter((user: any) =>
      (user.user_roles ?? []).some((assignment: any) =>
        ["administrator", "trainer"].includes(assignment.roles?.code),
      ),
    )
    .map((user: any) => ({ id: user.id, name: user.display_name })) as TrainerOption[];
}

export async function assignBatchTrainer(
  batchId: string,
  trainerUserId: string | null,
) {
  const { error } = await supabase
    .from("training_batches")
    .update({ trainer_user_id: trainerUserId })
    .eq("id", batchId);
  if (error) throw error;
}

export async function createTrainingBatch(
  trainingId: string,
  name: string,
) {
  const { data, error } = await supabase
    .from("training_batches")
    .insert({ training_id: trainingId, name, status: "open" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function saveAttendance(
  enrollmentId: string,
  sessionId: string,
  status: string,
) {
  const { error } = await supabase.rpc("record_training_attendance", { p_enrollment_id: enrollmentId, p_session_id: sessionId, p_status: status });
  if (error) throw error;
}

export async function addTrainingNote(enrollmentId: string, note: string) {
  const { error } = await supabase
    .from("training_notes")
    .insert({ member_training_id: enrollmentId, note });
  if (error) throw error;
}

export async function updateTrainingNote(noteId: string, note: string) {
  const { error } = await supabase.from("training_notes").update({ note, updated_at: new Date().toISOString() }).eq("id", noteId);
  if (error) throw error;
}

export async function scheduleRemedial(
  enrollmentId: string,
  sessionId: string,
  scheduledFor: string,
  notes: string,
) {
  const { error } = await supabase.rpc("schedule_training_remedial", {
    p_enrollment_id: enrollmentId,
    p_session_id: sessionId,
    p_scheduled_for: scheduledFor,
    p_notes: notes || null,
  });
  if (error) throw error;
}

export async function completeRemedial(remedialId: string, completedOn: string) {
  const { error } = await supabase.rpc("complete_training_remedial", {
    p_remedial_id: remedialId,
    p_completed_on: completedOn,
  });
  if (error) throw error;
}

export async function reopenRemedial(remedialId: string) {
  const { error } = await supabase.rpc("reopen_training_remedial", {
    p_remedial_id: remedialId,
  });
  if (error) throw error;
}

export async function completeTraining(
  enrollmentId: string,
) {
  const { error } = await supabase.rpc("complete_training_enrollment", {
    p_enrollment_id: enrollmentId,
    p_next_training_id: null,
    p_recommendation_text: null,
  });
  if (error) throw error;
}

export async function reopenTrainingEnrollment(enrollmentId: string, reason = "") {
  const { error } = await supabase.rpc("reopen_training_enrollment", {
    p_enrollment_id: enrollmentId,
    p_reason: reason || null,
  });
  if (error) throw error;
}

export interface PendingTrainingEnrollment extends TrainingEnrollment {
  programName: string;
  programSlug: string;
}

export type CancelledTrainingEnrollment = TrainingEnrollment;

export async function getPendingTrainingCount() {
  const { count, error } = await supabase
    .from("member_trainings")
    .select("id", { count: "exact", head: true })
    .eq("workflow_status", "pending_enrollment")
    .is("archived_at", null);
  if (error) throw error;
  return count ?? 0;
}

export interface TrainingBatch {
  id: string;
  trainingId: string;
  name: string;
  trainerName: string | null;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  studentCount: number;
  requiredSessions: number;
  cadenceDays: number;
  excusedCounts: boolean;
  attendanceProgress: number;
  archivedAt: string | null;
}

export interface MemberTrainingJourneyItem {
  enrollmentId: string;
  programName: string;
  programSlug: string;
  status: TrainingWorkflowStatus;
  batchName: string | null;
  attemptNumber: number;
  enrolledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  withdrawnAt: string | null;
}

export async function getPendingTrainingEnrollments() {
  const { data, error } = await supabase
    .from("member_trainings")
    .select(`
      id,
      member_id,
      workflow_status,
      created_at,
      started_at,
      completed_at,
      cancelled_at,
      withdrawn_at,
      batch_id,
      members ( first_name, last_name ),
      trainings ( name )
    `)
    .eq("workflow_status", "pending_enrollment")
    .is("archived_at", null)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((item: any) => {
    const program = TRAINING_PROGRAMS.find(
      (entry) => programNamesMatch(entry.name, item.trainings?.name ?? ""),
    );
    return {
      ...mapEnrollment(item),
      programName: item.trainings?.name ?? "Not recorded",
      programSlug: program?.slug ?? "",
    };
  }) as PendingTrainingEnrollment[];
}

export async function getProgramBatches(trainingId: string) {
  const { data: batches, error } = await supabase
    .from("training_batches")
    .select("id, training_id, name, trainer_user_id, status, starts_on, ends_on, required_sessions, cadence_days, excused_counts, archived_at")
    .eq("training_id", trainingId)
    .is("archived_at", null)
    .order("starts_on", { ascending: false });
  if (error) throw error;
  const batchIds = (batches ?? []).map((batch) => batch.id);
  const { data: enrollments, error: enrollmentError } = batchIds.length
    ? await supabase
        .from("member_trainings")
        .select("batch_id, workflow_status")
        .in("batch_id", batchIds)
        .is("archived_at", null)
    : { data: [], error: null };
  if (enrollmentError) throw enrollmentError;
  const { data: sessions, error: sessionError } = batchIds.length
    ? await supabase.from("training_sessions").select("id, batch_id").in("batch_id", batchIds)
    : { data: [], error: null };
  if (sessionError) throw sessionError;
  const sessionIds = (sessions ?? []).map((session) => session.id);
  const { data: recordedAttendance, error: attendanceError } = sessionIds.length
    ? await supabase.from("training_attendance").select("session_id").in("session_id", sessionIds)
    : { data: [], error: null };
  if (attendanceError) throw attendanceError;
  const trainerIds = Array.from(
    new Set((batches ?? []).map((batch) => batch.trainer_user_id).filter(Boolean)),
  );
  const { data: trainers, error: trainerError } = trainerIds.length
    ? await supabase.from("users").select("id, display_name").in("id", trainerIds)
    : { data: [], error: null };
  if (trainerError) throw trainerError;
  const trainerNames = new Map(
    (trainers ?? []).map((trainer) => [trainer.id, trainer.display_name]),
  );
  return (batches ?? []).map((batch) => ({
    id: batch.id,
    trainingId: batch.training_id,
    name: batch.name,
    trainerName: trainerNames.get(batch.trainer_user_id) ?? null,
    status: batch.status,
    startsOn: batch.starts_on,
    endsOn: batch.ends_on,
    studentCount: (enrollments ?? []).filter(
      (enrollment) => enrollment.batch_id === batch.id && isActiveTrainingStatus(enrollment.workflow_status),
    ).length,
    requiredSessions: batch.required_sessions ?? 10,
    cadenceDays: batch.cadence_days ?? 7,
    excusedCounts: batch.excused_counts ?? false,
    attendanceProgress: new Set((recordedAttendance ?? []).filter((record) => (sessions ?? []).some((session) => session.id === record.session_id && session.batch_id === batch.id)).map((record) => record.session_id)).size,
    archivedAt: batch.archived_at,
  })) as TrainingBatch[];
}

export async function getAvailableMembers(trainingId: string) {
  const [{ data: members, error: memberError }, { data: existing, error: existingError }] =
    await Promise.all([
      supabase
        .from("members")
        .select("id, first_name, last_name, membership_status")
        .order("first_name"),
      supabase
        .from("member_trainings")
        .select("member_id, workflow_status, archived_at, updated_at")
        .eq("training_id", trainingId)
        .is("archived_at", null)
        .order("updated_at", { ascending: false }),
    ]);
  if (memberError) throw memberError;
  if (existingError) throw existingError;
  const latestByMember = new Map<string, string>();
  for (const item of existing ?? []) {
    if (!latestByMember.has(item.member_id)) latestByMember.set(item.member_id, item.workflow_status);
  }
  const existingIds = new Set(Array.from(latestByMember).filter(([, status]) => isActiveTrainingStatus(status) || status === "cancelled").map(([memberId]) => memberId));
  return (members ?? []).filter(
    (member) =>
      !existingIds.has(member.id) &&
      String(member.membership_status ?? "Active").toLowerCase() !== "inactive",
  );
}

export async function getCancelledTrainingEnrollments(trainingId: string) {
  const { data, error } = await supabase
    .from("member_trainings")
    .select(ENROLLMENT_SELECT)
    .eq("training_id", trainingId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const latestByMember = new Map<string, any>();
  for (const item of (data ?? []) as any[]) {
    if (!latestByMember.has(item.member_id)) latestByMember.set(item.member_id, item);
  }
  return Array.from(latestByMember.values()).filter((item) => item.workflow_status === "cancelled").map(mapEnrollment) as CancelledTrainingEnrollment[];
}

export async function enrollBatchStudents(batchId: string, memberIds: string[]) {
  const { data, error } = await supabase.rpc("enroll_training_batch_students", {
    p_batch_id: batchId,
    p_member_ids: memberIds,
  });
  if (error) throw error;
  return data as number;
}

export async function createConfiguredTrainingCycle(trainingId: string, startDate: string, requiredSessions: number) {
  const { data, error } = await supabase.rpc("create_training_cycle", { p_training_id: trainingId, p_start_date: startDate, p_required_sessions: requiredSessions, p_cadence_days: 7 });
  if (error) throw error;
  return data as TrainingBatch & { id: string };
}

export async function startTrainingCycle(cycleId: string) {
  const { error } = await supabase.rpc("start_training_cycle", { p_cycle_id: cycleId });
  if (error) throw error;
}

export async function rescheduleTrainingSession(sessionId: string, sessionDate: string, shiftSucceeding: boolean, reason = "") {
  const { data, error } = await supabase.rpc("reschedule_training_session", {
    p_session_id: sessionId,
    p_new_date: sessionDate,
    p_shift_succeeding: shiftSucceeding,
    p_reason: reason || null,
  });
  if (error) throw error;
  return data as number;
}

export async function reopenTrainingSession(sessionId: string, reason = "") {
  const { error } = await supabase.rpc("reopen_training_session", {
    p_session_id: sessionId,
    p_reason: reason || null,
  });
  if (error) throw error;
}

export async function closeTrainingSessionEditing(sessionId: string, reason = "") {
  const { error } = await supabase.rpc("close_training_session_editing", {
    p_session_id: sessionId,
    p_reason: reason || null,
  });
  if (error) throw error;
}

export async function deleteTrainingSession(sessionId: string) {
  const { error } = await supabase.rpc("delete_unrecorded_training_session", { p_session_id: sessionId });
  if (error) throw error;
}

export async function completeTrainingCycle(cycleId: string) {
  const { data, error } = await supabase.rpc("close_training_class", {
    p_class_id: cycleId,
  });
  if (error) throw error;
  return data as { closed: boolean; pending: number; active: number; incompleteRemedials: number };
}

export async function archiveTrainingClass(cycleId: string) {
  const { error } = await supabase.rpc("archive_training_class", { p_class_id: cycleId });
  if (error) throw error;
}

export async function resetTrainingCycleForDemo(cycleId: string) {
  const { data, error } = await supabase.rpc("reset_training_cycle_for_demo", {
    p_cycle_id: cycleId,
  });
  if (error) throw error;
  return data as number;
}

export async function archiveImportedTrainingEnrollments() {
  const { data, error } = await supabase.rpc(
    "archive_imported_training_enrollments",
  );
  if (error) throw error;
  return data as number;
}

export async function getTrainingBatchWorkspace(batchId: string) {
  const { data: batch, error: batchError } = await supabase
    .from("training_batches")
    .select("id, training_id, name, trainer_user_id, status, starts_on, ends_on, required_sessions, cadence_days, excused_counts")
    .eq("id", batchId)
    .single();
  if (batchError) throw batchError;
  const [programResult, enrollmentResult, sessionResult] =
    await Promise.all([
      supabase.from("trainings").select("id, name").eq("id", batch.training_id).single(),
      supabase
        .from("member_trainings")
        .select(ENROLLMENT_SELECT)
        .eq("batch_id", batchId)
        .is("archived_at", null)
        .order("created_at"),
      supabase
        .from("training_sessions")
        .select("id, title, session_date, display_order, attendance_reopened_at, attendance_reopened_by")
        .eq("batch_id", batchId)
        .order("display_order"),
    ]);
  for (const result of [programResult, enrollmentResult, sessionResult]) {
    if (result.error) throw result.error;
  }
  if (!programResult.data) throw new Error("Training program not found.");
  const program = programResult.data;
  let trainerName: string | null = null;
  if (batch.trainer_user_id) {
    const { data: trainer, error } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", batch.trainer_user_id)
      .single();
    if (error) throw error;
    trainerName = trainer.display_name;
  }
  const enrollmentIds = (enrollmentResult.data ?? []).map((item) => item.id);
  const currentSessionIds = (sessionResult.data ?? []).map((session) => session.id);
  const [{ data: attendance, error: attendanceError }, { data: remedials, error: remedialError }] = await Promise.all([
    enrollmentIds.length && currentSessionIds.length
      ? supabase.from("training_attendance").select("member_training_id, session_id, status").in("member_training_id", enrollmentIds).in("session_id", currentSessionIds)
      : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length && currentSessionIds.length
      ? supabase.from("training_remedials").select("id, member_training_id, session_id, scheduled_for, status, completed_at, notes").in("member_training_id", enrollmentIds).in("session_id", currentSessionIds).neq("status", "cancelled")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (attendanceError) throw attendanceError;
  if (remedialError) throw remedialError;

  const mappedEnrollments = (enrollmentResult.data ?? []).map(mapEnrollment);
  const activeEnrollments = mappedEnrollments.filter((item) => isActiveTrainingStatus(item.status));

  return {
    batch: {
      id: batch.id,
      trainingId: batch.training_id,
      name: batch.name,
      trainerName,
      status: batch.status,
      startsOn: batch.starts_on,
      endsOn: batch.ends_on,
      studentCount: activeEnrollments.length,
      requiredSessions: batch.required_sessions ?? 10,
      cadenceDays: batch.cadence_days ?? 7,
      excusedCounts: batch.excused_counts ?? false,
      attendanceProgress: new Set((attendance ?? []).map((item) => item.session_id)).size,
    } as TrainingBatch,
    program,
    enrollments: mappedEnrollments,
    sessions: sessionResult.data ?? [],
    attendance: attendance ?? [],
    remedials: remedials ?? [],
  };
}

export async function createTrainingSession(
  batchId: string,
  title: string,
  sessionDate: string | null,
) {
  const { error } = await supabase.from("training_sessions").insert({
    batch_id: batchId,
    title,
    session_date: sessionDate || null,
  });
  if (error) throw error;
}


export async function getMemberTrainingJourney(memberId: string) {
  const { data, error } = await supabase
    .from("member_trainings")
    .select(`
      id,
      workflow_status,
      created_at,
      started_at,
      completed_at,
      cancelled_at,
      withdrawn_at,
      trainings ( name ),
      training_batches ( name )
    `)
    .eq("member_id", memberId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const totals = new Map<string, number>();
  for (const item of (data ?? []) as any[]) {
    const key = item.trainings?.name ?? "Not recorded";
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return (data ?? []).map((item: any) => {
    const program = TRAINING_PROGRAMS.find(
      (entry) => programNamesMatch(entry.name, item.trainings?.name ?? ""),
    );
    const key = item.trainings?.name ?? "Not recorded";
    const newerAttempts = seen.get(key) ?? 0;
    seen.set(key, newerAttempts + 1);
    return {
      enrollmentId: item.id,
      programName: item.trainings?.name ?? "Not recorded",
      programSlug: program?.slug ?? "",
      status: asWorkflowStatus(item.workflow_status),
      batchName: item.training_batches?.name ?? null,
      attemptNumber: (totals.get(key) ?? 1) - newerAttempts,
      enrolledAt: item.created_at,
      startedAt: item.started_at,
      completedAt: item.completed_at,
      cancelledAt: item.cancelled_at,
      withdrawnAt: item.withdrawn_at,
    };
  }) as MemberTrainingJourneyItem[];
}
