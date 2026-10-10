import { NextResponse } from "next/server";
import { toBillingOrder } from "@/lib/billing";
import { getSession } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { createPendingOrder } from "@/lib/quota";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: { packId?: unknown; channel?: unknown };
  try {
    body = (await request.json()) as { packId?: unknown; channel?: unknown };
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const created = await createPendingOrder(prisma, {
    userId: session.uid,
    packId: typeof body.packId === "string" ? body.packId : "",
    channel: typeof body.channel === "string" ? body.channel : "",
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });

  return NextResponse.json({
    message: created.message,
    order: toBillingOrder(created.order),
  });
}
