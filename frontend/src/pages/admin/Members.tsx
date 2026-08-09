import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import PrimaryButton from "../../components/PrimaryButton";
import Button from "../../components/ui/Button";
import MemberSearch from "../../features/members/MemberSearch";
import MemberTable from "../../features/members/MemberTable";
import { useMembers } from "../../features/members/useMembers";
import Select from "../../components/ui/Select";
import { getCellGroups } from "../../features/cellGroups/cellGroupService";
import type { CellGroup } from "../../features/cellGroups/cellGroup";

function Members() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { members, loading, error, loadMembers } = useMembers();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [cellGroups, setCellGroups] = useState<CellGroup[]>([]);
  const [successMessage, setSuccessMessage] = useState(
    () => location.state?.successMessage ?? "",
  );

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return members.filter((member) => {
      const genderFilter = searchParams.get("gender");
      const cellGroupFilter = searchParams.get("cellGroup");
      const matchesSearch =
        !keyword ||
        member.firstName.toLowerCase().includes(keyword) ||
        member.lastName.toLowerCase().includes(keyword) ||
        member.nickname.toLowerCase().includes(keyword);
      const normalizedGender = member.gender.trim().toLowerCase();
      const matchesGender = !genderFilter ||
        (genderFilter === "unknown" ? !["male", "female"].includes(normalizedGender) : normalizedGender === genderFilter);
      const matchesCellGroup = !cellGroupFilter ||
        (cellGroupFilter === "unassigned" ? !member.cellGroupId : member.cellGroupId === cellGroupFilter);
      return matchesSearch && matchesGender && matchesCellGroup;
    }).sort((left, right) => {
      const leftName = `${left.firstName} ${left.lastName}`.trim();
      const rightName = `${right.firstName} ${right.lastName}`.trim();
      return leftName.localeCompare(rightName, undefined, { sensitivity: "base" }) * (sortOrder === "asc" ? 1 : -1);
    });
  }, [members, search, searchParams, sortOrder]);

  useEffect(() => {
    let active = true;
    void getCellGroups().then((groups) => {
      if (active) setCellGroups(groups);
    }).catch(() => {
      if (active) setCellGroups([]);
    });
    return () => { active = false; };
  }, []);

  const genderFilter = searchParams.get("gender") ?? "all";
  const cellGroupFilter = searchParams.get("cellGroup") ?? "all";
  const hasActiveFilters = sortOrder !== "asc" || genderFilter !== "all" || cellGroupFilter !== "all";

  function updateFilter(name: "gender" | "cellGroup", value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete(name);
    else next.set(name, value);
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setSortOrder("asc");
    const next = new URLSearchParams(searchParams);
    next.delete("gender");
    next.delete("cellGroup");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="space-y-8">
      <div
        className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "24px",
          margin: "8px 0 32px",
        }}
      >
        <div>
          <h1 className="text-3xl font-bold" style={{ fontSize: "30px", margin: 0 }}>
            Members
          </h1>
          <p className="text-slate-600" style={{ margin: "8px 0 0" }}>
            Manage people known by the church.
          </p>
        </div>
        <PrimaryButton
          to="/admin/members/new"
          className="shrink-0"
        >
          Add Member
        </PrimaryButton>
      </div>

      <section
        className="rounded-2xl border border-slate-200 bg-white"
        style={{
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "14px",
          margin: 0,
        }}
      >
        {successMessage && (
          <div
            className="mb-5 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "20px",
              border: "1px solid #a7f3d0",
              borderRadius: "8px",
              background: "#ecfdf5",
              padding: "12px 16px",
              color: "#065f46",
            }}
          >
            <p style={{ margin: 0 }}>{successMessage}</p>
            <button
              type="button"
              onClick={() => setSuccessMessage("")}
              className="font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="mb-8" style={{ marginBottom: "32px" }}>
          <MemberSearch value={search} onChange={setSearch} />
          <div className="list-filter-controls">
            <label><span>Sort</span><Select aria-label="Sort members" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "asc" | "desc")}><option value="asc">A–Z</option><option value="desc">Z–A</option></Select></label>
            <label><span>Gender</span><Select aria-label="Filter members by gender" value={genderFilter} onChange={(event) => updateFilter("gender", event.target.value)}><option value="all">All</option><option value="male">Male</option><option value="female">Female</option><option value="unknown">Unknown / Not Set</option></Select></label>
            <label><span>Cell Group</span><Select aria-label="Filter members by Cell Group" value={cellGroupFilter} onChange={(event) => updateFilter("cellGroup", event.target.value)}><option value="all">All Cell Groups</option>{cellGroups.filter((group) => group.status?.trim().toLowerCase() !== "inactive").map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}<option value="unassigned">No Cell Group / Unassigned</option></Select></label>
            {hasActiveFilters && <button type="button" className="list-clear-filters" onClick={clearFilters}>Clear Filters</button>}
          </div>
        </div>

        {loading ? (
          <p className="py-12 text-center text-slate-500" style={{ margin: 0, padding: "48px 16px", textAlign: "center", color: "#64748b" }}>Loading members...</p>
        ) : error ? (
          <div className="py-12 text-center" style={{ padding: "48px 16px", textAlign: "center" }}>
            <p className="text-red-600" style={{ margin: 0, color: "#dc2626" }}>{error}</p>
            <Button className="mt-4" variant="secondary" onClick={() => void loadMembers()}>
              Try again
            </Button>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-16 text-center" style={{ padding: "64px 16px", textAlign: "center" }}>
            <h2 className="text-xl font-semibold" style={{ margin: 0, fontSize: "20px" }}>No members found</h2>
            <p className="mt-2 text-slate-500" style={{ margin: "8px 0 0", color: "#64748b" }}>
              {members.length === 0
                ? "Add the first person known by the church."
                : "Try adjusting the search."}
            </p>
          </div>
        ) : (
          <MemberTable
            members={filteredMembers}
            onOpen={(id) => navigate(`/admin/members/${id}`)}
          />
        )}
      </section>

    </div>
  );
}

export default Members;
