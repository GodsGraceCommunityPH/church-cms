import { TRAINING_PROGRAMS } from "./trainingPrograms";

export interface TrainingProgramSummary {
  name: string;
  slug: string;
  totalEnrolled: number | null;
  completed: number | null;
  inProgress: number | null;
}

export async function getTrainingOverview(): Promise<TrainingProgramSummary[]> {
  // The approved Training tables are documented but not yet present in Supabase.
  // Keep statistics empty until the backend is implemented.
  return TRAINING_PROGRAMS.map((program) => ({
    ...program,
    totalEnrolled: null,
    completed: null,
    inProgress: null,
  }));
}
