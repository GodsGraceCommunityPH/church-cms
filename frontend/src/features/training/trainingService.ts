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
  status: string | null;
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

export async function getTrainingOverview(): Promise<TrainingProgramSummary[]> {
  const [trainingsResult, enrollmentResult] = await Promise.all([
    supabase.from("trainings").select("id, name"),
    supabase.from("member_trainings").select("training_id, status"),
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
        isCompletedTrainingStatus(item.status ?? ""),
      ).length,
      inProgress: programEnrollments.filter((item) =>
        isInProgressTrainingStatus(item.status ?? ""),
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
    status: asWorkflowStatus(item.status),
    enrolledAt: item.created_at,
    startedAt: item.started_at,
    completedAt: item.completed_at,
    batchId: item.batch_id,
    batchName: item.training_batches?.name ?? null,
    trainerName: item.training_batches?.trainer?.display_name ?? null,
  };
}

const ENROLLMENT_SELECT = `
  id,
  member_id,
  status,
  created_at,
  started_at,
  completed_at,
  batch_id,
  members ( first_name, last_name ),
  training_batches (
    name,
    trainer:users!training_batches_trainer_user_id_fkey ( display_name )
  )
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

  return {
    id: program.id,
    name: program.name,
    enrollments: (enrollments ?? []).map(mapEnrollment),
  };
}

export async function getMemberTrainingProfile(
  enrollmentId: string,
): Promise<MemberTrainingProfile> {
  const { data: enrollment, error: enrollmentError } = await supabase
    .from("member_trainings")
    .select(`${ENROLLMENT_SELECT}, trainings ( id, name )`)
    .eq("id", enrollmentId)
    .single();
  if (enrollmentError) throw enrollmentError;
  const enrollmentRecord = enrollment as any;

  const [requirementResult, progressResult, sessionResult, attendanceResult, notesResult, remedialResult, advancementResult] =
    await Promise.all([
      supabase
        .from("training_requirements")
        .select("id, name, description, requirement_type, display_order")
        .eq("training_id", enrollmentRecord.trainings.id)
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
        .select("id, note, created_at, author:users!training_notes_created_by_fkey(display_name)")
        .eq("member_training_id", enrollmentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("training_remedials")
        .select("id, scheduled_for, status, notes")
        .eq("member_training_id", enrollmentId)
        .order("scheduled_for", { ascending: false }),
      supabase
        .from("training_advancement_eligibility")
        .select("status, recommendation, recommended_at, next_program:trainings!training_advancement_eligibility_next_training_id_fkey(name)")
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

  return {
    enrollment: mapEnrollment(enrollmentRecord),
    programId: enrollmentRecord.trainings.id,
    programName: enrollmentRecord.trainings.name,
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
      author: note.author?.display_name ?? "Portal user",
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
      nextProgram: item.next_program?.name ?? "Not recorded",
      recommendedAt: item.recommended_at,
    })),
  };
}

export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: TrainingWorkflowStatus,
) {
  const values: Record<string, string | null> = { status };
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
    .select("id, name, trainer:users!training_batches_trainer_user_id_fkey(display_name)")
    .eq("training_id", trainingId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    trainerName: item.trainer?.display_name ?? null,
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
    .select("id, display_name, user_roles(roles(code))")
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
