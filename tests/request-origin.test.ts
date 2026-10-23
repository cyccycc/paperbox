import assert from "node:assert/strict";
import test from "node:test";
import { sameOriginLocation } from "../src/lib/request-origin";
import { POST } from "../src/app/api/auth/logout/route";
import { SESSION_COOKIE } from "../src/lib/session";

function request(url: string, headers: Record<string, string>) {
  return new Request(url, { method: "POST", headers });
}

const internal = "http://localhost:3000/api/auth/logout";

test("logout redirect uses the public Host, not the listen address", () => {
  const location = sameOriginLocation(
    request(internal, {
      host: "paper.cyccycc.xyz",
      "x-forwarded-proto": "https",
      origin: "https://paper.cyccycc.xyz",
    }),
  );
  assert.equal(location, "https://paper.cyccycc.xyz/");
  assert.equal(location.includes("localhost"), false);
});

test("https Origin wins when the proxy did not set X-Forwarded-Proto", () => {
  const location = sameOriginLocation(
    request(internal, {
      host: "paper.cyccycc.xyz",
      "x-forwarded-proto": "http",
      origin: "https://paper.cyccycc.xyz",
    }),
  );
  assert.equal(location, "https://paper.cyccycc.xyz/");
});

test("explicit http proto stays http for a plain HTTP proxy", () => {
  const location = sameOriginLocation(
    request(internal, {
      host: "paper.cyccycc.xyz",
      "x-forwarded-proto": "http",
      origin: "http://paper.cyccycc.xyz",
    }),
  );
  assert.equal(location, "http://paper.cyccycc.xyz/");
});

test("X-Forwarded-Host is used when Host is the upstream", () => {
  const location = sameOriginLocation(
    request(internal, {
      host: "127.0.0.1:3000",
      "x-forwarded-host": "paper.cyccycc.xyz",
      "x-forwarded-proto": "https, http",
    }),
  );
  assert.equal(location, "https://paper.cyccycc.xyz/");
});

test("a loopback X-Forwarded-Host does not hide the public Host", () => {
  const location = sameOriginLocation(
    request(internal, {
      host: "paper.cyccycc.xyz",
      "x-forwarded-host": "localhost:3000",
      "x-forwarded-proto": "https",
    }),
  );
  assert.equal(location, "https://paper.cyccycc.xyz/");
});

test("a foreign Origin cannot change the redirect host", () => {
  const location = sameOriginLocation(
    request(internal, {
      host: "paper.cyccycc.xyz",
      "x-forwarded-proto": "https",
      origin: "https://evil.example",
    }),
  );
  assert.equal(location, "https://paper.cyccycc.xyz/");
});

test("public Host wins over AUTH_URL", () => {
  const location = sameOriginLocation(
    request(internal, {
      host: "preview.example",
      "x-forwarded-proto": "https",
    }),
    "/",
    { NODE_ENV: "production", AUTH_URL: "https://paper.cyccycc.xyz" },
  );
  assert.equal(location, "https://preview.example/");
});

test("production AUTH_URL is the fallback when every host is loopback", () => {
  const location = sameOriginLocation(
    request(internal, { host: "localhost:3000", "x-forwarded-host": "localhost:3000" }),
    "/",
    { NODE_ENV: "production", AUTH_URL: "https://paper.cyccycc.xyz/" },
  );
  assert.equal(location, "https://paper.cyccycc.xyz/");
});

test("NEXTAUTH_URL is an alias of AUTH_URL", () => {
  const location = sameOriginLocation(
    request(internal, { host: "localhost:3000" }),
    "/",
    { NODE_ENV: "production", NEXTAUTH_URL: "https://paper.cyccycc.xyz" },
  );
  assert.equal(location, "https://paper.cyccycc.xyz/");
});

test("AUTH_URL is ignored outside production and the redirect stays relative", () => {
  const location = sameOriginLocation(
    request(internal, { host: "localhost:3000" }),
    "/",
    { NODE_ENV: "development", AUTH_URL: "https://paper.cyccycc.xyz" },
  );
  assert.equal(location, "/");
});

test("loopback without AUTH_URL does not emit an absolute localhost URL", () => {
  const location = sameOriginLocation(request(internal, { host: "localhost:3000" }), "/", {});
  assert.equal(location, "/");
});

test("unsafe host headers are ignored", () => {
  const headers = new Map<string, string>([
    ["host", "paper.cyccycc.xyz\r\nLocation: https://evil.example"],
    ["x-forwarded-host", "https://evil.example"],
    ["origin", "https://evil.example"],
  ]);
  const location = sameOriginLocation(
    { headers: { get: (name: string) => headers.get(name) ?? null } } as Request,
    "/",
    {},
  );
  assert.equal(location, "/");
});

test("POST /api/auth/logout clears the session and stays on the public origin", async () => {
  const previousSecure = process.env.COOKIE_SECURE;
  process.env.COOKIE_SECURE = "true";
  try {
    const response = await POST(
      request(internal, {
        host: "paper.cyccycc.xyz",
        "x-forwarded-proto": "https",
        origin: "https://paper.cyccycc.xyz",
      }),
    );
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "https://paper.cyccycc.xyz/");
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, new RegExp(`${SESSION_COOKIE}=`));
    assert.match(setCookie, /Max-Age=0/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /HttpOnly/i);
  } finally {
    if (previousSecure === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = previousSecure;
  }
});
