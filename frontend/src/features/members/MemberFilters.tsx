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
      style={{
        minWidth: "180px",
        background: "white",
        border: "1px solid #cbd5e1",
        borderRadius: "12px",
        padding: "12px 16px",
      }}
    >
      <option value="">All statuses</option>
      <option value="Visitor">Visitor</option>
      <option value="Regular Attendee">Regular Attendee</option>
      <option value="Member">Member</option>
      <option value="Inactive">Inactive</option>
    </select>
  );
}
