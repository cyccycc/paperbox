import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "paperbox_session";

export type SessionPayload = {
  uid: string;
  email: string;
};

function secretKey() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.uid)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function readSession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const uid = typeof payload.uid === "string" ? payload.uid : payload.sub;
    if (typeof uid !== "string" || typeof payload.email !== "string") return null;
    return { uid, email: payload.email };
  } catch {
    return null;
  }
}

export function cookieFromHeader(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export function sessionCookieOptions(maxAge = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Browsers drop Secure cookies on plain HTTP. NODE_ENV=production is not
    // HTTPS when the site sits behind an HTTP reverse proxy, so Secure is
    // opt-in: set COOKIE_SECURE=true only after TLS terminates in front.
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge,
  };
}
