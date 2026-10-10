import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeEmail, validateCredentials } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createUserWithFreeQuota } from "@/lib/quota";
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
  const invalid = validateCredentials(email, password);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const user = await createUserWithFreeQuota(prisma, {
      email,
      passwordHash: await hashPassword(password),
    });
    const token = await signSession({ uid: user.id, email: user.email });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, sessionCookieOptions());
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "该邮箱已注册。" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "注册失败，请稍后再试。" }, { status: 500 });
  }
}
