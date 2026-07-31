import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { getTrainingProgram } from "../../features/training/trainingPrograms";
import {
  getTrainingProgramDetail,
  isCompletedTrainingStatus,
  isInProgressTrainingStatus,
  type TrainingProgramDetail,
  type TrainingEnrollment,
} from "../../features/training/trainingService";

function formatDate(value: string | null) {
  if (!value) return "—";
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
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-olive-100 text-sm font-semibold text-olive-800">
      {initials || "?"}
    </span>
  );
}

export default function TrainingProgram() {
  const { programSlug } = useParams();
  const configuredProgram = getTrainingProgram(programSlug);
  const [detail, setDetail] = useState<TrainingProgramDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    if (!configuredProgram) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void getTrainingProgramDetail(configuredProgram.name)
      .then(setDetail)
      .catch(() =>
        setError("Unable to load this Training program. Please try again."),
      )
      .finally(() => setLoading(false));
  }, [configuredProgram]);

  const statuses = useMemo(
    () =>
      Array.from(
        new Set(detail?.enrollments.map((enrollment) => enrollment.status) ?? []),
      ).sort(),
    [detail],
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (
      detail?.enrollments.filter((enrollment) => {
        const matchesSearch = `${enrollment.firstName} ${enrollment.lastName}`
          .toLowerCase()
          .includes(keyword);
        const matchesStatus =
          statusFilter === "All" || enrollment.status === statusFilter;
        return matchesSearch && matchesStatus;
      }) ?? []
    );
  }, [detail, search, statusFilter]);

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
      <div className="py-16 text-center">
        <p className="text-red-600">{error}</p>
        <Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  const completed = detail.enrollments.filter((item) =>
    isCompletedTrainingStatus(item.status),
  ).length;
  const inProgress = detail.enrollments.filter((item) =>
    isInProgressTrainingStatus(item.status),
  ).length;

  return (
    <div className="space-y-8">
      <header>
        <Link to="/admin/training" className="text-sm font-medium text-olive-700 hover:underline">
          ← Back to Training
        </Link>
        <h1 className="mt-4 text-3xl font-bold">{detail.name}</h1>
        <p className="mt-2 text-slate-600">
          View enrolled members and their Training progress.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Total enrolled", detail.enrollments.length],
          ["Completed", completed],
          ["In progress", inProgress],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search enrolled members..."
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>All</option>
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </Select>
        </div>

        {filtered.length === 0 ? (
          <p className="py-14 text-center text-slate-500">
            {detail.enrollments.length === 0
              ? "No members are enrolled in this program."
              : "No enrolled members match your filters."}
          </p>
        ) : (
          <>
            <div className="mt-5 hidden overflow-hidden rounded-xl border border-slate-200 md:block">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">Member</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date enrolled</th>
                    <th className="p-3">Completion date</th>
                    <th className="w-32 p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((enrollment) => (
                    <tr key={enrollment.id} className="border-t border-slate-100">
                      <td className="p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar enrollment={enrollment} />
                          <span className="break-words font-medium">
                            {enrollment.firstName} {enrollment.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">{enrollment.status}</td>
                      <td className="p-3">{formatDate(enrollment.enrolledAt)}</td>
                      <td className="p-3">{formatDate(enrollment.completedAt)}</td>
                      <td className="p-3 text-right">
                        <Button
                          to={`/admin/members/${enrollment.memberId}`}
                          variant="secondary"
                        >
                          View Member
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 space-y-3 md:hidden">
              {filtered.map((enrollment) => (
                <article key={enrollment.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar enrollment={enrollment} />
                    <div>
                      <h2 className="font-semibold">
                        {enrollment.firstName} {enrollment.lastName}
                      </h2>
                      <p className="text-sm text-slate-500">{enrollment.status}</p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Date enrolled</dt>
                      <dd>{formatDate(enrollment.enrolledAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Completion date</dt>
                      <dd>{formatDate(enrollment.completedAt)}</dd>
                    </div>
                  </dl>
                  <Button
                    to={`/admin/members/${enrollment.memberId}`}
                    variant="secondary"
                    className="mt-4 w-full"
                  >
                    View Member
                  </Button>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
