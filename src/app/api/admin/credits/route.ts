import { NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { grantCredits, settleOrder } from "@/lib/quota";

export const runtime = "nodejs";

type AdminBody = {
  email?: unknown;
  credits?: unknown;
  note?: unknown;
  orderId?: unknown;
  action?: unknown;
};

export async function POST(request: Request) {
  const secret = process.env.ADMIN_GRANT_SECRET;
  if (!secret?.trim()) {
    return NextResponse.json({ error: "未开启额度发放。" }, { status: 404 });
  }
  if (!adminAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "无权操作。" }, { status: 401 });
  }

  let body: AdminBody;
  try {
    body = (await request.json()) as AdminBody;
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  if (typeof body.orderId === "string" || typeof body.action === "string") {
    const settled = await settleOrder(prisma, {
      orderId: typeof body.orderId === "string" ? body.orderId : "",
      action: typeof body.action === "string" ? body.action : "",
    });
    if (!settled.ok) return NextResponse.json({ error: settled.error }, { status: settled.status });
    return NextResponse.json({
      ok: true,
      orderId: settled.orderId,
      status: settled.status,
      credits: settled.credits,
    });
  }

  if (typeof body.email !== "string" || typeof body.credits !== "number") {
    return NextResponse.json({ error: "请提供邮箱和整数次数，或提供订单号与 action。" }, { status: 400 });
  }

  const granted = await grantCredits(prisma, {
    email: body.email,
    delta: body.credits,
    note: typeof body.note === "string" ? body.note : undefined,
  });
  if (!granted.ok) return NextResponse.json({ error: granted.error }, { status: granted.status });
  return NextResponse.json({ ok: true, email: granted.email, credits: granted.credits });
}
