import { Pencil } from "lucide-react";
import type { Member } from "./member";

interface MemberRowProps {
  member: Member;
  onOpen: (id: string) => void;
}

export default function MemberRow({
  member,
  onOpen,
}: MemberRowProps) {
  const initials = `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();

  return (
    <tr
      className="border-t border-slate-100 hover:bg-slate-50"
      onClick={() => onOpen(member.id)}
      style={{ borderTop: "1px solid #f1f5f9", cursor: "pointer" }}
    >
      <td colSpan={2} style={{ padding: "12px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: "50%", flex: "0 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#e7eddc", color: "#40511f", fontWeight: 800 }}>{initials}</span>
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: "block", overflowWrap: "anywhere", color: "#0f172a" }}>{member.firstName} {member.lastName}{member.nickname ? ` (${member.nickname})` : ""}</strong>
            <small style={{ display: "block", marginTop: 4, color: "#64748b" }}>{member.cellGroup || "No Cell Group"}</small>
          </span>
        </div>
      </td>
      <td style={{ width: 56, padding: "12px", textAlign: "right" }}>
        <button type="button" className="training-icon-button" aria-label={`Edit ${member.firstName} ${member.lastName}`} title="Edit Member" onClick={(event) => { event.stopPropagation(); onOpen(member.id); }}><Pencil size={16} aria-hidden="true" /></button>
      </td>
    </tr>
  );
}
