import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "paperbox-quota-"));
const dbFile = path.join(dir, "test.db");
const databaseUrl = `file:${dbFile}`;
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousOpenAiKey = process.env.OPENAI_API_KEY;
const previousFreeQuota = process.env.FREE_QUOTA;
const previousAdminSecret = process.env.ADMIN_GRANT_SECRET;

process.env.DATABASE_URL = databaseUrl;
process.env.OPENAI_API_KEY = "";
process.env.FREE_QUOTA = "10";
process.env.AUTH_SECRET ??= "paperbox-test-secret";
process.env.ADMIN_GRANT_SECRET = "grant-test-secret";

const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");

function runPrisma(args: string[], url: string) {
  execFileSync(prismaBin, args, {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

runPrisma(["db", "push", "--skip-generate", "--accept-data-loss"], databaseUrl);

let prisma: import("@prisma/client").PrismaClient;
let createJob: typeof import("../src/lib/jobs").createJob;
let uploadsDir: typeof import("../src/lib/jobs").uploadsDir;
let createPendingOrder: typeof import("../src/lib/quota").createPendingOrder;
let createUserWithFreeQuota: typeof import("../src/lib/quota").createUserWithFreeQuota;
let grantCredits: typeof import("../src/lib/quota").grantCredits;
let settleOrder: typeof import("../src/lib/quota").settleOrder;
let POST: typeof import("../src/app/api/admin/credits/route").POST;

test.before(async () => {
  const db = await import("../src/lib/db");
  const jobs = await import("../src/lib/jobs");
  const quota = await import("../src/lib/quota");
  const admin = await import("../src/app/api/admin/credits/route");
  prisma = db.prisma;
  createJob = jobs.createJob;
  uploadsDir = jobs.uploadsDir;
  createPendingOrder = quota.createPendingOrder;
  createUserWithFreeQuota = quota.createUserWithFreeQuota;
  grantCredits = quota.grantCredits;
  settleOrder = quota.settleOrder;
  POST = admin.POST;
});

async function makeUser(email: string, credits?: number) {
  const user = await createUserWithFreeQuota(prisma, {
    email,
    passwordHash: "not-used",
  });
  if (credits !== undefined) {
    await prisma.user.update({ where: { id: user.id }, data: { credits } });
    return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  }
  return user;
}

test.describe("usage quota", { concurrency: 1 }, () => {
test("migration creates the quota tables on a fresh database", () => {
  const migrateDir = mkdtempSync(path.join(tmpdir(), "paperbox-migrate-"));
  const migrateUrl = `file:${path.join(migrateDir, "migrate.db")}`;
  try {
    runPrisma(["migrate", "deploy"], migrateUrl);
  } finally {
    rmSync(migrateDir, { recursive: true, force: true });
  }
});

test("signup stores the granted free quota and skips a zero ledger", async () => {
  const user = await createUserWithFreeQuota(prisma, {
    email: "signup@example.com",
    passwordHash: "not-used",
    credits: 4,
  });
  assert.equal(user.credits, 4);
  const ledger = await prisma.creditLedger.findMany({ where: { userId: user.id } });
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0]?.delta, 4);
  assert.equal(ledger[0]?.reason, "signup");
  const empty = await createUserWithFreeQuota(prisma, {
    email: "zero@example.com",
    passwordHash: "not-used",
    credits: 0,
  });
  assert.equal(empty.credits, 0);
  assert.equal(await prisma.creditLedger.count({ where: { userId: empty.id } }), 0);
  const standard = await createUserWithFreeQuota(prisma, {
    email: "default-quota@example.com",
    passwordHash: "not-used",
  });
  assert.equal(standard.credits, 10);
});

test("a successful parse spends one credit and a second parse is blocked", async () => {
  const user = await makeUser("parse@example.com", 1);
  const bytes = readFileSync(path.join(process.cwd(), "samples", "invoice-zh.txt"));
  const first = await createJob({
    userId: user.id,
    type: "invoice",
    filename: "invoice-zh.txt",
    bytes,
    rewrite: false,
  });
  assert.equal("id" in first, true);
  const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(after.credits, 0);
  const ledger = await prisma.creditLedger.findFirst({ where: { userId: user.id, reason: "job" } });
  assert.equal(ledger?.delta, -1);
  const job = await prisma.job.findFirstOrThrow({ where: { userId: user.id } });
  assert.equal(job.status, "done");

  const second = await createJob({
    userId: user.id,
    type: "invoice",
    filename: "invoice-zh.txt",
    bytes,
    rewrite: false,
  });
  assert.deepEqual(second, {
    error: "额度已用完，请购买额度后再继续。",
    status: 402,
    code: "quota_exhausted",
  });
  assert.equal(await prisma.job.count({ where: { userId: user.id } }), 1);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 0);
});

test("unreadable and rejected files do not spend a credit", async () => {
  const user = await makeUser("noop@example.com", 2);
  const scanned = await createJob({
    userId: user.id,
    type: "invoice",
    filename: "scanned-no-text.pdf",
    bytes: readFileSync(path.join(process.cwd(), "samples", "scanned-no-text.pdf")),
    rewrite: false,
  });
  assert.equal("id" in scanned, true);
  const blank = await createJob({
    userId: user.id,
    type: "contract",
    filename: "blank.txt",
    bytes: Buffer.from(" \n\t"),
    rewrite: false,
  });
  assert.equal("error" in blank && blank.status, 400);
  const unsupported = await createJob({
    userId: user.id,
    type: "resume",
    filename: "notes.docx",
    bytes: Buffer.from("not a document"),
    rewrite: false,
  });
  assert.equal("error" in unsupported && unsupported.status, 400);
  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(fresh.credits, 2);
  const jobs = await prisma.job.findMany({ where: { userId: user.id } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.status, "no_text");
  assert.equal(await prisma.creditLedger.count({ where: { userId: user.id, reason: "job" } }), 0);
});

test("placeholder checkout stays pending and does not add credits", async () => {
  const user = await makeUser("bill@example.com", 3);
  const created = await createPendingOrder(prisma, { userId: user.id, packId: "50", channel: "wechat" });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.message, "支付通道即将开通");
  assert.equal(created.order.status, "pending");
  assert.equal(created.order.credits, 50);
  assert.equal(created.order.channel, "wechat");
  const balance = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(balance.credits, 3);

  const missing = await createPendingOrder(prisma, { userId: user.id, packId: "10", channel: "alipay" });
  assert.equal(missing.ok, false);
  const badChannel = await createPendingOrder(prisma, { userId: user.id, packId: "200", channel: "cash" });
  assert.equal(badChannel.ok, false);
});

test("grant and mark_paid change credits once", async () => {
  const user = await makeUser("grant@example.com", 1);
  const granted = await grantCredits(prisma, { email: "Grant@Example.com", delta: 5, note: "测试" });
  assert.equal(granted.ok, true);
  if (!granted.ok) return;
  assert.equal(granted.credits, 6);

  const tooMuch = await grantCredits(prisma, { email: user.email, delta: -100 });
  assert.equal(tooMuch.ok, false);

  const order = await createPendingOrder(prisma, { userId: user.id, packId: "200", channel: "alipay" });
  assert.equal(order.ok, true);
  if (!order.ok) return;
  const paid = await settleOrder(prisma, { orderId: order.order.id, action: "mark_paid" });
  assert.equal(paid.ok, true);
  if (!paid.ok) return;
  assert.equal(paid.status, "paid");
  assert.equal(paid.credits, 206);
  const again = await settleOrder(prisma, { orderId: order.order.id, action: "mark_paid" });
  assert.equal(again.ok && again.credits, 206);
  const cancelPaid = await settleOrder(prisma, { orderId: order.order.id, action: "cancel" });
  assert.equal(cancelPaid.ok, false);

  const pending = await createPendingOrder(prisma, { userId: user.id, packId: "50", channel: "wechat" });
  assert.equal(pending.ok, true);
  if (!pending.ok) return;
  const cancelled = await settleOrder(prisma, { orderId: pending.order.id, action: "cancel" });
  assert.equal(cancelled.ok && cancelled.status, "cancelled");
  assert.equal(cancelled.ok && cancelled.credits, 206);
});

test("admin endpoint grants with the secret and stays closed without it", async () => {
  const user = await makeUser("admin@example.com", 2);
  const denied = await POST(
    new Request("http://localhost/api/admin/credits", {
      method: "POST",
      headers: { authorization: "Bearer wrong", "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, credits: 4 }),
    }),
  );
  assert.equal(denied.status, 401);

  const granted = await POST(
    new Request("http://localhost/api/admin/credits", {
      method: "POST",
      headers: { authorization: "Bearer grant-test-secret", "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, credits: 4 }),
    }),
  );
  assert.equal(granted.status, 200);
  const payload = (await granted.json()) as { credits: number };
  assert.equal(payload.credits, 6);

  process.env.ADMIN_GRANT_SECRET = "";
  const closed = await POST(
    new Request("http://localhost/api/admin/credits", {
      method: "POST",
      headers: { authorization: "Bearer grant-test-secret", "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, credits: 4 }),
    }),
  );
  assert.equal(closed.status, 404);
  process.env.ADMIN_GRANT_SECRET = "grant-test-secret";
});
});

test.after(async () => {
  const jobs = await prisma.job.findMany({ select: { storedName: true } });
  for (const job of jobs) {
    await unlink(path.join(uploadsDir(), job.storedName)).catch(() => undefined);
  }
  await prisma.$disconnect();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousOpenAiKey;
  if (previousFreeQuota === undefined) delete process.env.FREE_QUOTA;
  else process.env.FREE_QUOTA = previousFreeQuota;
  if (previousAdminSecret === undefined) delete process.env.ADMIN_GRANT_SECRET;
  else process.env.ADMIN_GRANT_SECRET = previousAdminSecret;
  rmSync(dir, { recursive: true, force: true });
});
