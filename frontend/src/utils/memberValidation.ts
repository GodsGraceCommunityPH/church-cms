const NAME_PATTERN = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE_PATTERN = /^(?:09\d{9}|\+639\d{9})$/;

export function validateMemberDetails(values: { firstName: string; middleName?: string; lastName: string; email?: string; mobile?: string; birthday?: string }) {
  const names = [["First name", values.firstName], ["Middle name", values.middleName ?? ""], ["Last name", values.lastName]] as const;
  for (const [label, value] of names) if (value.trim() && !NAME_PATTERN.test(value.trim())) return `${label} may contain only letters, spaces, apostrophes, and hyphens.`;
  if (values.email?.trim() && !EMAIL_PATTERN.test(values.email.trim())) return "Enter a complete email address such as name@example.com.";
  if (values.mobile?.trim() && !PHONE_PATTERN.test(values.mobile.trim())) return "Enter a Philippine mobile number as 09xxxxxxxxx or +639xxxxxxxxx.";
  if (values.birthday) {
    const today = new Date(); today.setHours(0,0,0,0);
    const birthday = new Date(`${values.birthday}T00:00:00`);
    if (birthday >= today) return "Birthday must be earlier than today.";
  }
  return "";
}

export function yesterdayDateInputValue() {
  const date = new Date(); date.setDate(date.getDate()-1); return date.toISOString().slice(0,10);
}
