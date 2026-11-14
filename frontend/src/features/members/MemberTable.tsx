import type { Member } from "./member";
import MemberRow from "./MemberRow";

interface MemberTableProps {
  members: Member[];
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  newMemberIds?: Set<string>;
  canEdit?: boolean;
  canEditMember?: (member: Member) => boolean;
}

export default function MemberTable({
  members,
  onOpen,
  onEdit,
  newMemberIds = new Set(),
  canEdit = true,
  canEditMember,
}: MemberTableProps) {
  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      <table
        className="w-full table-fixed text-left text-sm"
        style={{ width: "100%", minWidth: 0, tableLayout: "fixed", borderCollapse: "collapse" }}
      >
        <thead className="bg-slate-50 text-slate-600" style={{ background: "#f8fafc", color: "#475569" }}>
          <tr>
            <th colSpan={2} className="px-5 py-3 font-medium" style={{ padding: "12px" }}>Member</th>
            <th className="px-5 py-3 text-right font-medium" style={{ width: "56px", padding: "12px", textAlign: "right" }}><span className="sr-only">Edit</span></th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              onOpen={onOpen}
              onEdit={onEdit}
              isNew={newMemberIds.has(member.id)}
              canEdit={canEditMember ? canEditMember(member) : canEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
