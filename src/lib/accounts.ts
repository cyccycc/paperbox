const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Operator login stored in User.email. Registration still requires a real email. */
export const ADMIN_LOGIN_ID = "9999";

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isEmailAddress(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 200;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "密码至少 8 位。";
  if (password.length > 72) return "密码不能超过 72 位。";
  return null;
}

export function validateCredentials(email: string, password: string): string | null {
  if (!isEmailAddress(email)) return "请输入有效的邮箱。";
  return validatePassword(password);
}

/** Login accepts a normal email, or the seeded operator id `9999`. */
export function validateLogin(identifier: string, password: string): string | null {
  if (identifier !== ADMIN_LOGIN_ID && !isEmailAddress(identifier)) return "请输入有效的邮箱。";
  return validatePassword(password);
}
