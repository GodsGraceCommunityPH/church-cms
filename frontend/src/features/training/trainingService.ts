import { supabase } from "../../lib/supabase";
import { TRAINING_PROGRAMS } from "./trainingPrograms";

export interface TrainingProgramSummary {
  name: string;
  slug: string;
  totalEnrolled: number | null;
  completed: number | null;
  inProgress: number | null;
}

interface TrainingOverviewRow {
  training_name: string;
  total_enrolled: number;
  completed: number;
  in_progress: number;
}

export async function getTrainingOverview(): Promise<TrainingProgramSummary[]> {
  const { data, error } = await supabase.rpc("get_training_overview_stats");

  if (error?.code === "PGRST202") {
    return TRAINING_PROGRAMS.map((program) => ({
      ...program,
      totalEnrolled: null,
      completed: null,
      inProgress: null,
    }));
  }

  if (error) throw error;

  const stats = (data ?? []) as TrainingOverviewRow[];

  return TRAINING_PROGRAMS.map((program) => {
    const programStats = stats.find(
      (item) => item.training_name === program.name,
    );

    return {
      ...program,
      totalEnrolled: Number(programStats?.total_enrolled ?? 0),
      completed: Number(programStats?.completed ?? 0),
      inProgress: Number(programStats?.in_progress ?? 0),
    };
  });
}
