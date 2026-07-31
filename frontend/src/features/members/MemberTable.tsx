import type { Member } from "./member";
import MemberRow from "./MemberRow";

interface MemberTableProps {
  members: Member[];
  onOpen: (id: string) => void;
  onDeactivate: (member: Member) => void;
}

export default function MemberTable({
  members,
  onOpen,
  onDeactivate,
}: MemberTableProps) {
  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      <table
        className="w-full table-fixed text-left text-sm"
        style={{ width: "100%", minWidth: 0, tableLayout: "fixed", borderCollapse: "collapse" }}
      >
        <thead className="bg-slate-50 text-slate-600" style={{ background: "#f8fafc", color: "#475569" }}>
          <tr>
            <th className="px-5 py-3 font-medium" style={{ padding: "12px" }}>Name</th>
            <th className="px-5 py-3 font-medium" style={{ padding: "12px" }}>Cell Group</th>
            <th className="px-5 py-3 text-right font-medium" style={{ width: "120px", padding: "12px", textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              onOpen={onOpen}
              onDeactivate={onDeactivate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
