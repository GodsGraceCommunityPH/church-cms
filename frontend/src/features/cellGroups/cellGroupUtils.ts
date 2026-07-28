export function generateInviteToken() {
  return crypto.randomUUID().replace(/-/g, "");
}
