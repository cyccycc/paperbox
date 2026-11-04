import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createSign, generateKeyPairSync } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { findPack } from "../src/lib/billing";
import {
  ALIPAY_PRODUCTION_GATEWAY,
  ALIPAY_SANDBOX_GATEWAY,
  alipayMerchantConfigured,
  formatAlipayAmount,
  parseAlipayAmount,
  readAlipayMerchantConfig,
} from "../src/lib/alipay-config";
import { isAlipayCheckoutUrl } from "../src/lib/alipay-public";
import {
  alipayCheckoutUrl,
  decideAlipayNotice,
  handleAlipayNotify,
  handleAlipayReturn,
} from "../src/lib/alipay";

const APP_ID = "2021000000000001";
const SELLER_ID = "2088000000000000";
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const pkcs1 = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

function merchantEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ALIPAY_APP_ID: APP_ID,
    ALIPAY_PRIVATE_KEY: privateKey,
    ALIPAY_PUBLIC_KEY: publicKey,
    ...extra,
  };
}

function pemBody(pem: string): string {
  return pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
}

function signNotice(params: Record<string, string>, key = privateKey): Record<string, string> {
  const signed: Record<string, string> = { ...params, sign_type: "RSA2" };
  const content = Object.keys(signed)
    .filter((name) => name !== "sign" && signed[name] !== "")
    .sort()
    .map((name) => `${name}=${signed[name]}`)
    .join("&");
  const sign = createSign("RSA-SHA256").update(content, "utf8").sign(key, "base64");
  return { ...signed, sign };
}

function siteRequest(pathname: string, userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"): Request {
  return new Request(`https://paper.cyccycc.xyz${pathname}`, {
    headers: {
      host: "paper.cyccycc.xyz",
      "x-forwarded-proto": "https",
      "user-agent": userAgent,
    },
  });
}

function requirePack(id: "50" | "200") {
  const pack = findPack(id);
  if (!pack) throw new Error(`missing pack ${id}`);
  return pack;
}

const pack50 = requirePack("50");
const pack200 = requirePack("200");

test("alipay amount formatting follows the existing packs", () => {
  assert.equal(formatAlipayAmount(pack50.amountCents), "29.00");
  assert.equal(formatAlipayAmount(pack200.amountCents), "99.00");
  assert.equal(parseAlipayAmount("29.00"), pack50.amountCents);
  assert.equal(parseAlipayAmount("29"), pack50.amountCents);
  assert.equal(parseAlipayAmount("29.0"), pack50.amountCents);
  assert.equal(parseAlipayAmount("99.00"), pack200.amountCents);
  assert.equal(parseAlipayAmount("29.001"), null);
  assert.equal(parseAlipayAmount("0"), null);
  assert.equal(parseAlipayAmount("0.00"), null);
  assert.equal(parseAlipayAmount("-1"), null);
  assert.equal(parseAlipayAmount("29.00 "), null);
  assert.equal(formatAlipayAmount(0), null);
});

test("merchant checkout stays off unless app id, keys, and gateway are usable", () => {
  assert.equal(alipayMerchantConfigured({}), false);
  assert.equal(alipayMerchantConfigured({ ALIPAY_APP_ID: APP_ID }), false);
  assert.equal(readAlipayMerchantConfig(merchantEnv({ ALIPAY_GATEWAY: "https://evil.example/gateway.do" })), null);
  assert.equal(readAlipayMerchantConfig(merchantEnv({ ALIPAY_APP_ID: "not-an-appid" })), null);
  assert.equal(readAlipayMerchantConfig(merchantEnv({ ALIPAY_SELLER_ID: "123" })), null);
  assert.equal(readAlipayMerchantConfig(merchantEnv())?.gateway, ALIPAY_PRODUCTION_GATEWAY);
  assert.equal(readAlipayMerchantConfig(merchantEnv({ ALIPAY_GATEWAY: "" }))?.gateway, ALIPAY_PRODUCTION_GATEWAY);
  assert.equal(readAlipayMerchantConfig(merchantEnv({ ALIPAY_GATEWAY: ALIPAY_SANDBOX_GATEWAY }))?.gateway, ALIPAY_SANDBOX_GATEWAY);
  assert.equal(readAlipayMerchantConfig(merchantEnv())?.keyType, "PKCS8");
  assert.equal(readAlipayMerchantConfig(merchantEnv())?.sellerId, null);
  assert.equal(readAlipayMerchantConfig(merchantEnv({ ALIPAY_SELLER_ID: SELLER_ID }))?.sellerId, SELLER_ID);
  assert.equal(
    readAlipayMerchantConfig(
      merchantEnv({
        ALIPAY_PRIVATE_KEY: pkcs1.privateKey,
        ALIPAY_PUBLIC_KEY: pkcs1.publicKey,
        ALIPAY_PRIVATE_KEY_TYPE: "PKCS8",
      }),
    )?.keyType,
    "PKCS1",
  );
  assert.equal(isAlipayCheckoutUrl("https://openapi.alipay.com/gateway.do?method=alipay.trade.page.pay"), true);
  assert.equal(isAlipayCheckoutUrl("https://user:pass@openapi.alipay.com/gateway.do"), false);
  assert.equal(isAlipayCheckoutUrl("https://evil.example/gateway.do"), false);
  assert.equal(isAlipayCheckoutUrl("javascript:alert(1)"), false);
});

test("desktop checkout uses page.pay and mobile checkout uses wap.pay", () => {
  const order = {
    id: "c1234567890order",
    credits: pack50.credits,
    amountCents: pack50.amountCents,
    channel: "alipay" as const,
  };
  const desktop = alipayCheckoutUrl(siteRequest("/api/billing/orders"), order, merchantEnv());
  assert.equal(desktop.ok, true);
  if (!desktop.ok) return;
  const pageUrl = new URL(desktop.url);
  assert.equal(pageUrl.origin + pageUrl.pathname, ALIPAY_PRODUCTION_GATEWAY);
  assert.equal(pageUrl.searchParams.get("method"), "alipay.trade.page.pay");
  assert.equal(pageUrl.searchParams.get("app_id"), APP_ID);
  assert.equal(pageUrl.searchParams.get("notify_url"), "https://paper.cyccycc.xyz/api/billing/alipay/notify");
  assert.equal(pageUrl.searchParams.get("return_url"), "https://paper.cyccycc.xyz/api/billing/alipay/return");
  const pageBiz = JSON.parse(pageUrl.searchParams.get("biz_content") ?? "{}") as {
    out_trade_no?: string;
    product_code?: string;
    total_amount?: string;
    subject?: string;
  };
  assert.equal(pageBiz.out_trade_no, order.id);
  assert.equal(pageBiz.product_code, "FAST_INSTANT_TRADE_PAY");
  assert.equal(pageBiz.total_amount, formatAlipayAmount(pack50.amountCents));
  assert.equal(pageBiz.subject, `纸匣 ${pack50.credits} 次`);

  const phone = alipayCheckoutUrl(
    siteRequest("/api/billing/orders", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile"),
    { ...order, credits: pack200.credits, amountCents: pack200.amountCents },
    merchantEnv({ ALIPAY_GATEWAY: ALIPAY_SANDBOX_GATEWAY }),
  );
  assert.equal(phone.ok, true);
  if (!phone.ok) return;
  const wapUrl = new URL(phone.url);
  assert.equal(wapUrl.origin + wapUrl.pathname, ALIPAY_SANDBOX_GATEWAY);
  assert.equal(wapUrl.searchParams.get("method"), "alipay.trade.wap.pay");
  const wapBiz = JSON.parse(wapUrl.searchParams.get("biz_content") ?? "{}") as {
    product_code?: string;
    total_amount?: string;
    quit_url?: string;
  };
  assert.equal(wapBiz.product_code, "QUICK_WAP_WAY");
  assert.equal(wapBiz.total_amount, formatAlipayAmount(pack200.amountCents));
  assert.equal(wapBiz.quit_url, "https://paper.cyccycc.xyz/billing");
});

test("checkout accepts a one-line key and refuses a non-https notify URL", () => {
  const order = {
    id: "corderkey0001",
    credits: pack50.credits,
    amountCents: pack50.amountCents,
    channel: "alipay" as const,
  };
  const bare = alipayCheckoutUrl(
    siteRequest("/api/billing/orders"),
    order,
    merchantEnv({
      ALIPAY_PRIVATE_KEY: pemBody(privateKey),
      ALIPAY_PUBLIC_KEY: pemBody(publicKey),
    }),
  );
  assert.equal(bare.ok, true);

  const escaped = alipayCheckoutUrl(
    siteRequest("/api/billing/orders"),
    order,
    merchantEnv({ ALIPAY_PRIVATE_KEY: privateKey.replace(/\n/g, "\\n") }),
  );
  assert.equal(escaped.ok, true);

  const local = new Request("http://localhost:3000/api/billing/orders", {
    headers: { host: "localhost:3000", "x-forwarded-proto": "http" },
  });
  const missingNotify = alipayCheckoutUrl(local, order, merchantEnv());
  assert.equal(missingNotify.ok, false);
  if (!missingNotify.ok) assert.equal(missingNotify.status, 503);

  const httpNotify = alipayCheckoutUrl(
    local,
    order,
    merchantEnv({ ALIPAY_NOTIFY_URL: "http://paper.cyccycc.xyz/api/billing/alipay/notify" }),
  );
  assert.equal(httpNotify.ok, false);

  const override = alipayCheckoutUrl(
    local,
    order,
    merchantEnv({ ALIPAY_NOTIFY_URL: "https://paper.cyccycc.xyz/api/billing/alipay/notify" }),
  );
  assert.equal(override.ok, true);
  if (override.ok) {
    assert.equal(
      new URL(override.url).searchParams.get("notify_url"),
      "https://paper.cyccycc.xyz/api/billing/alipay/notify",
    );
  }

  const off = alipayCheckoutUrl(siteRequest("/api/billing/orders"), order, { NODE_ENV: "test" });
  assert.equal(off.ok, false);
  if (!off.ok) assert.match(off.error, /未开启/);

  const wechat = alipayCheckoutUrl(siteRequest("/api/billing/orders"), { ...order, channel: "wechat" }, merchantEnv());
  assert.equal(wechat.ok, false);
});

const dir = mkdtempSync(path.join(tmpdir(), "paperbox-alipay-"));
const databaseUrl = `file:${path.join(dir, "test.db")}`;
const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = databaseUrl;
process.env.AUTH_SECRET ??= "paperbox-test-secret";

const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
execFileSync(prismaBin, ["db", "push", "--skip-generate", "--accept-data-loss"], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: ["ignore", "pipe", "pipe"],
});

let prisma: import("@prisma/client").PrismaClient;
let createPendingOrder: typeof import("../src/lib/quota").createPendingOrder;
let createUserWithFreeQuota: typeof import("../src/lib/quota").createUserWithFreeQuota;
let settleOrder: typeof import("../src/lib/quota").settleOrder;

test.before(async () => {
  const db = await import("../src/lib/db");
  const quota = await import("../src/lib/quota");
  prisma = db.prisma;
  createPendingOrder = quota.createPendingOrder;
  createUserWithFreeQuota = quota.createUserWithFreeQuota;
  settleOrder = quota.settleOrder;
});

test.after(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

function noticeFor(order: { id: string; amountCents: number }, extra: Record<string, string> = {}) {
  return signNotice({
    app_id: APP_ID,
    auth_app_id: APP_ID,
    charset: "utf-8",
    out_trade_no: order.id,
    total_amount: formatAlipayAmount(order.amountCents) ?? "",
    trade_no: "2024110400000000000000000001",
    trade_status: "TRADE_SUCCESS",
    seller_id: SELLER_ID,
    notify_type: "trade_status_sync",
    subject: `纸匣 ${pack50.credits} 次`,
    ...extra,
  });
}

async function makeUser(email: string, credits: number) {
  const user = await createUserWithFreeQuota(prisma, { email, passwordHash: "not-used" });
  return prisma.user.update({ where: { id: user.id }, data: { credits } });
}

test.describe("alipay settlement", { concurrency: 1 }, () => {
  test("notify and return grant the pack once", async () => {
    const user = await makeUser("alipay-paid@example.com", 3);
    const created = await createPendingOrder(prisma, { userId: user.id, packId: "50", channel: "alipay" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.match(created.message, /我已付款/);

    const env = merchantEnv({ ALIPAY_SELLER_ID: SELLER_ID });
    const config = readAlipayMerchantConfig(env);
    assert.ok(config);
    const signed = noticeFor(created.order);
    const roundTrip = Object.fromEntries(new URLSearchParams(new URLSearchParams(signed).toString()));
    const decision = decideAlipayNotice(roundTrip, config, "notify");
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.equal(decision.settle, true);
    assert.equal(decision.amountCents, created.order.amountCents);

    const notify = await handleAlipayNotify(
      prisma,
      new Request("https://paper.cyccycc.xyz/api/billing/alipay/notify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(signed).toString(),
      }),
      env,
    );
    assert.equal(notify.status, 200);
    assert.equal(await notify.text(), "success");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 3 + created.order.credits);
    const ledger = await prisma.creditLedger.findMany({ where: { orderId: created.order.id } });
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]?.delta, created.order.credits);
    assert.equal(ledger[0]?.note, "支付宝支付");
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: created.order.id } });
    assert.equal(stored.status, "paid");
    assert.equal(stored.providerTradeNo, "2024110400000000000000000001");

    const again = await handleAlipayNotify(
      prisma,
      new Request("https://paper.cyccycc.xyz/api/billing/alipay/notify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(signed).toString(),
      }),
      env,
    );
    assert.equal(await again.text(), "success");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 3 + created.order.credits);

    const other = await makeUser("alipay-return@example.com", 1);
    const second = await createPendingOrder(prisma, { userId: other.id, packId: "200", channel: "alipay" });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    const { notify_type: _notifyType, trade_status: _status, ...returnFields } = noticeFor(second.order, {
      trade_no: "2024110400000000000000000002",
      method: "alipay.trade.page.pay.return",
    });
    void _notifyType;
    void _status;
    const returnParams = signNotice(returnFields);
    const returnResponse = await handleAlipayReturn(
      prisma,
      new Request(`https://paper.cyccycc.xyz/api/billing/alipay/return?${new URLSearchParams(returnParams).toString()}`, {
        headers: { host: "paper.cyccycc.xyz", "x-forwarded-proto": "https" },
      }),
      env,
    );
    assert.equal(returnResponse.status, 303);
    assert.equal(returnResponse.headers.get("location"), "https://paper.cyccycc.xyz/billing?paid=1");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).credits, 1 + second.order.credits);

    const repeat = await handleAlipayNotify(
      prisma,
      new Request("https://paper.cyccycc.xyz/api/billing/alipay/notify", {
        method: "POST",
        body: new URLSearchParams(
          noticeFor(second.order, { trade_no: "2024110400000000000000000002", trade_status: "TRADE_FINISHED" }),
        ).toString(),
      }),
      env,
    );
    assert.equal(await repeat.text(), "success");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).credits, 1 + second.order.credits);
    const manual = await settleOrder(prisma, { orderId: second.order.id, action: "mark_paid" });
    assert.equal(manual.ok && manual.credits, 1 + second.order.credits);
  });

  test("bad signatures, amount mismatches, and non-alipay orders do not grant credits", async () => {
    const user = await makeUser("alipay-reject@example.com", 4);
    const created = await createPendingOrder(prisma, { userId: user.id, packId: "50", channel: "alipay" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const wechat = await createPendingOrder(prisma, { userId: user.id, packId: "50", channel: "wechat" });
    assert.equal(wechat.ok, true);
    if (!wechat.ok) return;
    const env = merchantEnv({ ALIPAY_SELLER_ID: SELLER_ID });

    const tampered = noticeFor(created.order, {
      total_amount: formatAlipayAmount(pack200.amountCents) ?? "",
    });
    const badAmount = await handleAlipayNotify(
      prisma,
      new Request("https://paper.cyccycc.xyz/api/billing/alipay/notify", {
        method: "POST",
        body: new URLSearchParams(tampered).toString(),
      }),
      env,
    );
    assert.equal(await badAmount.text(), "failure");

    const otherKey = signNotice(noticeFor(created.order), pkcs1.privateKey);
    const forged = await handleAlipayNotify(
      prisma,
      new Request("https://paper.cyccycc.xyz/api/billing/alipay/notify", {
        method: "POST",
        body: new URLSearchParams(otherKey).toString(),
      }),
      env,
    );
    assert.equal(await forged.text(), "failure");

    const wrongApp = await handleAlipayNotify(
      prisma,
      new Request("https://paper.cyccycc.xyz/api/billing/alipay/notify", {
        method: "POST",
        body: new URLSearchParams(signNotice({ ...noticeFor(created.order), app_id: "2021000000000002" })).toString(),
      }),
      env,
    );
    assert.equal(await wrongApp.text(), "failure");

    const wrongSeller = signNotice({ ...noticeFor(created.order), seller_id: "2088000000000009" });
    const seller = await handleAlipayNotify(
      prisma,
      new Request("https://paper.cyccycc.xyz/api/billing/alipay/notify", {
        method: "POST",
        body: new URLSearchParams(wrongSeller).toString(),
      }),
      env,
    );
    assert.equal(await seller.text(), "failure");

    const closed = await handleAlipayNotify(
      prisma,
      new Request("https://paper.cyccycc.xyz/api/billing/alipay/notify", {
        method: "POST",
        body: new URLSearchParams(noticeFor(created.order, { trade_status: "TRADE_CLOSED" })).toString(),
      }),
      env,
    );
    assert.equal(await closed.text(), "success");

    const wrongChannel = await handleAlipayNotify(
      prisma,
      new Request("https://paper.cyccycc.xyz/api/billing/alipay/notify", {
        method: "POST",
        body: new URLSearchParams(noticeFor(wechat.order)).toString(),
      }),
      env,
    );
    assert.equal(await wrongChannel.text(), "failure");

    const pendingReturn = signNotice({
      app_id: APP_ID,
      out_trade_no: created.order.id,
      total_amount: formatAlipayAmount(created.order.amountCents) ?? "",
      trade_status: "WAIT_BUYER_PAY",
      seller_id: SELLER_ID,
      method: "alipay.trade.wap.pay.return",
    });
    const waiting = await handleAlipayReturn(
      prisma,
      new Request(`https://paper.cyccycc.xyz/api/billing/alipay/return?${new URLSearchParams(pendingReturn).toString()}`, {
        headers: { host: "paper.cyccycc.xyz", "x-forwarded-proto": "https" },
      }),
      env,
    );
    assert.equal(waiting.headers.get("location"), "https://paper.cyccycc.xyz/billing?alipay=pending");

    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 4);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: created.order.id } })).status, "pending");
  });

  test("admin mark_paid still uses the original ledger note", async () => {
    const user = await makeUser("alipay-admin@example.com", 2);
    const created = await createPendingOrder(prisma, { userId: user.id, packId: "50", channel: "wechat" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const paid = await settleOrder(prisma, { orderId: created.order.id, action: "mark_paid" });
    assert.equal(paid.ok, true);
    const ledger = await prisma.creditLedger.findFirstOrThrow({ where: { orderId: created.order.id } });
    assert.equal(ledger.note, "订单标记为已支付");
    assert.equal(ledger.delta, created.order.credits);
  });
});

test("alipay notify and return are not behind login", async () => {
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("../src/middleware");
  const notify = await middleware(
    new NextRequest("https://paper.cyccycc.xyz/api/billing/alipay/notify", { method: "POST" }),
  );
  const back = await middleware(new NextRequest("https://paper.cyccycc.xyz/api/billing/alipay/return"));
  const orders = await middleware(new NextRequest("https://paper.cyccycc.xyz/api/billing/orders", { method: "POST" }));
  assert.equal(notify.status, 200);
  assert.equal(back.status, 200);
  assert.equal(orders.status, 401);
});
