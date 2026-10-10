const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validateCredentials(email: string, password: string): string | null {
  if (!EMAIL_RE.test(email) || email.length > 200) return "请输入有效的邮箱。";
  if (password.length < 8) return "密码至少 8 位。";
  if (password.length > 72) return "密码不能超过 72 位。";
  return null;
}
