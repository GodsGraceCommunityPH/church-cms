import { useState } from "react";

import PrimaryButton from "../../../components/PrimaryButton";
import FormInput from "../../../components/forms/FormInput";
import FormSelect from "../../../components/forms/FormSelect";
import FormTextarea from "../../../components/forms/FormTextArea";

import type { Member } from "../../members/types";
import { type MemberValidationErrors, validateMemberDetails, yesterdayDateInputValue } from "../../../utils/memberValidation";

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
  const [errors, setErrors] = useState<MemberValidationErrors>({});

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
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationErrors = validateMemberDetails({ ...member, requireBirthday: true });
    const firstInvalidField = Object.keys(validationErrors)[0];
    if (firstInvalidField) {
      setErrors(validationErrors);
      requestAnimationFrame(() => document.getElementById(firstInvalidField)?.focus());
      return;
    }
    setErrors({});

    await onSubmit(member);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Personal Information */}
      <section
        className="rounded-2xl border border-slate-200 bg-white"
        style={{ padding: "clamp(20px, 5vw, 32px)", marginBottom: "32px" }}
      >
        <h2 className="mb-6 text-xl font-semibold">Personal Information</h2>

        <FormInput
          label="First Name"
          name="firstName"
          required
          value={member.firstName}
          onChange={handleChange}
          autoComplete="given-name"
          error={errors.firstName}
        />

        <FormInput
          label="Last Name"
          name="lastName"
          required
          value={member.lastName}
          onChange={handleChange}
          autoComplete="family-name"
          error={errors.lastName}
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
          error={errors.gender}
        />

        <FormInput
          label="Birthday"
          name="birthday"
          type="date"
          required
          value={member.birthday}
          onChange={handleChange}
          max={yesterdayDateInputValue()}
          error={errors.birthday}
        />
      </section>

      {/* Contact Information */}
      <section
        className="rounded-2xl border border-slate-200 bg-white"
        style={{ padding: "clamp(20px, 5vw, 32px)", marginBottom: "32px" }}
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
          error={errors.mobile}
        />

        <FormInput
          label="Email"
          name="email"
          type="email"
          value={member.email}
          onChange={handleChange}
          autoComplete="email"
          error={errors.email}
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
