import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEmail, validateCredentials, validateLogin } from "../src/lib/accounts";
import { config } from "../src/middleware";

test("registration still requires an email", () => {
  assert.equal(validateCredentials("9999", "longenough"), "请输入有效的邮箱。");
  assert.equal(validateCredentials("user@example.com", "longenough"), null);
  assert.equal(validateCredentials("user@example.com", "short"), "密码至少 8 位。");
});

test("login accepts the seeded operator id", () => {
  assert.equal(normalizeEmail(" 9999 "), "9999");
  assert.equal(validateLogin("9999", "longenough"), null);
  assert.equal(validateLogin("9999", "short"), "密码至少 8 位。");
  assert.equal(validateLogin("nope", "longenough"), "请输入有效的邮箱。");
  assert.equal(validateLogin("user@example.com", "longenough"), null);
});

test("admin pages require a session", () => {
  assert.ok(config.matcher.includes("/admin"));
  assert.ok(config.matcher.includes("/admin/:path*"));
});
