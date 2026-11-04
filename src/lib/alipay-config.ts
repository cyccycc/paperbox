import { isAlipayCheckoutUrl } from "./alipay-public";
import { sameOriginLocation } from "./request-origin";

export const ALIPAY_PRODUCTION_GATEWAY = "https://openapi.alipay.com/gateway.do";
export const ALIPAY_SANDBOX_GATEWAY = "https://openapi-sandbox.dl.alipaydev.com/gateway.do";
export const ALIPAY_NOTIFY_PATH = "/api/billing/alipay/notify";
export const ALIPAY_RETURN_PATH = "/api/billing/alipay/return";
export const ALIPAY_CHECKOUT_MESSAGE = "正在打开支付宝。支付成功后次数会自动到账。";

const ALLOWED_GATEWAYS = new Set([ALIPAY_PRODUCTION_GATEWAY, ALIPAY_SANDBOX_GATEWAY]);

export type AlipayKeyType = "PKCS1" | "PKCS8";

export type AlipayMerchantConfig = {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  gateway: string;
  keyType: AlipayKeyType;
  sellerId: string | null;
};

let warned = false;

function warnInvalidConfig(): void {
  if (warned) return;
  warned = true;
  console.error(
    "支付宝收银台未启用：请检查 ALIPAY_APP_ID、ALIPAY_PRIVATE_KEY、ALIPAY_PUBLIC_KEY、ALIPAY_GATEWAY、ALIPAY_SELLER_ID。不要把密钥写进仓库。",
  );
}

export function normalizeAlipaySecret(value: string): string {
  return value.trim().replace(/\\n/g, "\n").replace(/\r/g, "");
}

function detectKeyType(privateKey: string, requested: string | undefined): AlipayKeyType | null {
  if (privateKey.includes("BEGIN RSA PRIVATE KEY")) return "PKCS1";
  if (privateKey.includes("BEGIN PRIVATE KEY")) return "PKCS8";
  const pick = (requested ?? "PKCS8").trim().toUpperCase();
  if (pick === "PKCS1" || pick === "PKCS8") return pick;
  return null;
}

export function readAlipayMerchantConfig(
  env: Record<string, string | undefined> = process.env,
): AlipayMerchantConfig | null {
  const appId = (env.ALIPAY_APP_ID ?? "").trim();
  const privateKey = normalizeAlipaySecret(env.ALIPAY_PRIVATE_KEY ?? "");
  const alipayPublicKey = normalizeAlipaySecret(env.ALIPAY_PUBLIC_KEY ?? "");
  const gatewayRaw = (env.ALIPAY_GATEWAY ?? "").trim();
  const sellerRaw = (env.ALIPAY_SELLER_ID ?? "").trim();
  const attempted = Boolean(
    appId || privateKey || alipayPublicKey || sellerRaw || (gatewayRaw && gatewayRaw !== ALIPAY_PRODUCTION_GATEWAY),
  );

  const gateway = gatewayRaw || ALIPAY_PRODUCTION_GATEWAY;
  const keyType = detectKeyType(privateKey, env.ALIPAY_PRIVATE_KEY_TYPE);
  let sellerId: string | null = null;
  if (sellerRaw) {
    if (!/^2088\d{12}$/.test(sellerRaw)) {
      if (attempted) warnInvalidConfig();
      return null;
    }
    sellerId = sellerRaw;
  }

  const usable =
    /^\d{16}$/.test(appId) &&
    privateKey.length >= 200 &&
    alipayPublicKey.length >= 80 &&
    ALLOWED_GATEWAYS.has(gateway) &&
    keyType !== null;

  if (!usable) {
    if (attempted) warnInvalidConfig();
    return null;
  }

  return { appId, privateKey, alipayPublicKey, gateway, keyType, sellerId };
}

export function alipayMerchantConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return readAlipayMerchantConfig(env) !== null;
}

/** Yuan string Alipay expects, from the order's amountCents. */
export function formatAlipayAmount(amountCents: number): string | null {
  if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > 100_000_000_00) return null;
  const yuan = Math.floor(amountCents / 100);
  const frac = String(amountCents % 100).padStart(2, "0");
  return `${yuan}.${frac}`;
}

export function parseAlipayAmount(value: string): number | null {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, frac = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 1) return null;
  return cents;
}

export function isMobileAlipayClient(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").slice(0, 300);
  return /Android|webOS|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(ua);
}

function httpsUrl(value: string): string | null {
  if (!value || value.length > 256 || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Explicit https override wins. An invalid override is not replaced with the request host.
 * An empty override uses this request's public https origin plus pathname.
 */
export function resolveAlipayHttpsUrl(
  override: string | undefined,
  request: Request,
  pathname: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const trimmed = (override ?? "").trim();
  if (trimmed) return httpsUrl(trimmed);
  let location: string;
  try {
    location = sameOriginLocation(request, pathname, env);
  } catch {
    return null;
  }
  if (!location.startsWith("https://")) return null;
  return httpsUrl(location);
}

export function isConfiguredGatewayUrl(value: string, gateway: string): boolean {
  if (!isAlipayCheckoutUrl(value)) return false;
  try {
    const url = new URL(value);
    const expected = new URL(gateway);
    if (url.origin !== expected.origin) return false;
    const method = url.searchParams.get("method");
    return method === "alipay.trade.page.pay" || method === "alipay.trade.wap.pay";
  } catch {
    return false;
  }
}
