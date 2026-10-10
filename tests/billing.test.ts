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
  PAYMENT_COMING_SOON,
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

test("packs are 50 and 200 with placeholder channels", () => {
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
  assert.equal(PAYMENT_COMING_SOON, "支付通道即将开通");
  assert.match(QUOTA_EXHAUSTED_MESSAGE, /购买额度/);
});

test("admin grant secret must match the bearer token", () => {
  assert.equal(adminAuthorized(null, ""), false);
  assert.equal(adminAuthorized("Bearer secret", ""), false);
  assert.equal(adminAuthorized("Bearer secret", "secret"), true);
  assert.equal(adminAuthorized("bearer secret", "secret"), true);
  assert.equal(adminAuthorized("Bearer other", "secret"), false);
  assert.equal(adminAuthorized("secret", "secret"), false);
});
