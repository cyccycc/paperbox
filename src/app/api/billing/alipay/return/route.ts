import { handleAlipayReturn } from "@/lib/alipay";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleAlipayReturn(prisma, request);
}
