import { useNavigate } from "react-router-dom";

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function MemberProfile() {
  const { id } = useParams();

  const navigate = useNavigate();

  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMember();
  }, []);

  async function loadMember() {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
    } else {
      setMember(data);
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
            background: "#ececec",
            margin: "0 auto 20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "36px",
          }}
        >
          👤
        </div>

        <h1 style={{ margin: 0 }}>
          {member.first_name} {member.last_name}
        </h1>

        <p
          style={{
            marginTop: "10px",
            color: "#666",
          }}
        >
          {member.membership_status}
        </p>
      </div>
    </div>
  );
}
