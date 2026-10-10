import { timingSafeEqual } from "node:crypto";

export function secretsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function bearerToken(authorization: string | null): string {
  if (!authorization) return "";
  const match = /^Bearer\s+(\S.*)$/i.exec(authorization.trim());
  return match?.[1]?.trim() ?? "";
}

export function adminAuthorized(authorization: string | null, secret: string | undefined): boolean {
  const expected = secret?.trim() ?? "";
  if (!expected) return false;
  return secretsMatch(bearerToken(authorization), expected);
}
