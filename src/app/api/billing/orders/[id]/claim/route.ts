import { NextResponse } from "next/server";
import { toBillingOrder } from "@/lib/billing";
import { getSession } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { claimOrderPayment } from "@/lib/quota";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await context.params;

  let body: { note?: unknown };
  try {
    body = (await request.json()) as { note?: unknown };
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const claimed = await claimOrderPayment(prisma, {
    userId: session.uid,
    orderId: id,
    note: typeof body.note === "string" ? body.note : "",
  });
  if (!claimed.ok) return NextResponse.json({ error: claimed.error }, { status: claimed.status });
  return NextResponse.json({ message: claimed.message, order: toBillingOrder(claimed.order) });
}
