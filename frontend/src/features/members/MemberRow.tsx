import type { Member } from "./member";

interface MemberRowProps {
  member: Member;
  onOpen: (id: string) => void;
  onDeactivate: (member: Member) => void;
}

export default function MemberRow({
  member,
  onOpen,
  onDeactivate,
}: MemberRowProps) {
  const isInactive = member.membershipStatus === "Inactive";

  return (
    <tr
      className="border-t border-slate-100 hover:bg-slate-50"
      onClick={() => onOpen(member.id)}
      style={{ borderTop: "1px solid #f1f5f9", cursor: "pointer" }}
    >
      <td className="px-5 py-3 font-medium text-slate-900" style={{ padding: "12px 20px" }}>
        {member.firstName} {member.lastName}
        {member.nickname && (
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({member.nickname})
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-slate-600" style={{ padding: "12px 20px" }}>{member.cellGroup || "Unassigned"}</td>
      <td className="px-5 py-3 text-right" style={{ padding: "12px 20px", textAlign: "right" }}>
        <div className="flex justify-end gap-2">
          {!isInactive && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDeactivate(member);
              }}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              style={{
                background: "white",
                border: "1px solid #fca5a5",
                borderRadius: "8px",
                color: "#dc2626",
                padding: "8px 12px",
              }}
            >
              Deactivate
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
