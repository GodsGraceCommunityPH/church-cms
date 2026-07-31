interface MemberSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function MemberSearch({ value, onChange }: MemberSearchProps) {
  return (
    <input
      type="search"
      placeholder="Search by name or nickname..."
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-slate-300 px-4 py-3"
    />
  );
}
