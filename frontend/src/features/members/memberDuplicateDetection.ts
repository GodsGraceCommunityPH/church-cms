/** Canonical comparison value for Philippine mobile formats, without changing stored display text. */
export function normalizeMemberMobile(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12 && digits[2] === "9") return digits;
  if (digits.startsWith("09") && digits.length === 11) return `63${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 10) return `63${digits}`;
  return digits;
}

export function normalizeMemberName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[\u2010-\u2015-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

export type MemberDuplicateKind = "likely_same_person" | "possible_shared_contact";

export function classifyMemberDuplicate(
  payload: { first_name: string; last_name: string; mobile: string | null },
  member: { firstName: string; lastName: string; mobile: string },
): MemberDuplicateKind | null {
  const sameSurname = normalizeMemberName(member.lastName) === normalizeMemberName(payload.last_name);
  const sameMobile = Boolean(normalizeMemberMobile(payload.mobile)) &&
    normalizeMemberMobile(member.mobile) === normalizeMemberMobile(payload.mobile);
  const candidateFirst = normalizeMemberName(member.firstName);
  const submittedFirst = normalizeMemberName(payload.first_name);
  const likelyName = Boolean(candidateFirst && submittedFirst) &&
    candidateFirst.split(" ")[0] === submittedFirst.split(" ")[0] &&
    (candidateFirst === submittedFirst || candidateFirst.startsWith(`${submittedFirst} `) || submittedFirst.startsWith(`${candidateFirst} `));
  if (sameSurname && likelyName) return "likely_same_person";
  if (sameMobile) return "possible_shared_contact";
  return null;
}
