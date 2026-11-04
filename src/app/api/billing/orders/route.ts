import { NextResponse } from "next/server";
import { alipayCheckoutUrl, discardPendingOrder } from "@/lib/alipay";
import { ALIPAY_CHECKOUT_MESSAGE, alipayMerchantConfigured } from "@/lib/alipay-config";
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

  if (created.order.channel === "alipay" && alipayMerchantConfigured()) {
    const pay = alipayCheckoutUrl(request, created.order);
    if (!pay.ok) {
      await discardPendingOrder(prisma, created.order.id);
      return NextResponse.json({ error: pay.error }, { status: pay.status });
    }
    return NextResponse.json({
      message: ALIPAY_CHECKOUT_MESSAGE,
      order: toBillingOrder(created.order),
      payUrl: pay.url,
    });
  }

  return NextResponse.json({
    message: created.message,
    order: toBillingOrder(created.order),
  });
}
