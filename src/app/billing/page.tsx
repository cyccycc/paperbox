import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingPanel } from "@/components/billing-panel";
import { paymentQrMap, toBillingOrder } from "@/lib/billing";
import { getSession } from "@/lib/current-user";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "购买额度" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/billing");

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { credits: true },
  });
  if (!user) redirect("/login");

  const orders = await prisma.order.findMany({
    where: { userId: session.uid },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-8 pt-2">
      <div>
        <p className="text-sm text-ink-soft">
          <Link className="hover:text-seal" href="/dashboard">
            工作台
          </Link>
          <span> / 购买额度</span>
        </p>
        <h1 className="mt-2 font-serif text-4xl">购买额度</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          选择 50 次或 200 次，扫支付宝或微信收款码付款。付完点「我已付款」，核对后次数才会到账。
        </p>
      </div>
      <BillingPanel credits={user.credits} orders={orders.map((order) => toBillingOrder(order))} qr={paymentQrMap()} />
    </div>
  );
}
