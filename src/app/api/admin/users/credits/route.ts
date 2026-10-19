import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { setCredits } from "@/lib/quota";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await adminFromRequest(request);
  if (!admin.ok) {
    const error = admin.status === 401 ? "请先登录" : "没有找到。";
    return NextResponse.json({ error }, { status: admin.status });
  }

  let body: { userId?: unknown; credits?: unknown };
  try {
    body = (await request.json()) as { userId?: unknown; credits?: unknown };
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  if (typeof body.userId !== "string" || typeof body.credits !== "number") {
    return NextResponse.json({ error: "请提供用户和整数额度。" }, { status: 400 });
  }

  const result = await setCredits(prisma, { userId: body.userId, credits: body.credits });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, email: result.email, credits: result.credits });
}
