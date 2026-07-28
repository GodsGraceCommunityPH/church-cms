type InfoRowProps = {
  label: string;
  value?: string | null;
};

export default function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 0",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <span
        style={{
          color: "#64748b",
          fontWeight: 500,
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontWeight: 600,
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}
