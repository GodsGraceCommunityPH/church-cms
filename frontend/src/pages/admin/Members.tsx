import { useEffect, useState } from "react";

import PrimaryButton from "../../components/PrimaryButton";
import { supabase } from "../../lib/supabase";
import type { Member } from "../../features/members/member";

function Members() {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .order("last_name");

    if (error) {
      console.error(error);
      return;
    }

    const formattedMembers: Member[] = data.map((member) => ({
      id: member.id,

      firstName: member.first_name,
      lastName: member.last_name,
      nickname: member.nickname,
      gender: member.gender,
      birthday: member.birthday,

      membershipStatus: member.membership_status,
      cellGroup: member.cell_group,

      mobile: member.mobile,
      email: member.email,
      address: member.address,

      remarks: member.remarks,
    }));

    setMembers(formattedMembers);
  }

  async function deleteMember(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this member?",
    );

    if (!confirmed) return;

    const { error } = await supabase.from("members").delete().eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to delete member.");
      return;
    }

    await loadMembers();
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1
            style={{
              paddingLeft: "20px",
            }}
            className="text-3xl font-bold"
          >
            Members
          </h1>
          <p
            style={{
              paddingLeft: "20px",
            }}
            className="text-slate-600"
          >
            Manage church members.
          </p>
        </div>
        <div
          style={{
            paddingLeft: "50px",
            paddingRight: "50px",
          }}
        >
          <PrimaryButton to="/admin/members/new" className="w-full">
            Add Member
          </PrimaryButton>
        </div>
      </div>

      <div
        className="rounded-2xl border border-slate-200 bg-white"
        style={{ padding: "32px" }}
      >
        <input
          style={{
            paddingLeft: "10px",
          }}
          type="text"
          placeholder="Search members..."
          className="mb-6 w-full rounded-xl border border-slate-300 px-4 py-3"
        />

        {members.length === 0 ? (
          <div
            style={{
              padding: "80px 0",
              textAlign: "center",
            }}
          >
            <h2 className="text-xl font-semibold">No members yet</h2>

            <p className="text-slate-500" style={{ marginTop: "8px" }}>
              Click "Add Member" to add your first church member.
            </p>
          </div>
        ) : (
          <div
            style={{
              paddingTop: "10px",
            }}
            className="space-y-4"
          >
            {members.map((member) => (
              <div
                style={{
                  padding: "10px 0 0 10px",
                }}
                key={member.id}
                className="flex items-start justify-between rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <h3 className="font-semibold">
                    {member.firstName} {member.lastName}
                  </h3>

                  <p className="text-sm text-slate-500">
                    {member.membershipStatus}
                  </p>

                  <p className="text-sm text-slate-500">
                    {member.cellGroup || "-"}
                  </p>
                </div>
                <div
                  style={{
                    padding: "10px 10px 0 0",
                  }}
                >
                  <button
                    style={{
                      paddingLeft: "10px",
                      paddingRight: "10px",
                    }}
                    onClick={() => deleteMember(member.id)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default Members;
