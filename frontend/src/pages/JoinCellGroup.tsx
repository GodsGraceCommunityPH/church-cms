import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import JoinMemberForm from "../features/join/components/JoinMemberForm";

export default function JoinCellGroup() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [invite, setInvite] = useState<any>(null);

  useEffect(() => {
    loadInvite();
  }, []);

  async function loadInvite() {
    const { data: invite, error } = await supabase
      .from("cell_group_invites")
      .select(
        `
    *,
    cell_groups(name)
  `,
      )
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !invite) {
      setLoading(false);
      return;
    }

    setGroupName(invite.cell_groups.name);
    setInvite(invite);
    setLoading(false);
  }

  if (loading) return <p>Loading...</p>;

  if (!groupName) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center" }}>
        <h1>Invite Unavailable</h1>

        <p>This invitation is invalid, expired, or has been disabled.</p>
      </div>
    );
  }

  async function handleJoin(member: any) {
    const payload = {
      first_name: member.firstName,
      last_name: member.lastName,
      nickname: member.nickname,
      gender: member.gender,
      birthday: member.birthday || null,

      mobile: member.mobile,
      email: member.email,
      address: member.address,

      cell_group_id: invite.cell_group_id,

      membership_status: "Visitor",

      remarks: "",
    };

    const { error } = await supabase.from("members").insert(payload);

    if (error) {
      console.error(error);
      alert("Registration failed.");
      return;
    }

    alert("Registration submitted!");
  }

  return (
    <div style={{ maxWidth: 700, margin: "40px auto" }}>
      <h1>Join {groupName}</h1>

      <p>Welcome! Please fill out the registration form below.</p>
      <JoinMemberForm onSubmit={handleJoin} />
    </div>
  );
}
