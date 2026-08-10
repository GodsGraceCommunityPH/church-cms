import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

import type { CellGroup } from "../../features/cellGroups/cellGroup";
import { mapCellGroup } from "../../features/cellGroups/cellGroupMapper";
import InviteLinkModal from "./InviteLinkModal";
import Modal from "../../components/Modal";

import ProfileCard from "../../components/profile/ProfileCard";
import InfoRow from "../../components/profile/InfoRow";

import TransferMemberModal from "../../components/TransferMemberModal";
import RemoveMemberModal from "../../components/RemoveMemberModal";

import {
  getInvite,
  createInvite,
} from "../../features/cellGroups/cellGroupInviteService";

import { generateInviteToken } from "../../features/cellGroups/cellGroupUtils";

import Button from "../../components/ui/Button";
import { useAuth } from "../../features/auth/auth";

export default function CellGroupProfile() {
  const { id } = useParams();
  const { hasPermission } = useAuth();

  const navigate = useNavigate();

  const [group, setGroup] = useState<CellGroup | null>(null);
  const [loading, setLoading] = useState(true);

  const [inviteLink, setInviteLink] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const [cellGroups, setCellGroups] = useState<any[]>([]);

  useEffect(() => {
    loadGroup();
    loadMembers();
    loadCellGroups();
  }, []);

  async function loadCellGroups() {
    const { data, error } = await supabase
      .from("cell_groups")
      .select("*")
      .neq("id", id)
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setCellGroups(data ?? []);
  }

  async function loadGroup() {
    const { data, error } = await supabase
      .from("cell_groups")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
    } else {
      setGroup(mapCellGroup(data));
    }

    setLoading(false);
  }

  async function loadMembers() {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("cell_group_id", id)
      .order("last_name");

    if (error) {
      console.error(error);
      return;
    }

    setMembers(data ?? []);
  }

  if (loading) return <p>Loading...</p>;

  if (!group) return <p>Cell Group not found.</p>;

  async function deleteCellGroup() {
    const { error } = await supabase.from("cell_groups").delete().eq("id", id);

    if (error) {
      console.error(error);
      alert("Unable to delete the cell group.");
      return;
    }

    navigate("/admin/cell-groups");
  }

  async function handleInvite(cellGroupId: string, slug?: string) {
    // Check if an invite already exists
    const { data: invite } = await getInvite(cellGroupId);

    if (invite) {
      const identifier = slug?.trim() || invite.token;
      const link = `${window.location.origin}/join/${identifier}`;

      setInviteLink(link);
      setShowInviteModal(true);
      return;
    }

    // Create a new invite
    const token = generateInviteToken();

    const { error } = await createInvite(cellGroupId, token);

    if (error) {
      console.error(error);
      alert("Failed to create invite.");
      return;
    }

    const identifier = slug?.trim() || token;
    const link = `${window.location.origin}/join/${identifier}`;

    setInviteLink(link);
    setShowInviteModal(true);
  }

  return (
    <div style={{ padding: 30, maxWidth: 900, margin: "0 auto" }}>
      <button onClick={() => navigate("/admin/cell-groups")}>← Back</button>

      <h1>{group.name}</h1>

      <ProfileCard title="Information">
        <InfoRow label="Status" value={group.status} />
        <div>
          <InfoRow label="Description" value={group.description} />
        </div>

        <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
          <Button
            type="button"
            onClick={() => navigate(`/admin/cell-groups/${id}/edit`)}
          >
            Edit
          </Button>

          <Button
            type="button"
            disabled={members.length > 0}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </Button>

          <Button type="button" onClick={() => handleInvite(group.id, group.slug)}>
            Invite Members
          </Button>

          <InviteLinkModal
            open={showInviteModal}
            link={inviteLink}
            groupName={group.name}
            onClose={() => setShowInviteModal(false)}
          />
        </div>

        <p style={{ marginTop: 12, color: "#64748b", fontSize: 14 }}>
          Share this registration link with members of this Cell Group so they can register their information.
        </p>

        {members.length > 0 && (
          <p
            style={{
              marginTop: "12px",
              color: "#dc2626",
              fontSize: "14px",
            }}
          >
            This cell group cannot be deleted while it has{" "}
            <strong>{members.length}</strong>{" "}
            {members.length === 1 ? "member" : "members"} assigned. Transfer or
            remove them first.
          </p>
        )}
      </ProfileCard>
      <ProfileCard title={`Members (${members.length})`}>
        {members.length === 0 ? (
          <p>No members assigned to this cell group.</p>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                {hasPermission("members.view") ? (
                  <Link
                    to={`/admin/members/${member.id}`}
                    aria-label={`Open member profile for ${member.first_name} ${member.last_name}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      minHeight: "44px",
                      margin: "-8px 0 -4px",
                      color: "#172033",
                      fontWeight: 600,
                      overflowWrap: "anywhere",
                      textDecoration: "underline",
                      textDecorationColor: "transparent",
                      textUnderlineOffset: "3px",
                    }}
                    onMouseEnter={(event) => { event.currentTarget.style.textDecorationColor = "#526a28"; }}
                    onMouseLeave={(event) => { event.currentTarget.style.textDecorationColor = "transparent"; }}
                    onFocus={(event) => { event.currentTarget.style.textDecorationColor = "#526a28"; }}
                    onBlur={(event) => { event.currentTarget.style.textDecorationColor = "transparent"; }}
                  >
                    {member.first_name} {member.last_name}
                  </Link>
                ) : (
                  <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                    {member.first_name} {member.last_name}
                  </div>
                )}

                <div style={{ color: "#64748b", fontSize: 14 }}>
                  {member.mobile || "No mobile number"}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <Button
                  type="button"
                  onClick={() => {
                    setSelectedMember(member);
                    setShowTransferModal(true);
                  }}
                >
                  Transfer
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    setSelectedMember(member);
                    setShowRemoveModal(true);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </ProfileCard>
      <Modal
        open={showDeleteModal}
        title="Delete Cell Group"
        onClose={() => setShowDeleteModal(false)}
      >
        <p className="mb-6">
          Are you sure you want to delete <strong>{group.name}</strong>?
        </p>

        <p className="mb-6 text-sm text-slate-500">
          Members assigned to this cell group will remain in the system.
        </p>

        <div className="flex justify-end gap-3">
          <Button type="button" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>

          <Button
            type="button"
            onClick={async () => {
              await deleteCellGroup();
              setShowDeleteModal(false);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
      <TransferMemberModal
        open={showTransferModal}
        member={selectedMember}
        groups={cellGroups}
        onClose={() => setShowTransferModal(false)}
        onTransferred={() => {
          loadMembers();
          loadGroup();
        }}
      />

      <RemoveMemberModal
        open={showRemoveModal}
        member={selectedMember}
        onClose={() => setShowRemoveModal(false)}
        onRemoved={() => {
          loadMembers();
          loadGroup();
        }}
      />
    </div>
  );
}
