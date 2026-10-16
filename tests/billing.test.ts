import assert from "node:assert/strict";
import test from "node:test";
import { adminAuthorized } from "../src/lib/admin-auth";
import {
  CREDIT_PACKS,
  channelLabel,
  findPack,
  formatCny,
  freeQuota,
  isPayChannel,
  orderStatusLabel,
  paymentQrUrl,
  PAYMENT_SCAN_MESSAGE,
  QUOTA_EXHAUSTED_MESSAGE,
} from "../src/lib/billing";

test("free quota defaults to 10 and accepts a non-negative integer", () => {
  assert.equal(freeQuota({}), 10);
  assert.equal(freeQuota({ FREE_QUOTA: "" }), 10);
  assert.equal(freeQuota({ FREE_QUOTA: "0" }), 0);
  assert.equal(freeQuota({ FREE_QUOTA: "25" }), 25);
  assert.equal(freeQuota({ FREE_QUOTA: " 8 " }), 8);
  assert.equal(freeQuota({ FREE_QUOTA: "-1" }), 10);
  assert.equal(freeQuota({ FREE_QUOTA: "3.5" }), 10);
  assert.equal(freeQuota({ FREE_QUOTA: "nope" }), 10);
  assert.equal(freeQuota({ FREE_QUOTA: "100001" }), 10);
});

test("packs are 50 and 200 with personal QR channels", () => {
  assert.deepEqual(
    CREDIT_PACKS.map((pack) => pack.credits),
    [50, 200],
  );
  assert.equal(findPack("50")?.amountCents, 2900);
  assert.equal(findPack("200")?.title, "200 次");
  assert.equal(findPack("10"), null);
  assert.equal(isPayChannel("wechat"), true);
  assert.equal(isPayChannel("alipay"), true);
  assert.equal(isPayChannel("card"), false);
  assert.equal(channelLabel("wechat"), "微信支付");
  assert.equal(channelLabel("alipay"), "支付宝");
  assert.equal(formatCny(2900), "¥29");
  assert.equal(formatCny(9900), "¥99");
  assert.match(PAYMENT_SCAN_MESSAGE, /我已付款/);
  assert.equal(orderStatusLabel("pending"), "待支付");
  assert.equal(orderStatusLabel("pending", true), "待核对");
  assert.equal(orderStatusLabel("paid", true), "已支付");
  assert.match(QUOTA_EXHAUSTED_MESSAGE, /购买额度/);
});

test("payment QR urls come from env and reject other schemes", () => {
  assert.equal(paymentQrUrl("alipay", {}), null);
  assert.equal(paymentQrUrl("alipay", { PAYMENT_ALIPAY_QR_URL: "   " }), null);
  assert.equal(paymentQrUrl("alipay", { PAYMENT_ALIPAY_QR_URL: "  /pay/alipay.png  " }), "/pay/alipay.png");
  assert.equal(
    paymentQrUrl("wechat", { PAYMENT_WECHAT_QR_URL: "https://cdn.example.com/wx.png" }),
    "https://cdn.example.com/wx.png",
  );
  assert.equal(
    paymentQrUrl("wechat", { PAYMENT_WECHAT_QR_URL: "http://127.0.0.1:3000/pay/wechat.png" }),
    "http://127.0.0.1:3000/pay/wechat.png",
  );
  assert.equal(paymentQrUrl("alipay", { PAYMENT_ALIPAY_QR_URL: "javascript:alert(1)" }), null);
  assert.equal(paymentQrUrl("alipay", { PAYMENT_ALIPAY_QR_URL: "data:image/png;base64,aaaa" }), null);
  assert.equal(paymentQrUrl("alipay", { PAYMENT_ALIPAY_QR_URL: "//evil.example/qr.png" }), null);
  assert.equal(paymentQrUrl("alipay", { PAYMENT_ALIPAY_QR_URL: "/pay/../.env" }), null);
  assert.equal(paymentQrUrl("alipay", { PAYMENT_ALIPAY_QR_URL: "https://user:pass@cdn.example.com/a.png" }), null);
});

test("admin grant secret must match the bearer token", () => {
  assert.equal(adminAuthorized(null, ""), false);
  assert.equal(adminAuthorized("Bearer secret", ""), false);
  assert.equal(adminAuthorized("Bearer secret", "secret"), true);
  assert.equal(adminAuthorized("bearer secret", "secret"), true);
  assert.equal(adminAuthorized("Bearer other", "secret"), false);
  assert.equal(adminAuthorized("secret", "secret"), false);
});
