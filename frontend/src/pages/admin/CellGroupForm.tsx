import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import SearchableSelect from "../../components/ui/SearchableSelect";
import { useParams } from "react-router-dom";
import { useAuth } from "../../features/auth/auth";

export default function CellGroupForm() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageGroups = hasPermission("cell_groups.manage");
  const canCreateGroups = hasPermission("cell_groups.create");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Active");
  const [leaderMemberId, setLeaderMemberId] = useState("");
  const [members, setMembers] = useState<any[]>([]);

  const { id } = useParams();

  const isEdit = !!id;

  // The loaders intentionally rerun only when the route identity changes.
  /* oxlint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadMembers();

    if (isEdit) {
      loadCellGroup();
    }
  }, [id]);
  /* oxlint-enable react-hooks/exhaustive-deps */

  async function loadCellGroup() {
    const { data, error } = await supabase
      .from("cell_groups")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setName(data.name);
    setDescription(data.description ?? "");
    setStatus(data.status);
    setLeaderMemberId(data.leader_id ?? "");
  }

  async function loadMembers() {
    const { data, error } = isEdit || canManageGroups
      ? await supabase.from("members").select("id, first_name, last_name").order("first_name")
      : await supabase.rpc("get_cell_group_leader_candidates");

    if (error) {
      console.error(error);
      return;
    }

    setMembers(data);
  }

  async function saveCellGroup(e: React.FormEvent) {
    e.preventDefault();

    let error;

    if (isEdit) {
      ({ error } = await supabase.from("cell_groups").update({
        name, description: description || null, status,
        leader_id: leaderMemberId || null,
        leader_member_id: leaderMemberId || null,
      }).eq("id", id));
    } else if (canManageGroups) {
      ({ error } = await supabase.from("cell_groups").insert({
        name, description: description || null, status,
        leader_id: leaderMemberId || null,
        leader_member_id: leaderMemberId || null,
      }));
    } else if (canCreateGroups && hasPermission("cell_groups.assign_leaders")) {
      const result = await supabase.rpc("create_cell_group_as_leader", {
        p_name: name, p_description: description || null,
        p_status: status, p_leader_member_id: leaderMemberId || null,
      });
      error = result.error;
    } else {
      error = new Error("You do not have permission to create cell groups.");
    }

    if (error) {
      console.error(error);
      window.alert(error.message || "Unable to save the cell group. Please try again.");
      return;
    }

    navigate("/admin/cell-groups");
  }

  if (!isEdit && !canManageGroups && (!canCreateGroups || !hasPermission("cell_groups.assign_leaders"))) {
    return <p>You do not have permission to create cell groups.</p>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>{isEdit ? "Edit Cell Group" : "Add Cell Group"}</h1>

      <form onSubmit={saveCellGroup}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="cell-group-name" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500, color: "#334155" }}>Name</label>
          <Input
            id="cell-group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter cell group name"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="cell-group-description" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500, color: "#334155" }}>Description</label>
          <Textarea
            id="cell-group-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a description"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500, color: "#334155" }}>Cell Group Leader</label>
          {!isEdit && !canManageGroups && <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 13 }}>You can choose any existing church member as the leader of this new group.</p>}
          <SearchableSelect
            value={leaderMemberId}
            onChange={setLeaderMemberId}
            placeholder="Select any existing church member"
            options={members.map((member) => ({
              id: member.id,
              label: `${member.first_name} ${member.last_name}`,
            }))}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="cell-group-status" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500, color: "#334155" }}>Status</label>
          <Select id="cell-group-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Active</option>
            <option>Inactive</option>
          </Select>
        </div>

        <Button type="submit">
          <p>{isEdit ? "Update Cell Group" : "Save Cell Group"}</p>
        </Button>
      </form>
    </div>
  );
}
