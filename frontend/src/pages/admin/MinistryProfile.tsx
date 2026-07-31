import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, UserRound } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Modal from "../../components/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import type {
  Ministry,
  MinistryMember,
  MinistryRole,
  MinistryStatus,
} from "../../features/ministries/ministry";
import {
  addMinistryMember,
  deleteMinistry,
  getAssignableMembers,
  getMinistry,
  removeMinistryMember,
} from "../../features/ministries/ministryService";

interface AvailableMember {
  id: string;
  first_name: string;
  last_name: string;
  membership_status: string;
}

export default function MinistryProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [ministry, setMinistry] = useState<Ministry | null>(null);
  const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] =
    useState<MinistryMember | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [role, setRole] = useState<MinistryRole>("Member");
  const [dateJoined, setDateJoined] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [assignmentStatus, setAssignmentStatus] =
    useState<MinistryStatus>("Active");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState(
    () => location.state?.successMessage ?? "",
  );

  const loadMinistry = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setMinistry(await getMinistry(id));
    } catch {
      setError("Unable to load this ministry.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadMinistry();
  }, [loadMinistry]);

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (
      ministry?.members.filter((member) =>
        `${member.firstName} ${member.lastName} ${member.role}`
          .toLowerCase()
          .includes(keyword),
      ) ?? []
    );
  }, [ministry, search]);

  async function openAddMember() {
    setActionError("");
    try {
      const members = (await getAssignableMembers()) as AvailableMember[];
      const assignedIds = new Set(
        ministry?.members.map((member) => member.memberId) ?? [],
      );
      setAvailableMembers(
        members.filter((member) => !assignedIds.has(member.id)),
      );
      setAddOpen(true);
    } catch {
      setActionError("Unable to load available members.");
    }
  }

  async function handleAddMember(event: React.FormEvent) {
    event.preventDefault();
    if (!id || !selectedMemberId) return;
    setSaving(true);
    setActionError("");
    try {
      await addMinistryMember({
        ministryId: id,
        memberId: selectedMemberId,
        role,
        dateJoined,
        status: assignmentStatus,
      });
      setAddOpen(false);
      setSelectedMemberId("");
      setRole("Member");
      await loadMinistry();
      setSuccessMessage("Member added to ministry.");
    } catch {
      setActionError("Unable to add this member.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveMember() {
    if (!memberToRemove) return;
    setSaving(true);
    setActionError("");
    try {
      await removeMinistryMember(memberToRemove.id);
      setMemberToRemove(null);
      await loadMinistry();
      setSuccessMessage("Member removed from ministry.");
    } catch {
      setActionError("Unable to remove this ministry assignment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!ministry) return;
    setSaving(true);
    setActionError("");
    try {
      await deleteMinistry(ministry);
      navigate("/admin/ministries");
    } catch {
      setActionError("Unable to delete this ministry.");
      setSaving(false);
    }
  }

  if (loading) return <p className="py-12 text-center">Loading ministry...</p>;
  if (error || !ministry) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600">{error || "Ministry not found."}</p>
        <Button className="mt-4" variant="secondary" onClick={() => void loadMinistry()}>
          Try again
        </Button>
      </div>
    );
  }

  const leader = ministry.members.find(
    (member) => member.role === "Leader" && member.status === "Active",
  );
  const assistant = ministry.members.find(
    (member) => member.role === "Assistant Leader" && member.status === "Active",
  );

  return (
    <div className="space-y-8">
      {successMessage && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{successMessage}</span>
          <button className="underline" onClick={() => setSuccessMessage("")}>
            Dismiss
          </button>
        </div>
      )}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-6 sm:flex-row">
          {ministry.pictureUrl ? (
            <img
              src={ministry.pictureUrl}
              alt=""
              className="h-36 w-36 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Image size={36} aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="break-words text-3xl font-bold">{ministry.name}</h1>
                <p className="mt-2 text-slate-600">
                  {ministry.description || "No description"}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">
                {ministry.status}
              </span>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-slate-500">Ministry Leader</dt>
                <dd className="font-medium">
                  {leader ? `${leader.firstName} ${leader.lastName}` : "Not assigned"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Assistant Leader</dt>
                <dd className="font-medium">
                  {assistant
                    ? `${assistant.firstName} ${assistant.lastName}`
                    : "Not assigned"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Member Count</dt>
                <dd className="font-medium">{ministry.members.length}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={() => navigate(`/admin/ministries/${ministry.id}/edit`)}
              >
                Edit Ministry
              </Button>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                Delete Ministry
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Members</h2>
            <p className="text-sm text-slate-500">
              Removing an assignment never deletes the church member.
            </p>
          </div>
          <Button onClick={() => void openAddMember()}>Add existing member</Button>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ministry members..."
        />
        <div className="mt-5 space-y-3">
          {filteredMembers.length === 0 ? (
            <p className="py-10 text-center text-slate-500">
              {ministry.members.length === 0
                ? "No members assigned to this ministry."
                : "No ministry members match your search."}
            </p>
          ) : (
            filteredMembers.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <UserRound size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-sm text-slate-500">
                      {member.role} · {member.status}
                    </p>
                  </div>
                </div>
                <Button
                  variant="danger"
                  onClick={() => setMemberToRemove(member)}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      <Modal open={addOpen} title="Add Ministry Member" onClose={() => !saving && setAddOpen(false)}>
        <form className="space-y-4" onSubmit={handleAddMember}>
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Member</span>
            <Select
              required
              value={selectedMemberId}
              onChange={(event) => setSelectedMemberId(event.target.value)}
            >
              <option value="">Select a member</option>
              {availableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.first_name} {member.last_name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Role</span>
            <Select
              value={role}
              onChange={(event) => setRole(event.target.value as MinistryRole)}
            >
              <option>Leader</option>
              <option>Assistant Leader</option>
              <option>Member</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Date joined</span>
            <Input
              type="date"
              required
              value={dateJoined}
              onChange={(event) => setDateJoined(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Status</span>
            <Select
              value={assignmentStatus}
              onChange={(event) =>
                setAssignmentStatus(event.target.value as MinistryStatus)
              }
            >
              <option>Active</option>
              <option>Inactive</option>
            </Select>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !selectedMemberId}>
              {saving ? "Adding..." : "Add Member"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={memberToRemove !== null}
        title="Remove Ministry Member"
        onClose={() => !saving && setMemberToRemove(null)}
      >
        <p>
          Remove <strong>{memberToRemove?.firstName} {memberToRemove?.lastName}</strong>{" "}
          from {ministry.name}? Their church member record will remain unchanged.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" disabled={saving} onClick={() => setMemberToRemove(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={saving} onClick={() => void handleRemoveMember()}>
            {saving ? "Removing..." : "Remove"}
          </Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} title="Delete Ministry" onClose={() => !saving && setDeleteOpen(false)}>
        <p>
          Delete <strong>{ministry.name}</strong>? Ministry assignments will be
          removed, but church member records will not be deleted.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" disabled={saving} onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={saving} onClick={() => void handleDelete()}>
            {saving ? "Deleting..." : "Delete Ministry"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
