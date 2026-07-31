import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Modal from "../../components/Modal";
import PrimaryButton from "../../components/PrimaryButton";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import type { CellGroup } from "../../features/cellGroups/cellGroup";
import {
  deleteCellGroup,
  getCellGroups,
} from "../../features/cellGroups/cellGroupService";

export default function CellGroups() {
  const navigate = useNavigate();
  const [cellGroups, setCellGroups] = useState<CellGroup[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupToDelete, setGroupToDelete] = useState<CellGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredCellGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return cellGroups.filter(
      (group) => !keyword || group.name.toLowerCase().includes(keyword),
    );
  }, [cellGroups, search]);

  useEffect(() => {
    void loadCellGroups();
  }, []);

  async function loadCellGroups() {
    setLoading(true);
    setError("");

    try {
      setCellGroups(await getCellGroups());
    } catch {
      setError("Unable to load cell groups. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!groupToDelete || groupToDelete.memberCount > 0) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteCellGroup(groupToDelete.id);
      setGroupToDelete(null);
      await loadCellGroups();
      setSuccessMessage("Cell group deleted successfully.");
    } catch {
      setDeleteError("Unable to delete this cell group. Please try again.");
    } finally {
      setIsDeleting(false);
    }
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
            Cell Groups
          </h1>
          <p className="text-slate-600" style={{ margin: "8px 0 0" }}>
            Manage church cell groups.
          </p>
        </div>
        <PrimaryButton to="/admin/cell-groups/new" className="shrink-0">
          Add Cell Group
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
              className="font-medium underline"
              onClick={() => setSuccessMessage("")}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="mb-8" style={{ marginBottom: "32px" }}>
          <Input
            placeholder="Search cell groups..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <p
            className="py-12 text-center text-slate-500"
            style={{
              margin: 0,
              padding: "48px 16px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            Loading cell groups...
          </p>
        ) : error ? (
          <div
            className="py-12 text-center"
            style={{ padding: "48px 16px", textAlign: "center" }}
          >
            <p className="text-red-600" style={{ margin: 0, color: "#dc2626" }}>
              {error}
            </p>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => void loadCellGroups()}
            >
              Try again
            </Button>
          </div>
        ) : filteredCellGroups.length === 0 ? (
          <div
            className="py-16 text-center"
            style={{ padding: "64px 16px", textAlign: "center" }}
          >
            <h2 className="text-xl font-semibold" style={{ margin: 0, fontSize: "20px" }}>
              No cell groups found
            </h2>
            <p
              className="mt-2 text-slate-500"
              style={{ margin: "8px 0 0", color: "#64748b" }}
            >
              {cellGroups.length === 0
                ? "Add the first church cell group."
                : "Try adjusting the search."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCellGroups.map((group) => (
              <div
                key={group.id}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "12px",
                  cursor: "pointer",
                }}
                onClick={() => navigate(`/admin/cell-groups/${group.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/admin/cell-groups/${group.id}`);
                  }
                }}
              >
                <div className="min-w-0">
                  <h2
                    className="break-words text-base font-semibold text-slate-900"
                    style={{ margin: 0, overflowWrap: "anywhere" }}
                  >
                    {group.name}
                  </h2>
                  <p
                    className="mt-1 flex items-center gap-1 text-sm text-slate-500"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      margin: "4px 0 0",
                    }}
                  >
                    <Users size={14} aria-hidden="true" />
                    {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="danger"
                  disabled={group.memberCount > 0}
                  title={
                    group.memberCount > 0
                      ? "Transfer or remove assigned members before deleting."
                      : `Delete ${group.name}`
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteError("");
                    setGroupToDelete(group);
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={groupToDelete !== null}
        title="Delete Cell Group"
        onClose={() => {
          if (!isDeleting) {
            setGroupToDelete(null);
            setDeleteError("");
          }
        }}
      >
        <p className="mb-3">
          Delete <strong>{groupToDelete?.name}</strong>?
        </p>
        <p className="mb-6 text-sm text-slate-500">
          This permanently removes the empty cell group.
        </p>
        {deleteError && <p className="mb-4 text-sm text-red-600">{deleteError}</p>}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={isDeleting}
            onClick={() => setGroupToDelete(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={isDeleting}
            onClick={() => void handleDelete()}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
