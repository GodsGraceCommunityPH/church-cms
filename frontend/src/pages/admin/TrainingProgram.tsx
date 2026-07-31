import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useAuth } from "../../features/auth/auth";
import { getTrainingProgram } from "../../features/training/trainingPrograms";
import {
  getTrainingProgramDetail,
  createTrainingBatch,
  trainingErrorMessage,
  trainingStatusLabel,
  updateEnrollmentStatus,
  type TrainingEnrollment,
  type TrainingProgramDetail,
} from "../../features/training/trainingService";

type Section = "active" | "pending" | "completed" | "closed";

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: "active", label: "Active Training" },
  { id: "pending", label: "Pending Enrollment" },
  { id: "completed", label: "Completed" },
  { id: "closed", label: "Withdrawn / Cancelled" },
];

function sectionFor(enrollment: TrainingEnrollment): Section {
  if (enrollment.status === "pending_enrollment") return "pending";
  if (enrollment.status === "completed") return "completed";
  if (["withdrawn", "cancelled"].includes(enrollment.status)) return "closed";
  return "active";
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function Avatar({ enrollment }: { enrollment: TrainingEnrollment }) {
  const initials =
    `${enrollment.firstName.charAt(0)}${enrollment.lastName.charAt(0)}`.toUpperCase();
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive-100 text-sm font-semibold text-olive-800">
      {initials || "?"}
    </span>
  );
}

export default function TrainingProgram() {
  const { programSlug } = useParams();
  const configuredProgram = getTrainingProgram(programSlug);
  const { hasPermission } = useAuth();
  const [detail, setDetail] = useState<TrainingProgramDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<Section>("active");
  const [newBatchName, setNewBatchName] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const canManage = hasPermission("training.enroll");

  const load = useCallback(() => {
    if (!configuredProgram) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void getTrainingProgramDetail(configuredProgram.name)
      .then(setDetail)
      .catch((reason: unknown) =>
        setError(trainingErrorMessage(reason)),
      )
      .finally(() => setLoading(false));
  }, [configuredProgram]);

  useEffect(() => {
    load();
  }, [load]);

  const sectionCounts = useMemo(() => {
    const counts: Record<Section, number> = {
      active: 0,
      pending: 0,
      completed: 0,
      closed: 0,
    };
    detail?.enrollments.forEach((item) => {
      counts[sectionFor(item)] += 1;
    });
    return counts;
  }, [detail]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (
      detail?.enrollments.filter(
        (enrollment) =>
          sectionFor(enrollment) === section &&
          `${enrollment.firstName} ${enrollment.lastName}`
            .toLowerCase()
            .includes(keyword),
      ) ?? []
    );
  }, [detail, search, section]);

  if (!configuredProgram) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold">Training program not found</h1>
        <Link to="/admin/training" className="mt-4 inline-block text-olive-700 underline">
          Back to Training
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="py-16 text-center text-slate-500">Loading program...</p>;
  }

  if (error || !detail) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white py-16 text-center">
        <p className="text-red-600">{error}</p>
        <Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link to="/admin/training" className="text-sm font-medium text-olive-700 hover:underline">
          ← Back to Training
        </Link>
        <h1 className="mt-4 text-3xl font-bold">{detail.name}</h1>
        <p className="mt-2 text-slate-600">
          Manage active learners and preserve the complete program history.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto border-b border-slate-200">
          <div className="flex min-w-max p-2" role="tablist" aria-label="Training workflow">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={section === item.id}
                onClick={() => setSection(item.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  section === item.id
                    ? "bg-olive-700 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label} ({sectionCounts[item.id]})
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {success && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{success}</p>}
          {canManage && (
            <form
              className="mb-4 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                if (!newBatchName.trim()) return;
                setSaving(true);
                setError("");
                void createTrainingBatch(detail.id, newBatchName.trim())
                  .then(() => {
                    setNewBatchName("");
                    setSuccess("Class or batch created.");
                    load();
                  })
                  .catch((reason: unknown) =>
                    setError(trainingErrorMessage(reason)),
                  )
                  .finally(() => setSaving(false));
              }}
            >
              <Input
                value={newBatchName}
                onChange={(event) => setNewBatchName(event.target.value)}
                placeholder="New class or batch name"
              />
              <Button type="submit" disabled={saving || !newBatchName.trim()}>
                Create Batch
              </Button>
            </form>
          )}
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${SECTIONS.find((item) => item.id === section)?.label.toLowerCase()}...`}
          />

          {filtered.length === 0 ? (
            <p className="py-14 text-center text-slate-500">
              No members appear in this section.
            </p>
          ) : (
            <>
              <div className="mt-4 hidden overflow-hidden rounded-xl border border-slate-200 md:block">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3">Member</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Batch / Trainer</th>
                      <th className="p-3">Enrollment</th>
                      <th className="w-40 p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((enrollment) => (
                      <tr key={enrollment.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="p-3">
                          <Link
                            to={`/admin/training/${programSlug}/members/${enrollment.id}`}
                            className="flex min-w-0 items-center gap-3 font-medium hover:text-olive-700"
                          >
                            <Avatar enrollment={enrollment} />
                            <span className="break-words">
                              {enrollment.firstName} {enrollment.lastName}
                            </span>
                          </Link>
                        </td>
                        <td className="p-3">{trainingStatusLabel(enrollment.status)}</td>
                        <td className="p-3">
                          <p>{enrollment.batchName ?? "Not recorded"}</p>
                          <p className="text-xs text-slate-500">
                            {enrollment.trainerName ?? "Trainer not recorded"}
                          </p>
                        </td>
                        <td className="p-3">{formatDate(enrollment.enrolledAt)}</td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-2">
                            {canManage && section === "pending" && (
                              <Button
                                disabled={saving}
                                onClick={() => {
                                  setSaving(true);
                                  void updateEnrollmentStatus(enrollment.id, "in_progress")
                                    .then(() => {
                                      setSuccess("Training started.");
                                      load();
                                    })
                                    .catch((reason: unknown) =>
                                      setError(trainingErrorMessage(reason)),
                                    )
                                    .finally(() => setSaving(false));
                                }}
                              >
                                Start
                              </Button>
                            )}
                            <Button
                              to={`/admin/training/${programSlug}/members/${enrollment.id}`}
                              variant="secondary"
                            >
                              Training Profile
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-3 md:hidden">
                {filtered.map((enrollment) => (
                  <article key={enrollment.id} className="rounded-xl border border-slate-200 p-4">
                    <Link
                      to={`/admin/training/${programSlug}/members/${enrollment.id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar enrollment={enrollment} />
                      <div className="min-w-0">
                        <h2 className="break-words font-semibold">
                          {enrollment.firstName} {enrollment.lastName}
                        </h2>
                        <p className="text-sm text-slate-500">
                          {trainingStatusLabel(enrollment.status)}
                        </p>
                      </div>
                    </Link>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-slate-500">Batch</dt>
                        <dd>{enrollment.batchName ?? "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Trainer</dt>
                        <dd>{enrollment.trainerName ?? "Not recorded"}</dd>
                      </div>
                    </dl>
                    <Button
                      to={`/admin/training/${programSlug}/members/${enrollment.id}`}
                      variant="secondary"
                      className="mt-4 w-full"
                    >
                      Open Training Profile
                    </Button>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
