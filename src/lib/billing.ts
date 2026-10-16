export const DEFAULT_FREE_QUOTA = 10;
export const MAX_FREE_QUOTA = 100_000;

export const QUOTA_EXHAUSTED_CODE = "quota_exhausted" as const;
export const QUOTA_EXHAUSTED_MESSAGE = "额度已用完，请购买额度后再继续。";
export const PAYMENT_SCAN_MESSAGE = "请扫码付款，然后点「我已付款」。核对到账后才会增加额度。";
export const PAYMENT_CLAIMED_MESSAGE = "已记下。核对到账后才会增加额度。";

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
    hint: "适合偶尔整理发票、合同或简历。",
  },
  {
    id: "200",
    credits: 200,
    amountCents: 9900,
    title: "200 次",
    price: "¥99",
    hint: "适合一次处理一批文档。",
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
  note: string | null;
  claimedAt: string | null;
  createdAt: string;
};

const QR_ENV: Record<PayChannel, "PAYMENT_ALIPAY_QR_URL" | "PAYMENT_WECHAT_QR_URL"> = {
  alipay: "PAYMENT_ALIPAY_QR_URL",
  wechat: "PAYMENT_WECHAT_QR_URL",
};

/** Personal collection QR. Accepts a site path or an http(s) image URL. */
export function paymentQrUrl(
  channel: PayChannel,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = (env[QR_ENV[channel]] ?? "").trim();
  if (!raw || raw.length > 500 || /\s/.test(raw)) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    if (raw.includes("..") || raw.includes("\\")) return null;
    if (!/^\/[A-Za-z0-9._~/-]+$/.test(raw)) return null;
    return raw;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return raw;
  } catch {
    return null;
  }
}

export function paymentQrMap(
  env: Record<string, string | undefined> = process.env,
): Record<PayChannel, string | null> {
  return {
    alipay: paymentQrUrl("alipay", env),
    wechat: paymentQrUrl("wechat", env),
  };
}

export function freeQuota(env: Record<string, string | undefined> = process.env): number {
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

export function orderStatusLabel(status: string, claimed = false): string {
  if (status === ORDER_PENDING) return claimed ? "待核对" : "待支付";
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
  note?: string | null;
  claimedAt?: Date | string | null;
  createdAt: Date | string;
}): BillingOrder {
  const claimedAt = order.claimedAt instanceof Date ? order.claimedAt.toISOString() : order.claimedAt || null;
  return {
    id: order.id,
    packId: order.packId,
    credits: order.credits,
    amountCents: order.amountCents,
    channel: order.channel,
    status: order.status,
    note: order.note ?? null,
    claimedAt,
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
  };
}
