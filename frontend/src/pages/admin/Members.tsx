import PrimaryButton from "../../components/PrimaryButton";

function Members() {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-slate-600">Manage church members.</p>
        </div>

        <PrimaryButton to="/admin/members/new">Add Member</PrimaryButton>
      </div>

      <div
        className="rounded-2xl border border-slate-200 bg-white"
        style={{
          padding: "32px",
        }}
      >
        <input
          type="text"
          placeholder="Search members..."
          className="w-full rounded-xl border border-slate-300 px-4 py-3"
        />

        <div
          style={{
            padding: "80px 0",
            textAlign: "center",
          }}
        >
          <h2 className="text-xl font-semibold">No members yet</h2>

          <p
            className="text-slate-500"
            style={{
              marginTop: "8px",
            }}
          >
            Click "Add Member" to add your first church member.
          </p>
        </div>
      </div>
    </>
  );
}

export default Members;
