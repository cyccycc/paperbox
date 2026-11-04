import { NextResponse } from "next/server";
import { alipayCheckoutUrl } from "@/lib/alipay";
import { ALIPAY_CHECKOUT_MESSAGE } from "@/lib/alipay-config";
import { ORDER_PENDING } from "@/lib/billing";
import { getSession } from "@/lib/current-user";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await context.params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== session.uid) {
    return NextResponse.json({ error: "找不到订单。" }, { status: 404 });
  }
  if (order.channel !== "alipay") {
    return NextResponse.json({ error: "这笔订单不是支付宝在线支付。" }, { status: 400 });
  }
  if (order.status !== ORDER_PENDING) {
    return NextResponse.json({ error: "这笔订单已经处理过了。" }, { status: 400 });
  }

  const pay = alipayCheckoutUrl(request, order);
  if (!pay.ok) return NextResponse.json({ error: pay.error }, { status: pay.status });
  return NextResponse.json({ message: ALIPAY_CHECKOUT_MESSAGE, payUrl: pay.url });
}
