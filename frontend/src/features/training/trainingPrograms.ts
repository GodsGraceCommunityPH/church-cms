export const TRAINING_PROGRAMS = [
  { name: "SUYNL", slug: "suynl" },
  { name: "Life Class", slug: "life-class" },
  { name: "SOL 1", slug: "sol-1" },
  { name: "SOL 2", slug: "sol-2" },
  { name: "SOL 3", slug: "sol-3" },
] as const;

export type TrainingProgram = (typeof TRAINING_PROGRAMS)[number];

export function getTrainingProgram(slug: string | undefined) {
  return TRAINING_PROGRAMS.find((program) => program.slug === slug);
}
