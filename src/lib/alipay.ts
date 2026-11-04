import { createHash } from "node:crypto";
import { AlipaySdk } from "alipay-sdk";
import type { PrismaClient } from "@prisma/client";
import {
  ALIPAY_NOTIFY_PATH,
  ALIPAY_RETURN_PATH,
  formatAlipayAmount,
  isConfiguredGatewayUrl,
  isMobileAlipayClient,
  parseAlipayAmount,
  readAlipayMerchantConfig,
  resolveAlipayHttpsUrl,
  type AlipayMerchantConfig,
} from "./alipay-config";
import { sameOriginLocation } from "./request-origin";
import { settleOrder, type OrderResult } from "./quota";

export type PayableOrder = {
  id: string;
  credits: number;
  amountCents: number;
  channel: string;
};

export type AlipayNotice =
  | {
      ok: true;
      settle: boolean;
      orderId: string;
      amountCents: number;
      tradeNo: string | null;
      tradeStatus: string | null;
    }
  | { ok: false; reason: string };

const PAID_STATUS = new Set(["TRADE_SUCCESS", "TRADE_FINISHED"]);
const QUIET_STATUS = new Set(["WAIT_BUYER_PAY", "TRADE_CLOSED"]);
const sdkCache = new Map<string, AlipaySdk>();

function sdkFor(config: AlipayMerchantConfig): AlipaySdk {
  const fingerprint = createHash("sha256")
    .update(config.appId)
    .update("\0")
    .update(config.keyType)
    .update("\0")
    .update(config.gateway)
    .update("\0")
    .update(config.privateKey)
    .update("\0")
    .update(config.alipayPublicKey)
    .digest("hex");
  const cached = sdkCache.get(fingerprint);
  if (cached) return cached;
  const sdk = new AlipaySdk({
    appId: config.appId,
    privateKey: config.privateKey,
    alipayPublicKey: config.alipayPublicKey,
    gateway: config.gateway,
    keyType: config.keyType,
    signType: "RSA2",
    timeout: 8000,
  });
  sdkCache.set(fingerprint, sdk);
  return sdk;
}

function logAlipayError(error: unknown): void {
  const message = error instanceof Error ? error.message : "";
  if (!message || message.length > 300 || /PRIVATE KEY|BEGIN [A-Z ]*KEY/.test(message)) {
    console.error("alipay checkout failed");
    return;
  }
  console.error("alipay checkout failed", message);
}

export function alipayCheckoutUrl(
  request: Request,
  order: PayableOrder,
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; url: string } | { ok: false; error: string; status: number } {
  if (order.channel !== "alipay") {
    return { ok: false, error: "这笔订单不是支付宝在线支付。", status: 400 };
  }
  const config = readAlipayMerchantConfig(env);
  if (!config) return { ok: false, error: "支付宝在线支付未开启。", status: 400 };
  if (!/^[A-Za-z0-9_]{1,64}$/.test(order.id)) {
    return { ok: false, error: "订单号不正确。", status: 400 };
  }

  const notifyUrl = resolveAlipayHttpsUrl(env.ALIPAY_NOTIFY_URL, request, ALIPAY_NOTIFY_PATH, env);
  if (!notifyUrl) {
    return { ok: false, error: "支付宝通知地址必须是 https。", status: 503 };
  }
  const returnUrl = resolveAlipayHttpsUrl(env.ALIPAY_RETURN_URL, request, ALIPAY_RETURN_PATH, env);
  const totalAmount = formatAlipayAmount(order.amountCents);
  if (!totalAmount || !Number.isInteger(order.credits) || order.credits < 1) {
    return { ok: false, error: "订单金额不正确。", status: 400 };
  }

  const mobile = isMobileAlipayClient(request.headers.get("user-agent"));
  const method = mobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
  const bizContent: Record<string, string> = {
    out_trade_no: order.id,
    product_code: mobile ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY",
    subject: `纸匣 ${order.credits} 次`,
    total_amount: totalAmount,
    timeout_express: "30m",
  };
  if (mobile) {
    const quitUrl = resolveAlipayHttpsUrl(undefined, request, "/billing", env);
    if (quitUrl) bizContent.quit_url = quitUrl;
  }

  try {
    const url = sdkFor(config).pageExecute(method, "GET", {
      bizContent,
      notifyUrl,
      ...(returnUrl ? { returnUrl } : {}),
    });
    if (!isConfiguredGatewayUrl(url, config.gateway)) {
      return { ok: false, error: "支付宝暂时不可用，请稍后再试。", status: 503 };
    }
    return { ok: true, url };
  } catch (error) {
    logAlipayError(error);
    return { ok: false, error: "支付宝暂时不可用，请稍后再试。", status: 503 };
  }
}

export function readAlipayParams(search: URLSearchParams): Record<string, string> | null {
  const params: Record<string, string> = Object.create(null) as Record<string, string>;
  let count = 0;
  for (const [key, value] of search) {
    count += 1;
    if (count > 50) return null;
    if (!/^[A-Za-z0-9_]+$/.test(key) || key.length > 64) return null;
    if (value.length > 12_000) return null;
    if (value === "") continue;
    params[key] = value;
  }
  return params;
}

export async function readAlipayBody(request: Request): Promise<Record<string, string> | null> {
  const text = await request.text();
  if (text.length > 32_000) return null;
  return readAlipayParams(new URLSearchParams(text));
}

export function decideAlipayNotice(
  params: Record<string, string>,
  config: AlipayMerchantConfig,
  source: "notify" | "return",
): AlipayNotice {
  if (params.charset && params.charset.toLowerCase() !== "utf-8") return { ok: false, reason: "charset" };
  if (params.sign_type && params.sign_type !== "RSA2") return { ok: false, reason: "sign-type" };

  let signed = false;
  try {
    signed = sdkFor(config).checkNotifySignV2(params);
  } catch {
    signed = false;
  }
  if (!signed) return { ok: false, reason: "sign" };
  if (params.app_id !== config.appId) return { ok: false, reason: "app-id" };
  if (params.auth_app_id && params.auth_app_id !== config.appId) return { ok: false, reason: "app-id" };
  if (config.sellerId && params.seller_id !== config.sellerId) return { ok: false, reason: "seller" };

  const orderId = params.out_trade_no ?? "";
  if (!/^[A-Za-z0-9_]{1,64}$/.test(orderId)) return { ok: false, reason: "order" };
  const amountCents = parseAlipayAmount(params.total_amount ?? "");
  if (amountCents === null) return { ok: false, reason: "amount" };

  const tradeNo = params.trade_no?.trim() || null;
  if (tradeNo && !/^[0-9A-Za-z]{1,64}$/.test(tradeNo)) return { ok: false, reason: "trade-no" };
  const tradeStatus = params.trade_status?.trim() || null;
  if (tradeStatus && !/^[A-Z_]{1,32}$/.test(tradeStatus)) return { ok: false, reason: "status" };

  if (source === "notify") {
    if (params.notify_type && params.notify_type !== "trade_status_sync") {
      return { ok: false, reason: "notify-type" };
    }
    if (!tradeStatus) return { ok: false, reason: "status" };
    if (PAID_STATUS.has(tradeStatus)) {
      return { ok: true, settle: true, orderId, amountCents, tradeNo, tradeStatus };
    }
    if (QUIET_STATUS.has(tradeStatus)) {
      return { ok: true, settle: false, orderId, amountCents, tradeNo, tradeStatus };
    }
    return { ok: false, reason: "status" };
  }

  if (
    params.method &&
    params.method !== "alipay.trade.page.pay.return" &&
    params.method !== "alipay.trade.wap.pay.return"
  ) {
    return { ok: false, reason: "method" };
  }
  const settle = Boolean((tradeStatus && PAID_STATUS.has(tradeStatus)) || (!tradeStatus && tradeNo));
  return { ok: true, settle, orderId, amountCents, tradeNo, tradeStatus };
}

export async function fulfillAlipayOrder(
  db: PrismaClient,
  input: { orderId: string; amountCents: number; tradeNo?: string | null },
): Promise<OrderResult> {
  const order = await db.order.findUnique({ where: { id: input.orderId } });
  if (!order) return { ok: false, error: "找不到订单。", status: 404 };
  if (order.channel !== "alipay") return { ok: false, error: "这笔订单不是支付宝在线支付。", status: 400 };
  if (order.amountCents !== input.amountCents) {
    return { ok: false, error: "支付金额与订单不一致。", status: 400 };
  }
  return settleOrder(db, {
    orderId: order.id,
    action: "mark_paid",
    providerTradeNo: input.tradeNo ?? undefined,
    ledgerNote: "支付宝支付",
  });
}

function plain(body: "success" | "failure"): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function handleAlipayNotify(
  db: PrismaClient,
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Response> {
  const config = readAlipayMerchantConfig(env);
  if (!config || request.method !== "POST") return plain("failure");
  const params = await readAlipayBody(request);
  if (!params) return plain("failure");
  const decision = decideAlipayNotice(params, config, "notify");
  if (!decision.ok) {
    console.error("alipay notify rejected", decision.reason);
    return plain("failure");
  }
  if (!decision.settle) {
    console.info("alipay notify skipped", decision.orderId, decision.tradeStatus);
    return plain("success");
  }
  const settled = await fulfillAlipayOrder(db, {
    orderId: decision.orderId,
    amountCents: decision.amountCents,
    tradeNo: decision.tradeNo,
  });
  if (!settled.ok) {
    console.error("alipay notify settle failed", decision.orderId, settled.status);
    return plain("failure");
  }
  console.info("alipay notify paid", decision.orderId);
  return plain("success");
}

function redirectTo(request: Request, pathname: string, env: NodeJS.ProcessEnv): Response {
  const location = sameOriginLocation(request, pathname, env);
  return new Response(null, {
    status: 303,
    headers: { Location: location, "cache-control": "no-store" },
  });
}

export async function handleAlipayReturn(
  db: PrismaClient,
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Response> {
  const fail = (code: "invalid" | "pending") => redirectTo(request, `/billing?alipay=${code}`, env);
  if (request.method !== "GET") return fail("invalid");
  const config = readAlipayMerchantConfig(env);
  if (!config) return fail("invalid");
  const params = readAlipayParams(new URL(request.url).searchParams);
  if (!params) return fail("invalid");
  const decision = decideAlipayNotice(params, config, "return");
  if (!decision.ok || !decision.settle) return fail(decision.ok ? "pending" : "invalid");
  const settled = await fulfillAlipayOrder(db, {
    orderId: decision.orderId,
    amountCents: decision.amountCents,
    tradeNo: decision.tradeNo,
  });
  if (!settled.ok) return fail(settled.status >= 500 ? "pending" : "invalid");
  return redirectTo(request, "/billing?paid=1", env);
}

export async function discardPendingOrder(db: PrismaClient, orderId: string): Promise<void> {
  await db.order.deleteMany({ where: { id: orderId, status: "pending", claimedAt: null } });
}
