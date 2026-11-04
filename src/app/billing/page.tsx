import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingPanel } from "@/components/billing-panel";
import { alipayMerchantConfigured } from "@/lib/alipay-config";
import { offeredPayChannels, paymentQrMap, toBillingOrder } from "@/lib/billing";
import { getSession } from "@/lib/current-user";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "购买额度" };
export const dynamic = "force-dynamic";

function checkoutBanner(query: { paid?: string; alipay?: string }): string {
  if (query.paid === "1") return "如果刚才完成了支付，次数已经加上。请以页面上的剩余次数为准。";
  if (query.alipay === "pending") return "如果刚才没有付完，次数不会变化。付完后刷新即可。";
  if (query.alipay === "invalid") {
    return "没能核对支付宝返回的结果。次数是否增加，以页面上的剩余次数为准。已经扣款但数字没变时，请勿重复支付。";
  }
  return "";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; alipay?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/billing");
  const query = await searchParams;

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

  const qr = paymentQrMap();
  const alipayOnline = alipayMerchantConfigured();
  const showWechat = offeredPayChannels(qr, alipayOnline).includes("wechat");

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
          {alipayOnline
            ? showWechat
              ? "选择 50 次或 200 次。支付宝会打开收银台，付完次数自动到账。微信支付仍是个人收款码，付完要点「我已付款」，核对后才会增加额度。"
              : "选择 50 次或 200 次。点「购买」后打开支付宝收银台，付完次数自动到账。"
            : showWechat
              ? "选择 50 次或 200 次，点「购买」后选择微信支付或支付宝。付完点「我已付款」，核对后次数才会到账。"
              : "选择 50 次或 200 次，点「购买」后扫支付宝收款码。付完点「我已付款」，核对后次数才会到账。"}
        </p>
      </div>
      <BillingPanel
        credits={user.credits}
        orders={orders.map((order) => toBillingOrder(order))}
        qr={qr}
        alipayOnline={alipayOnline}
        banner={checkoutBanner(query)}
      />
    </div>
  );
}
