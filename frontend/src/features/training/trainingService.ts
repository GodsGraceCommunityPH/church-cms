import { supabase } from "../../lib/supabase";
import { TRAINING_PROGRAMS } from "./trainingPrograms";

export interface TrainingProgramSummary {
  name: string;
  slug: string;
  totalEnrolled: number | null;
  completed: number | null;
  inProgress: number | null;
}

interface TrainingRow {
  id: string;
  name: string;
}

interface MemberTrainingRow {
  training_id: string;
  status: string | null;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function getTrainingOverview(): Promise<TrainingProgramSummary[]> {
  const [trainingsResult, memberTrainingsResult] = await Promise.all([
    supabase.from("trainings").select("id, name"),
    supabase.from("member_trainings").select("training_id, status"),
  ]);

  if (trainingsResult.error) throw trainingsResult.error;
  if (memberTrainingsResult.error) throw memberTrainingsResult.error;

  const trainings = (trainingsResult.data ?? []) as TrainingRow[];
  const memberTrainings = (memberTrainingsResult.data ??
    []) as MemberTrainingRow[];

  return TRAINING_PROGRAMS.map((program) => {
    const training = trainings.find(
      (item) => normalize(item.name) === normalize(program.name),
    );
    const enrollments = training
      ? memberTrainings.filter((item) => item.training_id === training.id)
      : [];
    const completed = enrollments.filter((item) =>
      ["complete", "completed", "graduated"].includes(
        normalize(item.status ?? ""),
      ),
    ).length;
    const inProgress = enrollments.filter(
      (item) =>
        ![
          "complete",
          "completed",
          "graduated",
          "withdrawn",
          "cancelled",
          "canceled",
          "inactive",
        ].includes(normalize(item.status ?? "")),
    ).length;

    return {
      ...program,
      totalEnrolled: enrollments.length,
      completed,
      inProgress,
    };
  });
}
