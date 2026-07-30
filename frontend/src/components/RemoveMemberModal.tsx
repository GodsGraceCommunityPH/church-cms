import { useState } from "react";
import { supabase } from "../lib/supabase";
import Modal from "./Modal";
import Button from "./ui/Button";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  open: boolean;
  member: Member | null;
  onClose: () => void;
  onRemoved: () => void;
}

export default function RemoveMemberModal({
  open,
  member,
  onClose,
  onRemoved,
}: Props) {
  const [saving, setSaving] = useState(false);

  if (!open || !member) return null;

  async function handleRemove() {
    if (!member) return;

    setSaving(true);

    const { error } = await supabase
      .from("members")
      .update({
        cell_group_id: null,
      })
      .eq("id", member.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    onRemoved();
    onClose();
  }

  return (
    <Modal open={open} title="Transfer Member" onClose={onClose}>
      <h2>Remove Member</h2>

      <p>
        Remove{" "}
        <strong>
          {member.first_name} {member.last_name}
        </strong>{" "}
        from this cell group?
      </p>

      <p style={{ color: "#64748b" }}>
        The member will remain in the church database and can be assigned to
        another cell group later.
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>

        <Button type="button" onClick={handleRemove} disabled={saving}>
          {saving ? "Removing..." : "Remove"}
        </Button>
      </div>
    </Modal>
  );
}
