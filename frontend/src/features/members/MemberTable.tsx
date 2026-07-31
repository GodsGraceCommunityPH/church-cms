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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Cell Group</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
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
