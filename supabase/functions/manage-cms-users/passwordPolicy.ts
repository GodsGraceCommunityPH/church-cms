export const passwordValidationError = (password: string): string | null =>
  password.length === 0 || (password.length >= 6 && password.length <= 128)
    ? null
    : "Password must be 6–128 characters.";
