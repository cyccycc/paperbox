export const DEFAULT_FREE_QUOTA = 10;
export const MAX_FREE_QUOTA = 100_000;

export const QUOTA_EXHAUSTED_CODE = "quota_exhausted" as const;
export const QUOTA_EXHAUSTED_MESSAGE = "额度已用完，请购买额度后再继续。";
export const PAYMENT_COMING_SOON = "支付通道即将开通";

export const ORDER_PENDING = "pending";
export const ORDER_PAID = "paid";
export const ORDER_CANCELLED = "cancelled";

export const CREDIT_PACKS = [
  {
    id: "50",
    credits: 50,
    amountCents: 2900,
    title: "50 次",
    price: "¥29",
    hint: "参考价，不会真实扣款。适合偶尔整理发票、合同或简历。",
  },
  {
    id: "200",
    credits: 200,
    amountCents: 9900,
    title: "200 次",
    price: "¥99",
    hint: "参考价，不会真实扣款。适合一次处理一批文档。",
  },
] as const;

export type CreditPack = (typeof CREDIT_PACKS)[number];
export type PayChannel = "wechat" | "alipay";

export type BillingOrder = {
  id: string;
  packId: string;
  credits: number;
  amountCents: number;
  channel: string;
  status: string;
  createdAt: string;
};

export function freeQuota(env: { FREE_QUOTA?: string | undefined } = process.env): number {
  const raw = (env.FREE_QUOTA ?? "").trim();
  if (!/^\d+$/.test(raw)) return DEFAULT_FREE_QUOTA;
  const value = Number(raw);
  if (value > MAX_FREE_QUOTA) return DEFAULT_FREE_QUOTA;
  return value;
}

export function findPack(id: string): CreditPack | null {
  return CREDIT_PACKS.find((pack) => pack.id === id) ?? null;
}

export function isPayChannel(value: string): value is PayChannel {
  return value === "wechat" || value === "alipay";
}

export function channelLabel(channel: string): string {
  if (channel === "wechat") return "微信支付";
  if (channel === "alipay") return "支付宝";
  return channel;
}

export function orderStatusLabel(status: string): string {
  if (status === ORDER_PENDING) return "待支付";
  if (status === ORDER_PAID) return "已支付";
  if (status === ORDER_CANCELLED) return "已取消";
  return status;
}

export function formatCny(amountCents: number): string {
  const yuan = amountCents / 100;
  const text = Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2);
  return `¥${text}`;
}

export function formatShanghai(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function toBillingOrder(order: {
  id: string;
  packId: string;
  credits: number;
  amountCents: number;
  channel: string;
  status: string;
  createdAt: Date | string;
}): BillingOrder {
  return {
    id: order.id,
    packId: order.packId,
    credits: order.credits,
    amountCents: order.amountCents,
    channel: order.channel,
    status: order.status,
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
  };
}
