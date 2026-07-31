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
    <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-4 font-medium text-slate-900">
        {member.firstName} {member.lastName}
        {member.nickname && (
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({member.nickname})
          </span>
        )}
      </td>
      <td className="px-4 py-4 text-slate-600">{member.membershipStatus || "-"}</td>
      <td className="px-4 py-4 text-slate-600">{member.cellGroup || "Unassigned"}</td>
      <td className="px-4 py-4 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpen(member.id)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            View
          </button>
          {!isInactive && (
            <button
              type="button"
              onClick={() => onDeactivate(member)}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Deactivate
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
