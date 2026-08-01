import { useLocation, useNavigate } from "react-router-dom";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Member } from "../../features/members/member";
import { getMember } from "../../features/members/memberService";

import ProfileCard from "../../components/profile/ProfileCard";
import InfoRow from "../../components/profile/InfoRow";

import { formatDate, calculateAge } from "../../utils/date";
import { getInitials } from "../../features/members/memberUtils";
import {
  getMemberTrainingJourney,
  trainingStatusLabel,
  type MemberTrainingJourneyItem,
} from "../../features/training/trainingService";

export default function MemberProfile() {
  const { id } = useParams();

  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [trainingJourney, setTrainingJourney] = useState<MemberTrainingJourneyItem[]>([]);

  const loadMember = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const [nextMember, nextJourney] = await Promise.all([
        getMember(id),
        getMemberTrainingJourney(id),
      ]);
      setMember(nextMember);
      setTrainingJourney(nextJourney);
    } catch {
      setLoadError("Unable to load member details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadMember();
  }, [loadMember]);

  if (loading) {
    return <p style={{ margin: 0, padding: 20 }}>Loading...</p>;
  }

  if (!member) {
    return (
      <div style={{ padding: "20px" }}>
        <p style={{ margin: "0 0 16px", color: "#b91c1c" }}>{loadError || "Member not found."}</p>
        <button
          type="button"
          onClick={() => navigate("/admin/members")}
          style={{ border: "1px solid #cbd5e1", borderRadius: "8px", background: "white", padding: "10px 14px", color: "#334155", cursor: "pointer" }}
        >
          Back to Members
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      {/* Top Buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "25px",
        }}
      >
        <button onClick={() => navigate(returnTo ?? "/admin/members")} style={{ border: "1px solid #cbd5e1", borderRadius: "8px", background: "white", padding: "10px 14px", color: "#334155", cursor: "pointer" }}>
          ← Back to Members
        </button>

        <button onClick={() => navigate(`/admin/members/${member.id}/edit`)} style={{ border: "1px solid #4d6b2d", borderRadius: "8px", background: "#526d2f", padding: "10px 14px", color: "white", cursor: "pointer" }}>
          Edit Member
        </button>
      </div>

      {/* Header */}
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "40px",
          marginBottom: "20px",
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

        <h1
          style={{
            margin: 0,
            marginBottom: "10px",
            fontSize: "30px",
          }}
        >
          {member.firstName} {member.lastName}
        </h1>

        <p
          style={{
            margin: "0 0 6px",
            color: "#666",
            fontSize: "16px",
            fontWeight: 500,
          }}
        >
          {member.membershipStatus}
        </p>

        <p
          style={{
            margin: 0,
            color: "#888",
            fontSize: "14px",
          }}
        >
          {member.cellGroup || "No Cell Group"}
        </p>
      </div>

      <ProfileCard title="Personal Information">
        <InfoRow label="Gender" value={member.gender || "—"} />
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

        <InfoRow
          label="Cell Group"
          value={member.cellGroup || "Not Assigned"}
        />
      </ProfileCard>

      <ProfileCard title="Training">
        {trainingJourney.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No active Training journey recorded.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {trainingJourney.map((item) => (
              <div
                key={item.enrollmentId}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <strong>{item.status === "completed" ? "✓ " : ""}{item.programName} · Attempt {item.attemptNumber}</strong>
                  <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "14px" }}>
                    {trainingStatusLabel(item.status)}
                    {item.batchName ? ` · ${item.batchName}` : ""}
                  </p>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>Enrolled {formatDate(item.enrolledAt)}{item.startedAt ? ` · Started ${formatDate(item.startedAt)}` : ""}{item.completedAt ? ` · Completed ${formatDate(item.completedAt)}` : ""}{item.cancelledAt ? ` · Cancelled ${formatDate(item.cancelledAt)}` : ""}{item.withdrawnAt ? ` · Withdrawn ${formatDate(item.withdrawnAt)}` : ""}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/training/${item.programSlug}/members/${item.enrollmentId}`, { state: { returnTo: location.pathname } })}
                  style={{ border: "1px solid #cbd5e1", borderRadius: "8px", background: "white", padding: "8px 12px", cursor: "pointer" }}
                >
                  View Training
                </button>
              </div>
            ))}
          </div>
        )}
      </ProfileCard>

      <ProfileCard title="Remarks">
        <InfoRow label="Remarks" value={member.remarks} />
      </ProfileCard>
    </div>
  );
}
