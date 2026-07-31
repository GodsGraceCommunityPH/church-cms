interface MemberFiltersProps {
  value: string;
  onChange: (value: string) => void;
}

export default function MemberFilters({ value, onChange }: MemberFiltersProps) {
  return (
    <select
      aria-label="Filter by member status"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
    >
      <option value="">All statuses</option>
      <option value="Visitor">Visitor</option>
      <option value="Regular Attendee">Regular Attendee</option>
      <option value="Member">Member</option>
      <option value="Inactive">Inactive</option>
    </select>
  );
}
