import { useState } from "react";
import { supabase } from "../lib/supabase";
import Modal from "./Modal";
import Button from "./ui/Button";

interface CellGroup {
  id: string;
  name: string;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  open: boolean;
  member: Member | null;
  groups: CellGroup[];
  onClose: () => void;
  onTransferred: () => void;
}

export default function TransferMemberModal({
  open,
  member,
  groups,
  onClose,
  onTransferred,
}: Props) {
  const [groupId, setGroupId] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open || !member) return null;

  async function handleTransfer() {
    if (!member) return;
    if (!groupId) return;

    setSaving(true);

    const { error } = await supabase
      .from("members")
      .update({
        cell_group_id: groupId,
      })
      .eq("id", member.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    onTransferred();
    onClose();
  }

  return (
    <Modal open={open} title="Transfer Member" onClose={onClose}>
      <h2>Transfer Member</h2>

      <p>
        Move{" "}
        <strong>
          {member.first_name} {member.last_name}
        </strong>{" "}
        to another cell group.
      </p>

      <select
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          marginTop: 20,
          marginBottom: 20,
        }}
      >
        <option value="">Select Cell Group</option>

        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", gap: 10 }}>
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>

        <Button
          type="button"
          disabled={!groupId || saving}
          onClick={handleTransfer}
        >
          {saving ? "Transferring..." : "Transfer"}
        </Button>
      </div>
    </Modal>
  );
}
