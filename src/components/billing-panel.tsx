"use client";

import { useState } from "react";
import {
  channelLabel,
  CREDIT_PACKS,
  formatCny,
  formatShanghai,
  orderStatusLabel,
  PAYMENT_COMING_SOON,
  type BillingOrder,
} from "@/lib/billing";

export function BillingPanel({ credits, orders }: { credits: number; orders: BillingOrder[] }) {
  const [rows, setRows] = useState(orders);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  async function buy(packId: string, channel: string) {
    setError("");
    setNotice("");
    setPending(`${packId}:${channel}`);
    const response = await fetch("/api/billing/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId, channel }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { message?: string; error?: string; order?: BillingOrder }
      | null;
    setPending("");
    if (response.status === 401) {
      window.location.href = "/login?next=/billing";
      return;
    }
    if (!response.ok || !payload?.order) {
      setError(payload?.error || "创建订单失败，请稍后再试。");
      return;
    }
    setNotice(payload.message || PAYMENT_COMING_SOON);
    setRows((current) => [payload.order as BillingOrder, ...current]);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">
        当前剩余 <span className="font-medium text-ink">{credits} 次</span>
        。点微信支付或支付宝只会记下待支付订单，不会打开真实收银台，也不会增加额度。
      </p>
      {notice ? (
        <div className="rounded-xl bg-moss-soft px-4 py-3 text-sm text-moss" role="status">
          <p className="font-medium">{notice}</p>
          <p className="mt-1">订单状态是待支付。支付通道开通前不会扣款，额度也不会变化。</p>
        </div>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {CREDIT_PACKS.map((pack) => (
          <article key={pack.id} className="sheet rounded-2xl p-5">
            <p className="text-xs text-ink-soft">次数包 · 参考价 {pack.price}</p>
            <h2 className="mt-1 font-serif text-4xl">{pack.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{pack.hint}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(["wechat", "alipay"] as const).map((channel) => {
                const busy = pending === `${pack.id}:${channel}`;
                return (
                  <button
                    key={channel}
                    className="rounded-full bg-seal px-4 py-2 text-sm text-white hover:bg-seal-deep disabled:opacity-60"
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => buy(pack.id, channel)}
                  >
                    {busy ? "正在创建…" : channelLabel(channel)}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      <section>
        <h2 className="font-serif text-2xl">最近的订单</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">还没有订单。</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-sheet">
            {rows.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="mr-2 font-medium">{order.credits} 次</span>
                  <span className="text-ink-soft">
                    {channelLabel(order.channel)} · {formatCny(order.amountCents)}
                  </span>
                </span>
                <span className="text-ink-soft">
                  {orderStatusLabel(order.status)} · {formatShanghai(order.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
