import { handleAlipayNotify } from "@/lib/alipay";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAlipayNotify(prisma, request);
}
