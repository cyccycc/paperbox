import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE, type SessionPayload } from "./session";

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
}

export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/login") || value.startsWith("/register")) return "/dashboard";
  return value;
}
