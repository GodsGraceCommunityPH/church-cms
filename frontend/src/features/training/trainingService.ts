import { supabase } from "../../lib/supabase";
import { TRAINING_PROGRAMS } from "./trainingPrograms";

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
  status: string;
  enrolledAt: string;
  completedAt: string | null;
}

export interface TrainingProgramDetail {
  id: string;
  name: string;
  enrollments: TrainingEnrollment[];
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
  return status.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isCompletedTrainingStatus(status: string) {
  return ["complete", "completed", "graduated"].includes(
    normalizeTrainingStatus(status),
  );
}

export function isInProgressTrainingStatus(status: string) {
  return ![
    "complete",
    "completed",
    "graduated",
    "withdrawn",
    "cancelled",
    "canceled",
    "inactive",
  ].includes(normalizeTrainingStatus(status));
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
    .select(`
      id,
      member_id,
      status,
      created_at,
      completed_at,
      members (
        first_name,
        last_name
      )
    `)
    .eq("training_id", program.id)
    .order("created_at", { ascending: false });
  if (enrollmentError) throw enrollmentError;

  return {
    id: program.id,
    name: program.name,
    enrollments: (enrollments ?? []).map((item: any) => ({
      id: item.id,
      memberId: item.member_id,
      firstName: item.members?.first_name ?? "",
      lastName: item.members?.last_name ?? "",
      status: item.status ?? "In Progress",
      enrolledAt: item.created_at,
      completedAt: item.completed_at,
    })),
  };
}
