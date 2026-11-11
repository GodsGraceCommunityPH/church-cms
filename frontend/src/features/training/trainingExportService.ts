import { supabase } from "../../lib/supabase";
import {
  buildTrainingStudentsExport,
  type TrainingExportScope,
  type TrainingStudentExportRecord,
} from "./trainingExport.ts";

const PAGE_SIZE = 1000;

interface TrainingStudentSourceRow {
  id: string;
  workflow_status: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  withdrawn_at: string | null;
  cancelled_at: string | null;
  members:
    | {
        first_name: string | null;
        last_name: string | null;
        gender: string | null;
      }
    | Array<{
        first_name: string | null;
        last_name: string | null;
        gender: string | null;
      }>
    | null;
  trainings: { name: string | null } | Array<{ name: string | null }> | null;
  training_batches:
    | { name: string | null; trainer_user_id: string | null }
    | Array<{ name: string | null; trainer_user_id: string | null }>
    | null;
}

function firstRelated<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function fetchTrainingStudentSourceRows() {
  const rows: TrainingStudentSourceRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("member_trainings")
      .select(`
        id,
        workflow_status,
        created_at,
        started_at,
        completed_at,
        withdrawn_at,
        cancelled_at,
        members!member_trainings_member_id_fkey ( first_name, last_name, gender ),
        trainings ( name ),
        training_batches ( name, trainer_user_id )
      `)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as unknown as TrainingStudentSourceRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchTrainerNames(trainerIds: string[]) {
  if (trainerIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase
    .from("users")
    .select("id, display_name")
    .in("id", trainerIds);
  if (error) throw error;

  return new Map(
    ((data ?? []) as Array<{ id: string; display_name: string | null }>).map(
      (trainer) => [trainer.id, trainer.display_name ?? ""],
    ),
  );
}

export async function fetchTrainingStudentExportRecords(): Promise<
  TrainingStudentExportRecord[]
> {
  const rows = await fetchTrainingStudentSourceRows();
  const trainerIds = Array.from(
    new Set(
      rows
        .map((row) => firstRelated(row.training_batches)?.trainer_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const trainerNames = await fetchTrainerNames(trainerIds);

  return rows.map((row) => {
    const member = firstRelated(row.members);
    const program = firstRelated(row.trainings);
    const batch = firstRelated(row.training_batches);
    return {
      programName: program?.name ?? "Not recorded",
      batchName: batch?.name ?? null,
      trainerName: batch?.trainer_user_id
        ? trainerNames.get(batch.trainer_user_id) ?? null
        : null,
      firstName: member?.first_name ?? "",
      lastName: member?.last_name ?? "",
      gender: member?.gender ?? null,
      status: row.workflow_status ?? "",
      enrolledAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      withdrawnAt: row.withdrawn_at,
      cancelledAt: row.cancelled_at,
    };
  });
}

export async function buildTrainingStudentsExportFromDatabase(
  scope: TrainingExportScope,
) {
  const records = await fetchTrainingStudentExportRecords();
  return buildTrainingStudentsExport(records, scope);
}
