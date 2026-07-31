import { useState } from "react";

import PrimaryButton from "../../../components/PrimaryButton";
import FormInput from "../../../components/forms/FormInput";
import FormSelect from "../../../components/forms/FormSelect";
import FormTextarea from "../../../components/forms/FormTextArea";

import type { Member } from "../../members/types";
import { validateMemberDetails, yesterdayDateInputValue } from "../../../utils/memberValidation";

type JoinMember = Pick<
  Member,
  | "firstName"
  | "lastName"
  | "nickname"
  | "gender"
  | "birthday"
  | "mobile"
  | "email"
  | "address"
>;

interface JoinMemberFormProps {
  onSubmit: (member: JoinMember) => Promise<void>;
}

export default function JoinMemberForm({ onSubmit }: JoinMemberFormProps) {
  const [member, setMember] = useState<JoinMember>({
    firstName: "",
    lastName: "",
    nickname: "",
    gender: "",
    birthday: "",
    mobile: "",
    email: "",
    address: "",
  });
  const [error, setError] = useState("");

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
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationError = validateMemberDetails(member);
    if (validationError) { setError(validationError); return; }
    setError("");

    await onSubmit(member);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <p style={{ padding: 14, border: "1px solid #fecaca", borderRadius: 10, background: "#fef2f2", color: "#b91c1c" }}>{error}</p>}
      {/* Personal Information */}
      <section
        className="rounded-2xl border border-slate-200 bg-white"
        style={{ padding: "32px", marginBottom: "32px" }}
      >
        <h2 className="mb-6 text-xl font-semibold">Personal Information</h2>

        <FormInput
          label="First Name"
          name="firstName"
          required
          value={member.firstName}
          onChange={handleChange}
          pattern="[A-Za-z '\-]+"
        />

        <FormInput
          label="Last Name"
          name="lastName"
          required
          value={member.lastName}
          onChange={handleChange}
          pattern="[A-Za-z '\-]+"
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
        />

        <FormInput
          label="Birthday"
          name="birthday"
          type="date"
          required
          value={member.birthday}
          onChange={handleChange}
          max={yesterdayDateInputValue()}
        />
      </section>

      {/* Contact Information */}
      <section
        className="rounded-2xl border border-slate-200 bg-white"
        style={{ padding: "32px", marginBottom: "32px" }}
      >
        <h2 className="mb-6 text-xl font-semibold">Contact Information</h2>

        <FormInput
          label="Mobile"
          name="mobile"
          value={member.mobile}
          onChange={handleChange}
          inputMode="tel"
        />

        <FormInput
          label="Email"
          name="email"
          type="email"
          value={member.email}
          onChange={handleChange}
        />

        <FormTextarea
          label="Address"
          name="address"
          rows={3}
          value={member.address}
          onChange={handleChange}
        />
      </section>

      <div className="flex justify-end">
        <PrimaryButton type="submit">
          <p style={{ padding: "10px" }}>Join Cell Group</p>
        </PrimaryButton>
      </div>
    </form>
  );
}
