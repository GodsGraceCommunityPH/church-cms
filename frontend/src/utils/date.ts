export function formatDate(dateString: string): string {
  if (!dateString) return "—";

  return new Date(dateString).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function calculateAge(dateString: string): string {
  if (!dateString) return "—";

  const birthday = new Date(dateString);
  const today = new Date();

  let age = today.getFullYear() - birthday.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() &&
      today.getDate() >= birthday.getDate());

  if (!hasHadBirthdayThisYear) {
    age--;
  }

  return `${age} years old`;
}
