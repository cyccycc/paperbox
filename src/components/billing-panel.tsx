"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  channelLabel,
  CREDIT_PACKS,
  formatCny,
  formatShanghai,
  isPayChannel,
  orderStatusLabel,
  type BillingOrder,
  type CreditPack,
  type PayChannel,
} from "@/lib/billing";

const CHANNELS: PayChannel[] = ["wechat", "alipay"];

function payName(channel: string): string {
  if (channel === "wechat") return "微信";
  if (channel === "alipay") return "支付宝";
  return channelLabel(channel);
}

function choiceLabel(channel: PayChannel): string {
  if (channel === "wechat") return "微信支付";
  return "支付宝支付";
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
  const [rows, setRows] = useState(orders);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [choosingPackId, setChoosingPackId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [broken, setBroken] = useState<Partial<Record<PayChannel, boolean>>>({});
  const payRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const active = rows.find((order) => order.id === activeId) ?? null;
  const channels = CHANNELS.filter((channel) => qr[channel]);
  const activeChannel = active && isPayChannel(active.channel) ? active.channel : null;
  const choosingPack = CREDIT_PACKS.find((pack) => pack.id === choosingPackId) ?? null;
  const activeQr = activeChannel ? qr[activeChannel] : null;

  useEffect(() => {
    if (!activeId) return;
    payRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeId]);

  useEffect(() => {
    if (!choosingPackId) return;
    const button = dialogRef.current?.querySelector("button");
    if (button instanceof HTMLButtonElement) button.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setChoosingPackId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choosingPackId]);

  function focusOrder(order: BillingOrder) {
    setActiveId(order.id);
    setNote(order.note ?? "");
    setError("");
    setChoosingPackId(null);
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
    setChoosingPackId(null);
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
        。点「购买」，选择微信支付或支付宝，再扫该渠道的收款码。金额请手动输入，然后点「我已付款」。核对前不会增加额度。
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

      <div className="grid gap-4 md:grid-cols-2">
        {CREDIT_PACKS.map((pack) => {
          const busy = pending.startsWith(`${pack.id}:`);
          return (
            <article key={pack.id} className="sheet rounded-2xl p-5">
              <p className="text-xs text-ink-soft">次数包 · {pack.price}</p>
              <h2 className="mt-1 font-serif text-4xl">{pack.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{pack.hint}</p>
              {channels.length === 0 ? (
                <p className="mt-5 text-sm text-ink-soft">收款码未配置</p>
              ) : (
                <button
                  className="mt-5 rounded-full bg-seal px-4 py-2 text-sm text-white hover:bg-seal-deep disabled:opacity-60"
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => {
                    setError("");
                    setChoosingPackId(pack.id);
                  }}
                >
                  {busy ? "正在创建…" : "购买"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {active ? (
        <section ref={payRef} id="pay" className="sheet rounded-2xl p-5">
          <h2 className="font-serif text-2xl">扫码付款</h2>
          <div className="mt-2 text-sm leading-6 text-ink-soft">
            <p>
              请用{activeChannel ? choiceLabel(activeChannel) : payName(active.channel)}，金额{" "}
              <span className="font-medium text-ink">{formatCny(active.amountCents)}</span>
              。这是个人收款码，金额需要自己填写。
            </p>
            <p className="mt-1">
              订单号 <span className="font-medium text-ink">{active.id}</span>
              。付款时如能备注，请写末 6 位 {active.id.slice(-6)}。
            </p>
          </div>
          {activeQr && activeChannel ? (
            broken[activeChannel] ? (
              <p className="mt-4 flex h-52 w-52 items-center justify-center rounded-xl border border-line bg-white p-4 text-sm text-warn">
                收款码图片打不开
              </p>
            ) : (
              <figure className="mt-4 space-y-2">
                {/* Operator-configured host is not known at build time. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeQr}
                  alt={`${payName(activeChannel)}收款码`}
                  width={208}
                  height={208}
                  referrerPolicy="no-referrer"
                  onError={() => setBroken((current) => ({ ...current, [activeChannel]: true }))}
                  className="h-52 w-52 max-w-full rounded-xl border border-line bg-white object-contain p-2"
                />
                <figcaption className="text-sm text-ink-soft">{payName(activeChannel)}收款码</figcaption>
              </figure>
            )
          ) : (
            <p className="mt-4 text-sm text-warn">这个渠道的收款码还没配置。</p>
          )}
          {active.status === "pending" ? (
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
      ) : null}

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

      {choosingPack ? (
        <ChannelDialog
          dialogRef={dialogRef}
          pack={choosingPack}
          channels={channels}
          pending={pending}
          onClose={() => {
            if (!pending) setChoosingPackId(null);
          }}
          onPick={(channel) => buy(choosingPack.id, channel)}
        />
      ) : null}
    </div>
  );
}

function ChannelDialog({
  dialogRef,
  pack,
  channels,
  pending,
  onClose,
  onPick,
}: {
  dialogRef: RefObject<HTMLDivElement | null>;
  pack: CreditPack;
  channels: PayChannel[];
  pending: string;
  onClose: () => void;
  onPick: (channel: PayChannel) => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-5" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-channel-title"
        className="sheet w-full max-w-md rounded-2xl p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="pay-channel-title" className="font-serif text-2xl">
          选择支付方式
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          {pack.title} · {pack.price}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {channels.map((channel) => {
            const busy = pending === `${pack.id}:${channel}`;
            return (
              <button
                key={channel}
                className="rounded-full bg-seal px-4 py-2 text-sm text-white hover:bg-seal-deep disabled:opacity-60"
                type="button"
                disabled={Boolean(pending)}
                onClick={() => onPick(channel)}
              >
                {busy ? "正在创建…" : choiceLabel(channel)}
              </button>
            );
          })}
        </div>
        <button
          className="mt-4 rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-seal hover:text-seal disabled:opacity-60"
          type="button"
          disabled={Boolean(pending)}
          onClick={onClose}
        >
          取消
        </button>
      </div>
    </div>
  );
}
