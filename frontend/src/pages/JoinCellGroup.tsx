import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Modal from "../components/Modal";
import Button from "../components/ui/Button";
import JoinMemberForm from "../features/join/components/JoinMemberForm";
import {
  submitCellGroupMemberRegistration,
  type CellGroupRegistrationInput,
  type RegistrationDecision,
} from "../features/join/memberRegistrationService";
import { supabase } from "../lib/supabase";

export default function JoinCellGroup() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const requestIdRef = useRef(crypto.randomUUID());
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [pendingRegistration, setPendingRegistration] = useState<CellGroupRegistrationInput | null>(null);
  const [matchedName, setMatchedName] = useState("");
  const [success, setSuccess] = useState<{ title: string; message: string } | null>(null);

  const loadInvite = useCallback(async () => {
    const { data: invite, error } = await supabase
      .from("cell_group_invites")
      .select("cell_groups(name)")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (!error && invite) {
      const group = Array.isArray(invite.cell_groups) ? invite.cell_groups[0] : invite.cell_groups;
      setGroupName(group?.name ?? "");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const finishRegistration = (status: "created" | "updated" | "needs_review") => {
    setPendingRegistration(null);
    setMatchedName("");
    requestIdRef.current = crypto.randomUUID();
    if (status === "updated") {
      setSuccess({ title: "Registration Complete", message: "Your existing member profile has been updated successfully." });
    } else if (status === "needs_review") {
      setSuccess({
        title: "Registration Received",
        message: "We found multiple existing profiles with this name. Your registration needs a quick review before we can connect it to an existing profile.",
      });
    } else {
      setSuccess({ title: "Registration Submitted", message: "Thank you for registering! Your information has been received and will be reviewed by our church staff." });
    }
  };

  const submitRegistration = async (input: CellGroupRegistrationInput, decision: RegistrationDecision = null) => {
    setSubmitting(true);
    setRegistrationError("");
    try {
      const result = await submitCellGroupMemberRegistration(input, decision);
      if (result.status === "needs_confirmation") {
        setPendingRegistration(input);
        setMatchedName(result.display_name ?? `${input.firstName} ${input.lastName}`.trim());
        return;
      }
      finishRegistration(result.status);
    } catch (error) {
      console.error("Member registration failed", error);
      setRegistrationError("Registration could not be completed. Please try again or contact GGCCC staff.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (member: Omit<CellGroupRegistrationInput, "requestId" | "inviteToken">) => {
    await submitRegistration({ ...member, requestId: requestIdRef.current, inviteToken: token });
  };

  const closeSuccess = () => {
    setSuccess(null);
    navigate("/");
  };

  if (loading) return <p>Loading...</p>;
  if (!groupName) {
    return <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center" }}><h1>Invite Unavailable</h1><p>This invitation is invalid, expired, or has been disabled.</p></div>;
  }

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 16px" }}>
      <h1>Join {groupName}</h1>
      <p>Welcome! Please fill out the registration form below.</p>
      {registrationError && <p role="alert" style={{ padding: 12, borderRadius: 8, background: "#fff1f2", color: "#b91c1c" }}>{registrationError}</p>}
      <JoinMemberForm onSubmit={handleJoin} submitting={submitting} />

      <Modal open={Boolean(pendingRegistration)} title="Confirm Existing Profile" onClose={() => !submitting && setPendingRegistration(null)}>
        <p>We found an existing member profile with your name.</p>
        <p style={{ margin: "18px 0", fontSize: 20, fontWeight: 700 }}>{matchedName}</p>
        <p>Is this your existing profile?</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
          <Button type="button" variant="secondary" disabled={submitting} onClick={() => pendingRegistration && void submitRegistration(pendingRegistration, "create_new")}>No, this isn't me</Button>
          <Button type="button" disabled={submitting} onClick={() => pendingRegistration && void submitRegistration(pendingRegistration, "confirm_existing")}>Yes, this is me</Button>
        </div>
      </Modal>

      <Modal open={Boolean(success)} title={success?.title ?? "Registration Complete"} onClose={closeSuccess}>
        <p>{success?.message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}><Button type="button" onClick={closeSuccess}>Go to Homepage</Button></div>
      </Modal>
    </div>
  );
}
