import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "paperbox-admin-"));
const dbFile = path.join(dir, "test.db");
const databaseUrl = `file:${dbFile}`;
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousAuthSecret = process.env.AUTH_SECRET;

process.env.DATABASE_URL = databaseUrl;
process.env.AUTH_SECRET = "paperbox-admin-test-secret";

const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");

execFileSync(prismaBin, ["db", "push", "--skip-generate", "--accept-data-loss"], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: ["ignore", "pipe", "pipe"],
});

let prisma: import("@prisma/client").PrismaClient;
let createUserWithFreeQuota: typeof import("../src/lib/quota").createUserWithFreeQuota;
let setCredits: typeof import("../src/lib/quota").setCredits;
let upsertSeedAdmin: typeof import("../src/lib/admin-user").upsertSeedAdmin;
let listAdminUsers: typeof import("../src/lib/admin-user").listAdminUsers;
let signSession: typeof import("../src/lib/session").signSession;
let verifyPassword: typeof import("../src/lib/password").verifyPassword;
let POST: typeof import("../src/app/api/admin/users/credits/route").POST;

test.before(async () => {
  const db = await import("../src/lib/db");
  const quota = await import("../src/lib/quota");
  const adminUser = await import("../src/lib/admin-user");
  const session = await import("../src/lib/session");
  const password = await import("../src/lib/password");
  const route = await import("../src/app/api/admin/users/credits/route");
  prisma = db.prisma;
  createUserWithFreeQuota = quota.createUserWithFreeQuota;
  setCredits = quota.setCredits;
  upsertSeedAdmin = adminUser.upsertSeedAdmin;
  listAdminUsers = adminUser.listAdminUsers;
  signSession = session.signSession;
  verifyPassword = password.verifyPassword;
  POST = route.POST;
});

test.after(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousAuthSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = previousAuthSecret;
});

async function makeUser(email: string, credits?: number) {
  const user = await createUserWithFreeQuota(prisma, { email, passwordHash: "not-used" });
  if (credits === undefined) return user;
  return prisma.user.update({ where: { id: user.id }, data: { credits } });
}

test.describe("admin users", { concurrency: 1 }, () => {
  test("seed upserts operator 9999 without storing a plaintext password", async () => {
    await prisma.user.deleteMany({ where: { email: "9999" } });
    const missing = await upsertSeedAdmin(prisma, "");
    assert.equal(missing.ok, false);

    const created = await upsertSeedAdmin(prisma, "seed-pass-1");
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.email, "9999");
    assert.equal(created.credits, 10000);
    assert.equal(created.created, true);

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "9999" } });
    assert.equal(admin.isAdmin, true);
    assert.equal(admin.credits, 10000);
    assert.notEqual(admin.passwordHash, "seed-pass-1");
    assert.equal(await verifyPassword("seed-pass-1", admin.passwordHash), true);
    const ledger = await prisma.creditLedger.findMany({ where: { userId: admin.id } });
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]?.delta, 10000);
    assert.equal(ledger[0]?.reason, "grant");

    await prisma.user.update({ where: { id: admin.id }, data: { credits: 7, isAdmin: false } });
    const again = await upsertSeedAdmin(prisma, "seed-pass-2");
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.created, false);
    assert.equal(again.credits, 10000);

    const refreshed = await prisma.user.findUniqueOrThrow({ where: { email: "9999" } });
    assert.equal(refreshed.id, admin.id);
    assert.equal(refreshed.isAdmin, true);
    assert.equal(refreshed.credits, 10000);
    assert.equal(await verifyPassword("seed-pass-2", refreshed.passwordHash), true);
    assert.equal(await verifyPassword("seed-pass-1", refreshed.passwordHash), false);
    const rows = await prisma.creditLedger.findMany({ where: { userId: admin.id }, orderBy: { createdAt: "asc" } });
    assert.equal(rows.length, 2);
    assert.equal(rows[1]?.delta, 9993);
  });

  test("user list is newest first and counts successful extractions", async () => {
    const older = await makeUser("older@example.com");
    const newer = await makeUser("newer@example.com");
    await prisma.user.update({
      where: { id: older.id },
      data: { createdAt: new Date("2024-01-01T00:00:00.000Z") },
    });
    await prisma.user.update({
      where: { id: newer.id },
      data: { createdAt: new Date("2026-06-01T00:00:00.000Z") },
    });
    await prisma.job.create({
      data: {
        id: `done-${newer.id}`,
        userId: newer.id,
        type: "invoice",
        originalName: "a.txt",
        storedName: "a.txt",
        status: "done",
        mode: "offline",
      },
    });
    await prisma.job.create({
      data: {
        id: `empty-${newer.id}`,
        userId: newer.id,
        type: "invoice",
        originalName: "b.txt",
        storedName: "b.txt",
        status: "no_text",
        mode: "offline",
      },
    });

    const { users, total } = await listAdminUsers(prisma);
    assert.ok(total >= 3);
    const emails = users.map((user) => user.email);
    assert.ok(emails.indexOf("newer@example.com") < emails.indexOf("older@example.com"));
    assert.equal(users.find((user) => user.email === "newer@example.com")?._count.jobs, 1);
    assert.equal(users.find((user) => user.email === "older@example.com")?.isAdmin, false);
  });

  test("setCredits writes the ledger and rejects an out-of-range balance", async () => {
    const user = await makeUser("adjust@example.com", 4);
    const same = await setCredits(prisma, { userId: user.id, credits: 4 });
    assert.equal(same.ok, true);
    assert.equal(await prisma.creditLedger.count({ where: { userId: user.id, reason: "grant" } }), 0);

    const updated = await setCredits(prisma, { userId: user.id, credits: 9 });
    assert.equal(updated.ok, true);
    if (!updated.ok) return;
    assert.equal(updated.credits, 9);
    const ledger = await prisma.creditLedger.findFirstOrThrow({
      where: { userId: user.id, reason: "grant" },
    });
    assert.equal(ledger.delta, 5);
    assert.equal(ledger.note, "管理员调整额度");

    const negative = await setCredits(prisma, { userId: user.id, credits: -1 });
    assert.equal(negative.ok, false);
    const huge = await setCredits(prisma, { userId: user.id, credits: 100001 });
    assert.equal(huge.ok, false);
    const fractional = await setCredits(prisma, { userId: user.id, credits: 1.5 });
    assert.equal(fractional.ok, false);
    const missing = await setCredits(prisma, { userId: "missing-user", credits: 3 });
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.status, 404);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 9);
  });

  test("only an admin session can adjust credits", async () => {
    const user = await makeUser("target@example.com", 2);
    const member = await makeUser("member@example.com", 3);
    const admin = await prisma.user.upsert({
      where: { email: "9999" },
      update: { isAdmin: true },
      create: {
        email: "9999",
        passwordHash: "not-used",
        credits: 10000,
        isAdmin: true,
      },
    });

    const body = JSON.stringify({ userId: user.id, credits: 15 });
    const anonymous = await POST(
      new Request("http://localhost/api/admin/users/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    );
    assert.equal(anonymous.status, 401);

    const memberToken = await signSession({ uid: member.id, email: member.email });
    const forbidden = await POST(
      new Request("http://localhost/api/admin/users/credits", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `paperbox_session=${memberToken}` },
        body,
      }),
    );
    assert.equal(forbidden.status, 404);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 2);

    const adminToken = await signSession({ uid: admin.id, email: admin.email });
    const allowed = await POST(
      new Request("http://localhost/api/admin/users/credits", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `paperbox_session=${adminToken}` },
        body,
      }),
    );
    assert.equal(allowed.status, 200);
    const payload = (await allowed.json()) as { ok: boolean; credits: number; email: string };
    assert.equal(payload.ok, true);
    assert.equal(payload.email, user.email);
    assert.equal(payload.credits, 15);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 15);
  });
});
