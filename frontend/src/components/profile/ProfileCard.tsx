type ProfileCardProps = {
  title: string;
  children: React.ReactNode;
};

export default function ProfileCard({ title, children }: ProfileCardProps) {
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white"
      style={{
        padding: "32px",
        marginTop: "24px",
      }}
    >
      <h2
        style={{
          fontSize: "20px",
          fontWeight: 600,
          marginBottom: "24px",
        }}
      >
        {title}
      </h2>

      {children}
    </section>
  );
}
