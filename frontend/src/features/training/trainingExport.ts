import type { TrainingEnrollment, TrainingProgramSummary } from "./trainingService";
import type { ExportColumn } from "../export/exportTypes";
import type { ExportSheet } from "../export/exportTypes";
import {
  assertExportHasRows,
  createExportSheet,
  formatExportDate,
  normalizeGenderLabel,
  sanitizeSheetName,
  toExportText,
} from "../export/exportUtils.ts";

export type TrainingExportScope = "current" | "completed";

const ACTIVE_STATUSES = new Set([
  "pending_enrollment",
  "in_progress",
  "for_remedial",
  "ready_for_completion",
]);

const STATUS_LABELS: Record<string, string> = {
  pending_enrollment: "Pending Enrollment",
  in_progress: "In Progress",
  for_remedial: "For Remedial",
  ready_for_completion: "Ready for Completion",
  completed: "Completed",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
};

export function exportTrainingStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const label = STATUS_LABELS[normalized];
  if (label) return label;

  const text = toExportText(status).replace(/_+/g, " ");
  return text
    ? text.replace(/\b\w/g, (character) => character.toUpperCase())
    : "Unknown";
}

export function matchesTrainingExportScope(
  status: string,
  scope: TrainingExportScope,
) {
  const normalized = status.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return scope === "completed"
    ? normalized === "completed"
    : ACTIVE_STATUSES.has(normalized);
}

const PROGRAM_COLUMNS: ExportColumn[] = [
  { header: "Training Program", width: 24 },
  { header: "Current Classes", width: 16 },
  { header: "Students Enrolled", width: 18 },
  { header: "Ready to Graduate", width: 18 },
  { header: "Completed", width: 13 },
  { header: "Total Enrollments", width: 18 },
];

export function buildTrainingOverviewExport(
  programs: TrainingProgramSummary[],
  scope: "current" | "completed",
): ExportSheet {
  const subject =
    scope === "completed" ? "Completed Training Programs" : "Training Programs";

  return assertExportHasRows(
    createExportSheet({
      subject,
      sheetName: "Training Programs",
      columns: PROGRAM_COLUMNS,
      rows: programs.map((program) => [
        program.name,
        program.activeBatches,
        program.inProgress ?? 0,
        program.readyForGraduation,
        program.completed ?? 0,
        program.totalEnrolled ?? 0,
      ]),
    }),
  );
}

export interface TrainingStudentExportRecord {
  programName: string;
  batchName: string | null;
  trainerName: string | null;
  firstName: string;
  lastName: string;
  gender: string | null;
  status: string;
  enrolledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  withdrawnAt: string | null;
  cancelledAt: string | null;
}

const STUDENT_COLUMNS: ExportColumn[] = [
  { header: "Training Program", width: 24 },
  { header: "Student Name", width: 28 },
  { header: "Gender", width: 16 },
  { header: "Status", width: 22 },
  { header: "Class", width: 26 },
  { header: "Trainer", width: 24 },
  { header: "Enrolled Date", width: 16 },
  { header: "Started Date", width: 16 },
  { header: "Completed Date", width: 16 },
];

export function buildTrainingStudentsExport(
  records: TrainingStudentExportRecord[],
  scope: TrainingExportScope,
): ExportSheet {
  const matching = records
    .filter((record) => matchesTrainingExportScope(record.status, scope))
    .sort((left, right) => {
      const programOrder = left.programName.localeCompare(right.programName, undefined, {
        sensitivity: "base",
      });
      if (programOrder) return programOrder;
      return `${left.lastName} ${left.firstName}`.localeCompare(
        `${right.lastName} ${right.firstName}`,
        undefined,
        { sensitivity: "base" },
      );
    });

  const subject =
    scope === "completed" ? "Completed Training Students" : "Current Training Students";

  return assertExportHasRows(
    createExportSheet({
      subject,
      sheetName: scope === "completed" ? "Completed Students" : "Current Students",
      columns: STUDENT_COLUMNS,
      rows: matching.map((record) => [
        record.programName,
        `${record.firstName} ${record.lastName}`.trim() || "Unnamed student",
        normalizeGenderLabel(record.gender),
        exportTrainingStatusLabel(record.status),
        toExportText(record.batchName),
        toExportText(record.trainerName),
        formatExportDate(record.enrolledAt),
        formatExportDate(record.startedAt),
        formatExportDate(record.completedAt),
      ]),
    }),
  );
}

const BATCH_COLUMNS: ExportColumn[] = [
  { header: "Student Name", width: 28 },
  { header: "Gender", width: 16 },
  { header: "Status", width: 22 },
  { header: "Guide", width: 24 },
  { header: "Enrolled Date", width: 16 },
  { header: "Started Date", width: 16 },
  { header: "Completed Date", width: 16 },
  { header: "Withdrawn Date", width: 16 },
  { header: "Cancelled Date", width: 16 },
];

export interface TrainingBatchRosterInput {
  programName: string;
  batchName: string;
  students: TrainingEnrollment[];
}

export function buildTrainingBatchRosterExport(
  input: TrainingBatchRosterInput,
): ExportSheet {
  const { programName, batchName, students } = input;

  return assertExportHasRows(
    createExportSheet({
      subject: `${programName} ${batchName} Students`,
      sheetName: sanitizeSheetName(batchName, "Training Roster"),
      columns: BATCH_COLUMNS,
      rows: students.map((student) => [
        `${student.firstName} ${student.lastName}`.trim() || "Unnamed student",
        normalizeGenderLabel(student.gender),
        exportTrainingStatusLabel(student.status),
        toExportText(student.guideName),
        formatExportDate(student.enrolledAt),
        formatExportDate(student.startedAt),
        formatExportDate(student.completedAt),
        formatExportDate(student.withdrawnAt),
        formatExportDate(student.cancelledAt),
      ]),
    }),
  );
}
