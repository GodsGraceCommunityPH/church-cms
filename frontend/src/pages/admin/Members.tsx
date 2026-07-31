import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PrimaryButton from "../../components/PrimaryButton";
import Button from "../../components/ui/Button";
import Modal from "../../components/Modal";
import MemberSearch from "../../features/members/MemberSearch";
import MemberTable from "../../features/members/MemberTable";
import type { Member } from "../../features/members/member";
import { deactivateMember } from "../../features/members/memberService";
import { useMembers } from "../../features/members/useMembers";

function Members() {
  const navigate = useNavigate();
  const location = useLocation();
  const { members, loading, error, loadMembers } = useMembers();
  const [search, setSearch] = useState("");
  const [memberToDeactivate, setMemberToDeactivate] = useState<Member | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState(
    () => location.state?.successMessage ?? "",
  );

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
        !keyword ||
        member.firstName.toLowerCase().includes(keyword) ||
        member.lastName.toLowerCase().includes(keyword) ||
        member.nickname.toLowerCase().includes(keyword);
      return matchesSearch;
    });
  }, [members, search]);

  async function handleDeactivate() {
    if (!memberToDeactivate) return;

    setIsSaving(true);
    setActionError("");

    try {
      await deactivateMember(memberToDeactivate.id);
      setMemberToDeactivate(null);
      await loadMembers();
      setSuccessMessage("Member archived successfully.");
    } catch {
      setActionError("Unable to deactivate this member. Please try again.");
    } finally {
      setIsSaving(false);
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
          gap: "24px",
          margin: "8px 24px 32px",
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
          style={{ marginRight: "24px" }}
        >
          Add Member
        </PrimaryButton>
      </div>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-6"
        style={{
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "24px",
          margin: "0 24px",
        }}
      >
        {successMessage && (
          <div className="mb-5 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p>{successMessage}</p>
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
        </div>

        {loading ? (
          <p className="py-12 text-center text-slate-500">Loading members...</p>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600">{error}</p>
            <Button className="mt-4" variant="secondary" onClick={() => void loadMembers()}>
              Try again
            </Button>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-16 text-center">
            <h2 className="text-xl font-semibold">No members found</h2>
            <p className="mt-2 text-slate-500">
              {members.length === 0
                ? "Add the first person known by the church."
                : "Try adjusting the search."}
            </p>
          </div>
        ) : (
          <MemberTable
            members={filteredMembers}
            onOpen={(id) => navigate(`/admin/members/${id}`)}
            onDeactivate={setMemberToDeactivate}
          />
        )}
      </section>

      <Modal
        open={memberToDeactivate !== null}
        title="Deactivate Member"
        onClose={() => {
          if (!isSaving) {
            setMemberToDeactivate(null);
            setActionError("");
          }
        }}
      >
        <p className="mb-3">
          Deactivate <strong>{memberToDeactivate?.firstName} {memberToDeactivate?.lastName}</strong>?
        </p>
        <p className="mb-6 text-sm text-slate-500">
          Their record and related history will be kept for reporting.
        </p>
        {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" disabled={isSaving} onClick={() => setMemberToDeactivate(null)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={isSaving} onClick={() => void handleDeactivate()}>
            {isSaving ? "Deactivating..." : "Deactivate"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default Members;
