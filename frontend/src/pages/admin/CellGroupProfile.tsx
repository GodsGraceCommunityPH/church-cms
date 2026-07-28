import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

import type { CellGroup } from "../../features/cellGroups/cellGroup";
import { mapCellGroup } from "../../features/cellGroups/cellGroupMapper";

import ProfileCard from "../../components/profile/ProfileCard";
import InfoRow from "../../components/profile/InfoRow";

import Button from "../../components/ui/Button";

export default function CellGroupProfile() {
  const { id } = useParams();

  const navigate = useNavigate();

  const [group, setGroup] = useState<CellGroup | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div style={{ padding: 30, maxWidth: 900, margin: "0 auto" }}>
      <button onClick={() => navigate("/admin/cell-groups")}>← Back</button>

      <h1>{group.name}</h1>

      <ProfileCard title="Information">
        <InfoRow label="Status" value={group.status} />
        <InfoRow label="Description" value={group.description} />

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
        </div>
      </ProfileCard>
    </div>
  );
}
