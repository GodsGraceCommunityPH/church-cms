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
      style={{
        width: "100%",
        border: "1px solid #cbd5e1",
        borderRadius: "12px",
        padding: "12px 16px",
      }}
    />
  );
}
