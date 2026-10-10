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

export function sessionCookieOptions(maxAge = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
