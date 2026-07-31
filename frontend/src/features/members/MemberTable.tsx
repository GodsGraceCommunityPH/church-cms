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
    <div className="overflow-x-auto" style={{ overflowX: "auto" }}>
      <table
        className="w-full min-w-[640px] text-left text-sm"
        style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse" }}
      >
        <thead className="bg-slate-50 text-slate-600" style={{ background: "#f8fafc", color: "#475569" }}>
          <tr>
            <th className="px-5 py-3 font-medium" style={{ padding: "12px 20px" }}>Name</th>
            <th className="px-5 py-3 font-medium" style={{ padding: "12px 20px" }}>Cell Group</th>
            <th className="px-5 py-3 text-right font-medium" style={{ padding: "12px 20px", textAlign: "right" }}>Actions</th>
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
