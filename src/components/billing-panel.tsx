"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  channelLabel,
  CREDIT_PACKS,
  formatCny,
  formatShanghai,
  isPayChannel,
  orderStatusLabel,
  type BillingOrder,
  type PayChannel,
} from "@/lib/billing";

const CHANNELS: PayChannel[] = ["alipay", "wechat"];

function payName(channel: string): string {
  if (channel === "wechat") return "微信";
  if (channel === "alipay") return "支付宝";
  return channelLabel(channel);
}

export function BillingPanel({
  credits,
  orders,
  qr,
}: {
  credits: number;
  orders: BillingOrder[];
  qr: Record<PayChannel, string | null>;
}) {
  const initial = orders.find((order) => order.status === "pending") ?? null;
  const [rows, setRows] = useState(orders);
  const [activeId, setActiveId] = useState<string | null>(initial?.id ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [broken, setBroken] = useState<Partial<Record<PayChannel, boolean>>>({});
  const payRef = useRef<HTMLElement>(null);

  const active = rows.find((order) => order.id === activeId) ?? null;
  const channels = CHANNELS.filter((channel) => qr[channel]);
  const activeChannel = active && isPayChannel(active.channel) ? active.channel : null;

  function focusOrder(order: BillingOrder) {
    setActiveId(order.id);
    setNote(order.note ?? "");
    setError("");
    payRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function buy(packId: string, channel: PayChannel) {
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
    setNotice(payload.message || "订单已创建。");
    setRows((current) => [payload.order as BillingOrder, ...current]);
    focusOrder(payload.order);
  }

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    setError("");
    setNotice("");
    setPending(`claim:${active.id}`);
    const response = await fetch(`/api/billing/orders/${active.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
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
      setError(payload?.error || "提交失败，请稍后再试。");
      return;
    }
    setNotice(payload.message || "已记下。核对到账后才会增加额度。");
    setNote(payload.order.note ?? "");
    setRows((current) => current.map((row) => (row.id === payload.order?.id ? payload.order : row)));
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-ink-soft">
        当前剩余 <span className="font-medium text-ink">{credits} 次</span>
        。选择次数包后扫个人收款码，金额请手动输入，再点「我已付款」。核对前不会增加额度。
      </p>
      {notice ? (
        <p className="rounded-xl bg-moss-soft px-4 py-3 text-sm text-moss" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn" role="alert">
          {error}
        </p>
      ) : null}

      <section ref={payRef} id="pay" className="sheet rounded-2xl p-5">
        <h2 className="font-serif text-2xl">扫码付款</h2>
        {channels.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-ink-soft">收款码还没准备好，暂时不能付款。</p>
        ) : active ? (
          <div className="mt-2 text-sm leading-6 text-ink-soft">
            <p>
              请用{payName(active.channel)}支付{" "}
              <span className="font-medium text-ink">{formatCny(active.amountCents)}</span>
              。这是个人收款码，金额需要自己填写，不会打开商户收银台。
            </p>
            <p className="mt-1">
              订单号 <span className="font-medium text-ink">{active.id}</span>
              。付款时如能备注，请写末 6 位 {active.id.slice(-6)}。
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            先选择下方次数包。收款码不含金额，请按订单金额手动付款。
          </p>
        )}
        {channels.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-6">
            {channels.map((channel) => {
              const src = qr[channel];
              if (!src) return null;
              const selected = activeChannel === channel;
              return (
                <figure key={channel} className="space-y-2">
                  {broken[channel] ? (
                    <p className="flex h-52 w-52 items-center justify-center rounded-xl border border-line bg-white p-4 text-sm text-warn">
                      收款码图片打不开
                    </p>
                  ) : (
                    // Operator-configured host is not known at build time.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={`${payName(channel)}收款码`}
                      width={208}
                      height={208}
                      referrerPolicy="no-referrer"
                      onError={() => setBroken((current) => ({ ...current, [channel]: true }))}
                      className={`h-52 w-52 max-w-full rounded-xl border bg-white object-contain p-2 ${
                        selected ? "border-seal ring-2 ring-seal" : "border-line"
                      }`}
                    />
                  )}
                  <figcaption className="text-sm text-ink-soft">
                    {payName(channel)}收款码
                    {selected ? " · 本单" : ""}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        ) : null}
        {active && active.status === "pending" ? (
          <form onSubmit={claim} className="mt-5 max-w-md space-y-3">
            <label className="block text-sm" htmlFor="payment-note">
              付款备注
              <input
                id="payment-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={200}
                autoComplete="off"
                placeholder="例如：支付宝张三，今天 10:20"
                className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none focus:border-seal"
              />
            </label>
            <button
              className="rounded-full bg-seal px-4 py-2 text-sm text-white hover:bg-seal-deep disabled:opacity-60"
              type="submit"
              disabled={Boolean(pending)}
            >
              {pending === `claim:${active.id}` ? "正在提交…" : "我已付款"}
            </button>
            {active.claimedAt ? <p className="text-sm text-moss">已提交，等待核对。额度还没加上。</p> : null}
          </form>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {CREDIT_PACKS.map((pack) => (
          <article key={pack.id} className="sheet rounded-2xl p-5">
            <p className="text-xs text-ink-soft">次数包 · {pack.price}</p>
            <h2 className="mt-1 font-serif text-4xl">{pack.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{pack.hint}</p>
            {channels.length === 0 ? (
              <p className="mt-5 text-sm text-ink-soft">收款码未配置</p>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                {channels.map((channel) => {
                  const busy = pending === `${pack.id}:${channel}`;
                  return (
                    <button
                      key={channel}
                      className="rounded-full bg-seal px-4 py-2 text-sm text-white hover:bg-seal-deep disabled:opacity-60"
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => buy(pack.id, channel)}
                    >
                      {busy ? "正在创建…" : `${payName(channel)}收款码`}
                    </button>
                  );
                })}
              </div>
            )}
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
                    {channelLabel(order.channel)} · {formatCny(order.amountCents)} · {order.id.slice(-6)}
                  </span>
                  {order.note ? <span className="mt-1 block max-w-md truncate text-ink-soft">备注：{order.note}</span> : null}
                </span>
                <span className="flex flex-wrap items-center gap-3 text-ink-soft">
                  <span>
                    {orderStatusLabel(order.status, Boolean(order.claimedAt))} · {formatShanghai(order.createdAt)}
                  </span>
                  {order.status === "pending" ? (
                    <button
                      type="button"
                      className="rounded-full border border-line bg-white px-3 py-1 text-ink hover:border-seal hover:text-seal"
                      onClick={() => focusOrder(order)}
                    >
                      查看收款码
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
