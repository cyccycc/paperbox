import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeEmail, validateLogin } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { sessionCookieOptions, SESSION_COOKIE, signSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const invalid = validateLogin(email, password);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  const matched = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !matched) {
    return NextResponse.json({ error: "邮箱或密码不正确。" }, { status: 401 });
  }

  const token = await signSession({ uid: user.id, email: user.email });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  return NextResponse.json({ ok: true });
}
