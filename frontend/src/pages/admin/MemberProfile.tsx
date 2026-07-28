import { useNavigate } from "react-router-dom";

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Member } from "../../features/members/member";
import { mapMember } from "../../features/members/memberMapper";

import ProfileCard from "../../components/profile/ProfileCard";
import InfoRow from "../../components/profile/InfoRow";

import { formatDate, calculateAge } from "../../utils/date";
import { getInitials } from "../../features/members/memberUtils";

export default function MemberProfile() {
  const { id } = useParams();

  const navigate = useNavigate();

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMember();
  }, []);

  async function loadMember() {
    const { data, error } = await supabase
      .from("members")
      .select(
        `
    *,
    cell_group:cell_groups!members_cell_group_id_fkey(
      id,
      name
    )
    `,
      )
      .eq("id", id)
      .single();
    console.log("=== LOAD MEMBER V2 ===");
    console.log(data);
    if (error) {
      console.error(error);
    } else {
      setMember(mapMember(data));
    }

    setLoading(false);
  }

  if (loading) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  if (!member) {
    return <p style={{ padding: 20 }}>Member not found.</p>;
  }

  return (
    <div
      style={{
        padding: "30px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "25px",
        }}
      >
        <button onClick={() => navigate("/admin/members")}>
          ← Back to Members
        </button>

        <button onClick={() => navigate(`/admin/members/${member.id}/edit`)}>
          Edit Member
        </button>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "40px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "90px",
            height: "90px",
            borderRadius: "50%",
            background: "#2563eb",
            color: "white",
            margin: "0 auto 20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "30px",
            fontWeight: "bold",
          }}
        >
          {getInitials(member.firstName, member.lastName)}
        </div>

        <h1 style={{ margin: 0 }}>
          {member.firstName} {member.lastName}
        </h1>

        <ProfileCard title="Personal Information">
          <InfoRow label="Birthday" value={formatDate(member.birthday)} />
          <InfoRow label="Age" value={calculateAge(member.birthday)} />
          <InfoRow
            label="Nick Name"
            value={member.nickname ? member.nickname : member.firstName}
          />
        </ProfileCard>

        <ProfileCard title="Contact Information">
          <InfoRow label="Mobile" value={member.mobile} />
          <InfoRow label="Email" value={member.email} />
          <InfoRow label="Address" value={member.address} />
        </ProfileCard>

        <ProfileCard title="Church Information">
          <InfoRow label="Membership Status" value={member.membershipStatus} />
          <InfoRow label="Cell Group" value={member.cellGroup} />
        </ProfileCard>

        <ProfileCard title="Remarks">
          <InfoRow label="Remarks" value={member.remarks} />
        </ProfileCard>
      </div>
    </div>
  );
}
