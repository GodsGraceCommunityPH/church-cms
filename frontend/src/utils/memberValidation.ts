const NAME_PATTERN = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE_PATTERN = /^(?:09\d{9}|\+639\d{9})$/;

export type MemberValidationField = "firstName" | "middleName" | "lastName" | "gender" | "membershipStatus" | "email" | "mobile" | "birthday";
export type MemberValidationErrors = Partial<Record<MemberValidationField, string>>;

interface MemberValidationValues {
  firstName: string;
  middleName?: string;
  lastName: string;
  gender?: string;
  membershipStatus?: string;
  email?: string;
  mobile?: string;
  birthday?: string;
  requireBirthday?: boolean;
}

export function validateMemberDetails(values: MemberValidationValues): MemberValidationErrors {
  const errors: MemberValidationErrors = {};
  const names = [["firstName", "First name", values.firstName], ["middleName", "Middle name", values.middleName ?? ""], ["lastName", "Last name", values.lastName]] as const;

  for (const [field, label, value] of names) {
    if (!value.trim() && field !== "middleName") errors[field] = `${label} is required.`;
    else if (value.trim() && !NAME_PATTERN.test(value.trim())) errors[field] = `${label} may contain only letters, spaces, apostrophes, and hyphens.`;
  }
  if (values.gender !== undefined && !values.gender) errors.gender = "Gender is required.";
  if (values.membershipStatus !== undefined && !values.membershipStatus) errors.membershipStatus = "Membership status is required.";
  if (values.email?.trim() && !EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a complete email address such as name@example.com.";
  if (values.mobile?.trim() && !PHONE_PATTERN.test(values.mobile.trim())) errors.mobile = "Enter a Philippine mobile number as 09xxxxxxxxx or +639xxxxxxxxx.";
  if (values.requireBirthday && !values.birthday) errors.birthday = "Birthday is required.";
  if (values.birthday) {
    const today = new Date(); today.setHours(0,0,0,0);
    const birthday = new Date(`${values.birthday}T00:00:00`);
    if (Number.isNaN(birthday.getTime()) || birthday >= today) errors.birthday = "Birthday must be earlier than today.";
  }
  return errors;
}

export function yesterdayDateInputValue() {
  const date = new Date(); date.setDate(date.getDate()-1); return date.toISOString().slice(0,10);
}
