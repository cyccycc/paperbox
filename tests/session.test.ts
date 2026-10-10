import assert from "node:assert/strict";
import test from "node:test";
import { sessionCookieOptions } from "../src/lib/session";

function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

test("session cookie is Secure only when COOKIE_SECURE=true", () => {
  const previousSecure = process.env.COOKIE_SECURE;
  const previousNodeEnv = process.env.NODE_ENV;

  try {
    setNodeEnv("production");
    delete process.env.COOKIE_SECURE;

    const unset = sessionCookieOptions();
    assert.equal(unset.httpOnly, true);
    assert.equal(unset.sameSite, "lax");
    assert.equal(unset.secure, false);
    assert.equal(unset.path, "/");

    process.env.COOKIE_SECURE = "false";
    assert.equal(sessionCookieOptions().secure, false);

    process.env.COOKIE_SECURE = "TRUE";
    assert.equal(sessionCookieOptions().secure, false);

    process.env.COOKIE_SECURE = "true";
    assert.equal(sessionCookieOptions().secure, true);
    assert.equal(sessionCookieOptions().httpOnly, true);
    assert.equal(sessionCookieOptions().sameSite, "lax");
  } finally {
    if (previousSecure === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = previousSecure;
    setNodeEnv(previousNodeEnv);
  }
});
