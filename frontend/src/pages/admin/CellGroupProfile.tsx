import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

import type { CellGroup } from "../../features/cellGroups/cellGroup";
import { mapCellGroup } from "../../features/cellGroups/cellGroupMapper";
import InviteLinkModal from "./InviteLinkModal";

import ProfileCard from "../../components/profile/ProfileCard";
import InfoRow from "../../components/profile/InfoRow";

import {
  getInvite,
  createInvite,
} from "../../features/cellGroups/cellGroupInviteService";

import { generateInviteToken } from "../../features/cellGroups/cellGroupUtils";

import Button from "../../components/ui/Button";

export default function CellGroupProfile() {
  const { id } = useParams();

  const navigate = useNavigate();

  const [group, setGroup] = useState<CellGroup | null>(null);
  const [loading, setLoading] = useState(true);

  const [inviteLink, setInviteLink] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    loadGroup();
  }, []);

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

  if (loading) return <p>Loading...</p>;

  if (!group) return <p>Cell Group not found.</p>;

  async function deleteCellGroup() {
    if (!confirm("Are you sure you want to delete this cell group?")) {
      return;
    }

    const { error } = await supabase.from("cell_groups").delete().eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    navigate("/admin/cell-groups");
  }

  async function handleInvite(cellGroupId: string) {
    // Check if an invite already exists
    const { data: invite } = await getInvite(cellGroupId);

    if (invite) {
      const link = `${window.location.origin}/join/${invite.token}`;

      setInviteLink(link);
      setShowInviteModal(true);
      return;
    }

    // Create a new invite
    const token = generateInviteToken();

    const { data, error } = await createInvite(cellGroupId, token);

    if (error) {
      console.error(error);
      alert("Failed to create invite.");
      return;
    }

    const link = `${window.location.origin}/join/${data.token}`;

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

          <Button type="button" onClick={deleteCellGroup}>
            Delete
          </Button>

          <Button type="button" onClick={() => handleInvite(group.id)}>
            Invite
          </Button>

          <InviteLinkModal
            open={showInviteModal}
            link={inviteLink}
            onClose={() => setShowInviteModal(false)}
          />
        </div>
      </ProfileCard>
    </div>
  );
}
