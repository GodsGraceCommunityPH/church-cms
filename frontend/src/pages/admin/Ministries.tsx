import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PrimaryButton from "../../components/PrimaryButton";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import type { Ministry } from "../../features/ministries/ministry";
import { getMinistries } from "../../features/ministries/ministryService";

export default function Ministries() {
  const navigate = useNavigate();
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMinistries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMinistries(await getMinistries());
    } catch {
      setError("Unable to load ministries. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMinistries();
  }, [loadMinistries]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return ministries.filter(
      (ministry) =>
        !keyword ||
        ministry.name.toLowerCase().includes(keyword) ||
        ministry.description.toLowerCase().includes(keyword),
    );
  }, [ministries, search]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ margin: 0 }}>
            Ministries
          </h1>
          <p className="mt-2 text-slate-600">
            Manage ministry teams and member service assignments.
          </p>
        </div>
        <PrimaryButton to="/admin/ministries/new">Add Ministry</PrimaryButton>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-6">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ministries..."
          />
        </div>

        {loading ? (
          <p className="py-12 text-center text-slate-500">Loading ministries...</p>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600">{error}</p>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => void loadMinistries()}
            >
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <h2 className="text-xl font-semibold">No ministries found</h2>
            <p className="mt-2 text-slate-500">
              {ministries.length === 0
                ? "Add the first ministry."
                : "Try adjusting the search."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((ministry) => {
              const leader = ministry.members.find(
                (member) => member.role === "Leader" && member.status === "Active",
              );
              return (
                <article
                  key={ministry.id}
                  className="flex min-w-0 cursor-pointer gap-4 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50"
                  onClick={() => navigate(`/admin/ministries/${ministry.id}`)}
                >
                  {ministry.pictureUrl ? (
                    <img
                      src={ministry.pictureUrl}
                      alt=""
                      className="h-24 w-24 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <Image aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="break-words text-lg font-semibold">
                        {ministry.name}
                      </h2>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          ministry.status === "Active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {ministry.status}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {ministry.description || "No description"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Leader:{" "}
                      {leader
                        ? `${leader.firstName} ${leader.lastName}`
                        : "Not assigned"}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1 text-sm text-slate-500">
                        <Users size={14} aria-hidden="true" />
                        {ministry.members.length}{" "}
                        {ministry.members.length === 1 ? "member" : "members"}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/admin/ministries/${ministry.id}`);
                        }}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
