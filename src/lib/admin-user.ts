import type { PrismaClient } from "@prisma/client";
import { ADMIN_LOGIN_ID, validatePassword } from "./accounts";
import { hashPassword } from "./password";

export const ADMIN_SEED_CREDITS = 10_000;
const SEED_NOTE = "管理员种子账号";
const LIST_LIMIT = 500;

export function adminSeedPasswordError(password: string): string | null {
  if (!password) return "请设置环境变量 ADMIN_SEED_PASSWORD。";
  return validatePassword(password);
}

export async function upsertSeedAdmin(db: PrismaClient, password: string) {
  const invalid = adminSeedPasswordError(password);
  if (invalid) return { ok: false as const, error: invalid };

  const passwordHash = await hashPassword(password);
  const email = ADMIN_LOGIN_ID;
  const credits = ADMIN_SEED_CREDITS;
  const existing = await db.user.findUnique({ where: { email } });

  if (!existing) {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash, credits, isAdmin: true },
      });
      await tx.creditLedger.create({
        data: { userId: created.id, delta: credits, reason: "grant", note: SEED_NOTE },
      });
      return created;
    });
    return { ok: true as const, email: user.email, credits: user.credits, created: true };
  }

  const user = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: existing.id },
      data: { passwordHash, isAdmin: true, credits },
    });
    const delta = credits - existing.credits;
    if (delta !== 0) {
      await tx.creditLedger.create({
        data: { userId: existing.id, delta, reason: "grant", note: SEED_NOTE },
      });
    }
    return updated;
  });
  return { ok: true as const, email: user.email, credits: user.credits, created: false };
}

export async function listAdminUsers(db: PrismaClient) {
  const [users, total] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
      select: {
        id: true,
        email: true,
        credits: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { jobs: { where: { status: "done" } } } },
      },
    }),
    db.user.count(),
  ]);
  return { users, total };
}
