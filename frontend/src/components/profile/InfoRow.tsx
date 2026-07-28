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
        padding: "10px 0px",
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
          padding: "14px  20px",
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}
