import type { PrismaClient } from "@prisma/client";
import { normalizeEmail } from "./accounts";
import {
  findPack,
  freeQuota,
  isPayChannel,
  ORDER_CANCELLED,
  ORDER_PAID,
  ORDER_PENDING,
  PAYMENT_CLAIMED_MESSAGE,
  PAYMENT_SCAN_MESSAGE,
} from "./billing";

const MAX_GRANT = 100_000;

export type SuccessfulJobInput = {
  id: string;
  userId: string;
  type: string;
  originalName: string;
  storedName: string;
  mode: string;
  fallbackReason: string | null;
  resultJson: string;
  rewrite: boolean;
};

export type GrantResult =
  | { ok: true; email: string; credits: number }
  | { ok: false; error: string; status: number };

export type OrderResult =
  | { ok: true; orderId: string; status: string; credits: number; message?: string }
  | { ok: false; error: string; status: number };

export async function getCreditBalance(db: PrismaClient, userId: string): Promise<number | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { credits: true } });
  return user?.credits ?? null;
}

export async function createUserWithFreeQuota(
  db: PrismaClient,
  input: { email: string; passwordHash: string; credits?: number },
) {
  const credits = input.credits ?? freeQuota();
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        credits,
      },
    });
    if (credits > 0) {
      await tx.creditLedger.create({
        data: {
          userId: user.id,
          delta: credits,
          reason: "signup",
          note: "新用户免费额度",
        },
      });
    }
    return user;
  });
}

/** Spends 1 credit and stores a finished job. Rolls back both if either write fails. */
export async function chargeSuccessfulJob(
  db: PrismaClient,
  job: SuccessfulJobInput,
): Promise<"ok" | "empty" | "missing"> {
  return db.$transaction(async (tx): Promise<"ok" | "empty" | "missing"> => {
    const updated = await tx.user.updateMany({
      where: { id: job.userId, credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
    if (updated.count !== 1) {
      const exists = await tx.user.findUnique({ where: { id: job.userId }, select: { id: true } });
      return exists ? "empty" : "missing";
    }
    await tx.job.create({
      data: {
        id: job.id,
        userId: job.userId,
        type: job.type,
        originalName: job.originalName,
        storedName: job.storedName,
        status: "done",
        mode: job.mode,
        fallbackReason: job.fallbackReason,
        resultJson: job.resultJson,
        rewrite: job.rewrite,
      },
    });
    await tx.creditLedger.create({
      data: {
        userId: job.userId,
        delta: -1,
        reason: "job",
        jobId: job.id,
        note: "成功提取",
      },
    });
    return "ok";
  });
}

export async function grantCredits(
  db: PrismaClient,
  input: { email?: string; userId?: string; delta: number; note?: string },
): Promise<GrantResult> {
  if (!Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta) > MAX_GRANT) {
    return { ok: false, error: "额度必须是非零整数，且绝对值不超过 100000。", status: 400 };
  }

  const email = input.email ? normalizeEmail(input.email) : "";
  const user = input.userId
    ? await db.user.findUnique({ where: { id: input.userId } })
    : email
      ? await db.user.findUnique({ where: { email } })
      : null;
  if (!user) return { ok: false, error: "找不到该用户。", status: 404 };

  const note = input.note?.trim().slice(0, 200) || "管理员发放";
  const applied = await db.$transaction(async (tx): Promise<number | null> => {
    if (input.delta < 0) {
      const updated = await tx.user.updateMany({
        where: { id: user.id, credits: { gte: -input.delta } },
        data: { credits: { increment: input.delta } },
      });
      if (updated.count !== 1) return null;
    } else {
      await tx.user.update({
        where: { id: user.id },
        data: { credits: { increment: input.delta } },
      });
    }
    await tx.creditLedger.create({
      data: {
        userId: user.id,
        delta: input.delta,
        reason: "grant",
        note,
      },
    });
    const fresh = await tx.user.findUnique({ where: { id: user.id }, select: { credits: true } });
    return fresh?.credits ?? null;
  });

  if (applied === null) return { ok: false, error: "扣减后额度不能小于 0。", status: 400 };
  return { ok: true, email: user.email, credits: applied };
}

/** Sets remaining credits to an absolute value and records the delta. */
export async function setCredits(
  db: PrismaClient,
  input: { userId: string; credits: number; note?: string },
): Promise<GrantResult> {
  if (!Number.isInteger(input.credits) || input.credits < 0 || input.credits > MAX_GRANT) {
    return { ok: false, error: "额度必须是 0 到 100000 的整数。", status: 400 };
  }

  const note = input.note?.trim().slice(0, 200) || "管理员调整额度";
  const applied = await db.$transaction(async (tx): Promise<{ email: string; credits: number } | null> => {
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user) return null;
    const delta = input.credits - user.credits;
    if (delta === 0) return { email: user.email, credits: user.credits };
    await tx.user.update({ where: { id: user.id }, data: { credits: input.credits } });
    await tx.creditLedger.create({
      data: {
        userId: user.id,
        delta,
        reason: "grant",
        note,
      },
    });
    return { email: user.email, credits: input.credits };
  });

  if (!applied) return { ok: false, error: "找不到该用户。", status: 404 };
  return { ok: true, email: applied.email, credits: applied.credits };
}

export async function createPendingOrder(
  db: PrismaClient,
  input: { userId: string; packId: string; channel: string },
): Promise<
  | {
      ok: true;
      message: string;
      order: {
        id: string;
        packId: string;
        credits: number;
        amountCents: number;
        channel: string;
        status: string;
        note: string | null;
        claimedAt: Date | null;
        createdAt: Date;
      };
    }
  | { ok: false; error: string; status: number }
> {
  const pack = findPack(input.packId);
  if (!pack) return { ok: false, error: "请选择 50 次或 200 次套餐。", status: 400 };
  if (!isPayChannel(input.channel)) return { ok: false, error: "请选择微信支付或支付宝。", status: 400 };

  const user = await db.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) return { ok: false, error: "账号不存在。", status: 401 };

  const order = await db.order.create({
    data: {
      userId: input.userId,
      packId: pack.id,
      credits: pack.credits,
      amountCents: pack.amountCents,
      currency: "CNY",
      channel: input.channel,
      status: ORDER_PENDING,
    },
  });
  return { ok: true, message: PAYMENT_SCAN_MESSAGE, order };
}

export async function claimOrderPayment(
  db: PrismaClient,
  input: { userId: string; orderId: string; note?: string },
): Promise<
  | {
      ok: true;
      message: string;
      order: {
        id: string;
        packId: string;
        credits: number;
        amountCents: number;
        channel: string;
        status: string;
        note: string | null;
        claimedAt: Date | null;
        createdAt: Date;
      };
    }
  | { ok: false; error: string; status: number }
> {
  const note = input.note?.trim().slice(0, 200) ?? "";
  if (!input.orderId) return { ok: false, error: "请提供订单号。", status: 400 };
  if (!note) return { ok: false, error: "请填写付款备注，方便核对。", status: 400 };

  const order = await db.order.findUnique({ where: { id: input.orderId } });
  if (!order || order.userId !== input.userId) return { ok: false, error: "找不到订单。", status: 404 };
  if (order.status === ORDER_PAID) return { ok: false, error: "这笔订单已经入账。", status: 400 };
  if (order.status !== ORDER_PENDING) return { ok: false, error: "只有待支付订单可以提交付款说明。", status: 400 };

  const updated = await db.order.updateMany({
    where: { id: order.id, userId: input.userId, status: ORDER_PENDING },
    data: { note, claimedAt: new Date() },
  });
  if (updated.count !== 1) return { ok: false, error: "订单状态已变化，请刷新后再试。", status: 409 };

  const fresh = await db.order.findUnique({ where: { id: order.id } });
  if (!fresh) return { ok: false, error: "找不到订单。", status: 404 };
  return { ok: true, message: PAYMENT_CLAIMED_MESSAGE, order: fresh };
}

export type ClaimedOrder = {
  id: string;
  email: string;
  packId: string;
  credits: number;
  amountCents: number;
  channel: string;
  status: string;
  note: string | null;
  claimedAt: string;
  createdAt: string;
};

/** Pending orders whose payer already clicked 我已付款. */
export async function listClaimedOrders(db: PrismaClient): Promise<ClaimedOrder[]> {
  const orders = await db.order.findMany({
    where: { status: ORDER_PENDING, claimedAt: { not: null } },
    orderBy: { claimedAt: "desc" },
    take: 50,
    include: { user: { select: { email: true } } },
  });
  return orders.flatMap((order) => {
    if (!order.claimedAt) return [];
    return [
      {
        id: order.id,
        email: order.user.email,
        packId: order.packId,
        credits: order.credits,
        amountCents: order.amountCents,
        channel: order.channel,
        status: order.status,
        note: order.note,
        claimedAt: order.claimedAt.toISOString(),
        createdAt: order.createdAt.toISOString(),
      },
    ];
  });
}

export async function settleOrder(
  db: PrismaClient,
  input: { orderId: string; action: string },
): Promise<OrderResult> {
  if (input.action !== "mark_paid" && input.action !== "cancel") {
    return { ok: false, error: "action 只能是 mark_paid 或 cancel。", status: 400 };
  }
  if (!input.orderId) return { ok: false, error: "请提供订单号。", status: 400 };

  try {
    return await db.$transaction(async (tx): Promise<OrderResult> => {
      const order = await tx.order.findUnique({ where: { id: input.orderId } });
      if (!order) return { ok: false, error: "找不到订单。", status: 404 };

      const balanceOf = async () => {
        const user = await tx.user.findUnique({ where: { id: order.userId }, select: { credits: true } });
        return user?.credits ?? 0;
      };

      if (input.action === "cancel") {
        if (order.status === ORDER_PAID) {
          return { ok: false, error: "已支付的订单不能取消。", status: 400 };
        }
        if (order.status !== ORDER_CANCELLED) {
          await tx.order.update({ where: { id: order.id }, data: { status: ORDER_CANCELLED } });
        }
        return { ok: true, orderId: order.id, status: ORDER_CANCELLED, credits: await balanceOf() };
      }

      if (order.status === ORDER_PAID) {
        return { ok: true, orderId: order.id, status: ORDER_PAID, credits: await balanceOf() };
      }
      if (order.status !== ORDER_PENDING) {
        return { ok: false, error: "只有待支付订单可以标记为已支付。", status: 400 };
      }

      const updated = await tx.order.updateMany({
        where: { id: order.id, status: ORDER_PENDING },
        data: { status: ORDER_PAID },
      });
      if (updated.count !== 1) {
        const again = await tx.order.findUnique({ where: { id: order.id } });
        if (again?.status === ORDER_PAID) {
          return { ok: true, orderId: order.id, status: ORDER_PAID, credits: await balanceOf() };
        }
        return { ok: false, error: "订单状态已变化，请重试。", status: 409 };
      }

      await tx.user.update({
        where: { id: order.userId },
        data: { credits: { increment: order.credits } },
      });
      await tx.creditLedger.create({
        data: {
          userId: order.userId,
          delta: order.credits,
          reason: "order",
          orderId: order.id,
          note: "订单标记为已支付",
        },
      });
      return { ok: true, orderId: order.id, status: ORDER_PAID, credits: await balanceOf() };
    });
  } catch (error) {
    console.error("settle order failed", error);
    return { ok: false, error: "更新订单失败，请稍后再试。", status: 500 };
  }
}
