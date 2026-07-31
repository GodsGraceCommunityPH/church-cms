import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PrimaryButton from "../../components/PrimaryButton";
import Button from "../../components/ui/Button";
import Modal from "../../components/Modal";
import MemberFilters from "../../features/members/MemberFilters";
import MemberSearch from "../../features/members/MemberSearch";
import MemberTable from "../../features/members/MemberTable";
import type { Member } from "../../features/members/member";
import { deactivateMember } from "../../features/members/memberService";
import { useMembers } from "../../features/members/useMembers";

function Members() {
  const navigate = useNavigate();
  const { members, loading, error, loadMembers } = useMembers();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [memberToDeactivate, setMemberToDeactivate] = useState<Member | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
        !keyword ||
        member.firstName.toLowerCase().includes(keyword) ||
        member.lastName.toLowerCase().includes(keyword) ||
        member.nickname.toLowerCase().includes(keyword);
      const matchesStatus = !status || member.membershipStatus === status;

      return matchesSearch && matchesStatus;
    });
  }, [members, search, status]);

  async function handleDeactivate() {
    if (!memberToDeactivate) return;

    setIsSaving(true);
    setActionError("");

    try {
      await deactivateMember(memberToDeactivate.id);
      setMemberToDeactivate(null);
      await loadMembers();
    } catch {
      setActionError("Unable to deactivate this member. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-slate-600">Manage people known by the church.</p>
        </div>
        <PrimaryButton to="/admin/members/new">Add Member</PrimaryButton>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <MemberSearch value={search} onChange={setSearch} />
          <MemberFilters value={status} onChange={setStatus} />
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
                : "Try adjusting the search or status filter."}
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
