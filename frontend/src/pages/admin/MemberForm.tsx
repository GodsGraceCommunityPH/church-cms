import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import PrimaryButton from "../../components/PrimaryButton";

import FormInput from "../../components/forms/FormInput";
import FormSelect from "../../components/forms/FormSelect";
import FormTextarea from "../../components/forms/FormTextArea";
import { defaultMember } from "../../features/members/member";
import type { Member } from "../../features/members/member";
import type { CellGroup } from "../../features/cellGroups/cellGroup";
import { supabase } from "../../lib/supabase";
import SearchableSelect from "../../components/ui/SearchableSelect";
import { type MemberValidationErrors, validateMemberDetails, yesterdayDateInputValue } from "../../utils/memberValidation";
import {
  createMember,
  getMember,
  updateMember,
} from "../../features/members/memberService";

function MemberForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [member, setMember] = useState<Member>(defaultMember);
  const [cellGroups, setCellGroups] = useState<CellGroup[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [memberLoadError, setMemberLoadError] = useState("");
  const [cellGroupLoadError, setCellGroupLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<MemberValidationErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadCellGroups();

    if (isEdit) {
      void loadMember();
    } else {
      setIsLoading(false);
    }
  }, [id]);

  async function loadMember() {
    if (!id) {
      return;
    }

    try {
      setMember(await getMember(id));
    } catch {
      setMemberLoadError("Unable to load member details. Please return to the member list and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCellGroups() {
    const { data, error } = await supabase
      .from("cell_groups")
      .select("*")
      .eq("status", "Active")
      .order("name");

    if (error) {
      setCellGroupLoadError("Unable to load cell groups. You can still save the member without an assignment.");
      return;
    }

    setCellGroups(data ?? []);
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;

    setMember((prev) => ({
      ...prev,
      [name]: value,
    }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSaving) {
      return;
    }

    setFormError("");

    const firstName = member.firstName.trim();
    const lastName = member.lastName.trim();

    const validationErrors = validateMemberDetails({ firstName, lastName, gender: member.gender, membershipStatus: member.membershipStatus, email: member.email, mobile: member.mobile, birthday: member.birthday });
    const firstInvalidField = Object.keys(validationErrors)[0];
    if (firstInvalidField) {
      setFieldErrors(validationErrors);
      requestAnimationFrame(() => document.getElementById(firstInvalidField)?.focus());
      return;
    }
    setFieldErrors({});

    const payload = {
      first_name: firstName,
      last_name: lastName,
      nickname: member.nickname.trim(),
      gender: member.gender,
      birthday: member.birthday || null,

      membership_status: member.membershipStatus,
      cell_group_id: member.cellGroupId || null,

      mobile: member.mobile.trim(),
      email: member.email.trim(),
      address: member.address.trim(),

      remarks: member.remarks.trim(),
    };

    setIsSaving(true);

    try {
      if (isEdit && id) {
        await updateMember(id, payload);
      } else {
        await createMember(payload);
      }
    } catch {
      setFormError("Unable to save the member. Please try again.");
      setIsSaving(false);
      return;
    }

    navigate("/admin/members", {
      state: {
        successMessage: isEdit
          ? "Member updated successfully."
          : "Member created successfully.",
      },
    });
  };

  if (isLoading) {
    return <p className="p-5" style={{ margin: 0, padding: "20px" }}>Loading member details...</p>;
  }

  if (memberLoadError && isEdit) {
    return (
      <div className="space-y-4 p-5" style={{ padding: "20px" }}>
        <p className="text-red-600" style={{ color: "#dc2626" }}>{memberLoadError}</p>
        <Link to="/admin/members" className="text-slate-600 underline" style={{ color: "#475569" }}>
          Back to Members
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link
        to="/admin/members"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
        style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "#475569" }}
      >
        <ArrowLeft size={18} />
        Back to Members
      </Link>

      <div
        style={{ margin: "24px 0 32px" }}
      >
        <h1 className="text-3xl font-bold">{isEdit ? "Edit Member" : "Add Member"}</h1>

        <p className="text-slate-600">
          {isEdit ? "Update this member's information." : "Create a new church member."}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="mx-8 mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" style={{ margin: "0 0 16px", border: "1px solid #fecaca", borderRadius: "8px", background: "#fef2f2", padding: "12px", color: "#b91c1c" }}>
            {formError}
          </p>
        )}
        {cellGroupLoadError && (
          <p className="mx-8 mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700" style={{ margin: "0 0 16px", border: "1px solid #fde68a", borderRadius: "8px", background: "#fffbeb", padding: "12px", color: "#b45309" }}>
            {cellGroupLoadError}
          </p>
        )}
        {/* Top Row */}
        <div className="grid gap-8 lg:grid-cols-2" style={{ display: "grid", gap: "24px", margin: "24px 0" }}>
          {/* Personal Information */}
          <section
            className="rounded-2xl border border-slate-200 bg-white"
            style={{ padding: "24px" }}
          >
            <h2 className="mb-6 text-xl font-semibold">Personal Information</h2>
            <FormInput
              label="First Name"
              name="firstName"
              required
              value={member.firstName}
              onChange={handleChange}
              autoComplete="given-name"
              error={fieldErrors.firstName}
            />
            <FormInput
              label="Last Name"
              name="lastName"
              required
              value={member.lastName}
              onChange={handleChange}
              autoComplete="family-name"
              error={fieldErrors.lastName}
            />
            <FormInput
              label="Nickname"
              name="nickname"
              value={member.nickname}
              onChange={handleChange}
            />

            <FormSelect
              label="Gender"
              name="gender"
              required
              options={[
                { label: "Male", value: "Male" },
                { label: "Female", value: "Female" },
              ]}
              value={member.gender}
              onChange={handleChange}
              error={fieldErrors.gender}
            />

            <FormInput
              label="Birthday"
              name="birthday"
              type="date"
              value={member.birthday}
              onChange={handleChange}
              max={yesterdayDateInputValue()}
              error={fieldErrors.birthday}
            />
          </section>

          {/* Church Information */}
          <section
            className="rounded-2xl border border-slate-200 bg-white"
            style={{ padding: "24px" }}
          >
            <h2 className="mb-6 text-xl font-semibold">Church Information</h2>
            <FormSelect
              label="Membership Status"
              name="membershipStatus"
              required
              options={[
                { label: "Visitor", value: "Visitor" },
                { label: "Regular Attendee", value: "Regular Attendee" },
                { label: "Member", value: "Member" },
                { label: "Inactive", value: "Inactive" },
              ]}
              value={member.membershipStatus}
              onChange={handleChange}
              error={fieldErrors.membershipStatus}
            />
            <SearchableSelect
              value={member.cellGroupId}
              onChange={(value) =>
                setMember({
                  ...member,
                  cellGroupId: value,
                })
              }
              placeholder="Select Cell Group"
              options={cellGroups.map((group) => ({
                id: group.id,
                label: group.name,
              }))}
            />
          </section>
        </div>

        {/* Contact Information */}
        <section
          className="rounded-2xl border border-slate-200 bg-white"
          style={{
            padding: "24px",
            margin: "24px 0",
          }}
        >
          <h2 className="mb-6 text-xl font-semibold">Contact Information</h2>

          <FormInput
            label="Mobile"
            name="mobile"
            value={member.mobile}
            onChange={handleChange}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            error={fieldErrors.mobile}
          />

          <FormInput
            label="Email"
            name="email"
            type="email"
            value={member.email}
            onChange={handleChange}
            autoComplete="email"
            error={fieldErrors.email}
          />

          <FormTextarea
            label="Address"
            name="address"
            rows={3}
            value={member.address}
            onChange={handleChange}
          />
        </section>

        {/** Remarks **/}
        <section
          className="rounded-2xl border border-slate-200 bg-white"
          style={{
            padding: "24px",
            margin: "24px 0",
          }}
        >
          <h2 className="mb-6 text-xl font-semibold">Remarks</h2>

          <FormTextarea
            label="Remarks"
            name="remarks"
            rows={5}
            value={member.remarks}
            onChange={handleChange}
          />
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            gap: "16px",
            margin: "0 0 24px",
          }}
        >
          <Link
            to="/admin/members"
            className="rounded-xl border border-slate-300 px-6 py-3 hover:bg-slate-50"
            style={{ display: "inline-flex", alignItems: "center", minHeight: "48px", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "12px 24px", color: "#334155", textDecoration: "none" }}
          >
            Cancel
          </Link>

          <PrimaryButton type="submit">
            {isSaving ? "Saving..." : "Save Member"}
          </PrimaryButton>
        </div>
      </form>
    </>
  );
}

export default MemberForm;
