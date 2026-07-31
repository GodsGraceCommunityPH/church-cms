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

export interface TrainingProgramSummary {
  name: string;
  slug: string;
  totalEnrolled: number | null;
  completed: number | null;
  inProgress: number | null;
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
  batchId: string | null;
  batchName: string | null;
  trainerName: string | null;
}

export interface TrainingProgramDetail {
  id: string;
  name: string;
  enrollments: TrainingEnrollment[];
}

export interface TrainingRequirementProgress {
  id: string | null;
  requirementId: string;
  name: string;
  description: string | null;
  requirementType: string;
  status: "pending" | "complete" | "missing" | "for_remedial";
  completedAt: string | null;
  attendanceStatus: string | null;
  notes: string | null;
  remedialRequired: boolean;
  remedialDate: string | null;
}

export interface TrainingSessionAttendance {
  sessionId: string;
  title: string;
  sessionDate: string | null;
  status: string | null;
  notes: string | null;
}

export interface TrainingNote {
  id: string;
  note: string;
  createdAt: string;
  author: string;
}

export interface TrainingRemedial {
  id: string;
  scheduledFor: string;
  status: string;
  notes: string | null;
}

export interface AdvancementEligibility {
  status: string;
  recommendation: string | null;
  nextProgram: string;
  recommendedAt: string;
}

export interface MemberTrainingProfile {
  enrollment: TrainingEnrollment;
  programId: string;
  programName: string;
  requirements: TrainingRequirementProgress[];
  sessions: TrainingSessionAttendance[];
  notes: TrainingNote[];
  remedials: TrainingRemedial[];
  advancement: AdvancementEligibility[];
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

interface MemberTrainingRow {
  training_id: string;
  workflow_status: string | null;
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

export function trainingStatusLabel(status: string) {
  return asWorkflowStatus(status)
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function trainingErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };
    const message = value.message ?? value.details ?? "Unknown Supabase error";
    return value.code ? `${value.code}: ${message}` : message;
  }
  return "Unknown Training error";
}

export async function getTrainingOverview(): Promise<TrainingProgramSummary[]> {
  const [trainingsResult, enrollmentResult] = await Promise.all([
    supabase.from("trainings").select("id, name"),
    supabase.from("member_trainings").select("training_id, workflow_status"),
  ]);
  if (trainingsResult.error) throw trainingsResult.error;
  if (enrollmentResult.error) throw enrollmentResult.error;
  const trainings = (trainingsResult.data ?? []) as TrainingRow[];
  const enrollments = (enrollmentResult.data ?? []) as MemberTrainingRow[];

  return TRAINING_PROGRAMS.map((program) => {
    const training = trainings.find(
      (item) => item.name.trim().toLowerCase() === program.name.toLowerCase(),
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
        isInProgressTrainingStatus(item.workflow_status ?? ""),
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
  batch_id,
  members ( first_name, last_name )
`;

export async function getTrainingProgramDetail(
  programName: string,
): Promise<TrainingProgramDetail> {
  const { data: program, error: programError } = await supabase
    .from("trainings")
    .select("id, name")
    .eq("name", programName)
    .single();
  if (programError) throw programError;

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("member_trainings")
    .select(ENROLLMENT_SELECT)
    .eq("training_id", program.id)
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
      batch_id
    `)
    .eq("id", enrollmentId)
    .single();
  if (enrollmentError) throw enrollmentError;
  const enrollmentRecord = enrollment as any;

  const [memberResult, programResult, batchResult] = await Promise.all([
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
    enrollmentRecord.batch_id
      ? supabase
          .from("training_batches")
          .select("id, name, trainer_user_id")
          .eq("id", enrollmentRecord.batch_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (memberResult.error) throw memberResult.error;
  if (programResult.error) throw programResult.error;
  if (batchResult.error) throw batchResult.error;

  let trainerName: string | null = null;
  if (batchResult.data?.trainer_user_id) {
    const { data: trainer, error: trainerError } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", batchResult.data.trainer_user_id)
      .single();
    if (trainerError) throw trainerError;
    trainerName = trainer.display_name;
  }
  const programRecord = programResult.data;
  const hydratedEnrollment = {
    ...enrollmentRecord,
    members: memberResult.data,
    batchName: batchResult.data?.name ?? null,
    trainerName,
  };

  const [requirementResult, progressResult, sessionResult, attendanceResult, notesResult, remedialResult, advancementResult] =
    await Promise.all([
      supabase
        .from("training_requirements")
        .select("id, name, description, requirement_type, display_order")
        .eq("training_id", programRecord.id)
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("member_training_requirements")
        .select("*")
        .eq("member_training_id", enrollmentId),
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
        .select("id, scheduled_for, status, notes")
        .eq("member_training_id", enrollmentId)
        .order("scheduled_for", { ascending: false }),
      supabase
        .from("training_advancement_eligibility")
        .select("status, recommendation, recommended_at, next_training_id")
        .eq("source_member_training_id", enrollmentId),
    ]);

  for (const result of [
    requirementResult,
    progressResult,
    sessionResult,
    attendanceResult,
    notesResult,
    remedialResult,
    advancementResult,
  ]) {
    if (result.error) throw result.error;
  }

  const progressByRequirement = new Map(
    (progressResult.data ?? []).map((item: any) => [item.requirement_id, item]),
  );
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
  const nextTrainingIds = Array.from(
    new Set(
      (advancementResult.data ?? [])
        .map((item: any) => item.next_training_id)
        .filter(Boolean),
    ),
  );
  const { data: nextPrograms, error: nextProgramError } = nextTrainingIds.length
    ? await supabase.from("trainings").select("id, name").in("id", nextTrainingIds)
    : { data: [], error: null };
  if (nextProgramError) throw nextProgramError;
  const nextProgramsById = new Map(
    (nextPrograms ?? []).map((item: any) => [item.id, item.name]),
  );

  return {
    enrollment: mapEnrollment(hydratedEnrollment),
    programId: programRecord.id,
    programName: programRecord.name,
    requirements: (requirementResult.data ?? []).map((requirement: any) => {
      const progress = progressByRequirement.get(requirement.id) as any;
      return {
        id: progress?.id ?? null,
        requirementId: requirement.id,
        name: requirement.name,
        description: requirement.description,
        requirementType: requirement.requirement_type,
        status: progress?.status ?? "pending",
        completedAt: progress?.completed_at ?? null,
        attendanceStatus: progress?.attendance_status ?? null,
        notes: progress?.notes ?? null,
        remedialRequired: progress?.remedial_required ?? false,
        remedialDate: progress?.remedial_date ?? null,
      };
    }),
    sessions: (sessionResult.data ?? []).map((session: any) => {
      const attendance = attendanceBySession.get(session.id) as any;
      return {
        sessionId: session.id,
        title: session.title,
        sessionDate: session.session_date,
        status: attendance?.status ?? null,
        notes: attendance?.notes ?? null,
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
      scheduledFor: item.scheduled_for,
      status: item.status,
      notes: item.notes,
    })),
    advancement: (advancementResult.data ?? []).map((item: any) => ({
      status: item.status,
      recommendation: item.recommendation,
      nextProgram: nextProgramsById.get(item.next_training_id) ?? "Not recorded",
      recommendedAt: item.recommended_at,
    })),
  };
}

export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: TrainingWorkflowStatus,
) {
  const values: Record<string, string | null> = { workflow_status: status };
  if (status === "in_progress") values.started_at = new Date().toISOString();
  if (status !== "completed") values.completed_at = null;
  const { error } = await supabase
    .from("member_trainings")
    .update(values)
    .eq("id", enrollmentId);
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
  const { error } = await supabase
    .from("training_batches")
    .insert({ training_id: trainingId, name, status: "open" });
  if (error) throw error;
}

export async function saveAttendance(
  enrollmentId: string,
  sessionId: string,
  status: string,
) {
  const { error } = await supabase.from("training_attendance").upsert(
    { member_training_id: enrollmentId, session_id: sessionId, status },
    { onConflict: "member_training_id,session_id" },
  );
  if (error) throw error;
}

export async function addTrainingNote(enrollmentId: string, note: string) {
  const { error } = await supabase
    .from("training_notes")
    .insert({ member_training_id: enrollmentId, note });
  if (error) throw error;
}

export async function scheduleRemedial(
  enrollmentId: string,
  scheduledFor: string,
  notes: string,
) {
  const { error } = await supabase.from("training_remedials").insert({
    member_training_id: enrollmentId,
    scheduled_for: scheduledFor,
    notes: notes || null,
  });
  if (error) throw error;
}

export async function saveRequirementProgress(
  enrollmentId: string,
  requirementId: string,
  status: string,
) {
  const { error } = await supabase.from("member_training_requirements").upsert(
    {
      member_training_id: enrollmentId,
      requirement_id: requirementId,
      status,
      completed_at: status === "complete" ? new Date().toISOString() : null,
      remedial_required: status === "for_remedial",
    },
    { onConflict: "member_training_id,requirement_id" },
  );
  if (error) throw error;
}

export async function completeTraining(
  enrollmentId: string,
  nextTrainingId: string | null,
  recommendation: string,
) {
  const { error } = await supabase.rpc("complete_training_enrollment", {
    p_enrollment_id: enrollmentId,
    p_next_training_id: nextTrainingId,
    p_recommendation_text: recommendation || null,
  });
  if (error) throw error;
}

export async function getNextProgram(
  currentProgramName: string,
): Promise<{ id: string; name: string } | null> {
  const sequence = TRAINING_PROGRAMS.map((program) => program.name);
  const currentIndex = sequence.findIndex(
    (name) => name.toLowerCase() === currentProgramName.toLowerCase(),
  );
  const nextName = currentIndex >= 0 ? sequence[currentIndex + 1] : undefined;
  if (!nextName) return null;
  const { data, error } = await supabase
    .from("trainings")
    .select("id, name")
    .eq("name", nextName)
    .single();
  if (error) throw error;
  return data;
}
