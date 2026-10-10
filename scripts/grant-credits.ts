import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeEmail } from "../src/lib/accounts";

function loadEnvFile() {
  if (process.env.DATABASE_URL) return;
  let text = "";
  try {
    text = readFileSync(path.join(process.cwd(), ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function usage() {
  console.error("用法: npm run grant -- <邮箱> <额度> [备注]");
  console.error("示例: npm run grant -- user@example.com 50");
}

async function main() {
  loadEnvFile();
  const email = normalizeEmail(process.argv[2]);
  const delta = Number(process.argv[3]);
  const note = process.argv.slice(4).join(" ").trim() || undefined;
  if (!email || !Number.isInteger(delta)) {
    usage();
    process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.error("缺少 DATABASE_URL。请先 cp .env.example .env");
    process.exitCode = 1;
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const { grantCredits } = await import("../src/lib/quota");
  const prisma = new PrismaClient();
  try {
    const result = await grantCredits(prisma, { email, delta, note });
    if (!result.ok) {
      console.error(result.error);
      process.exitCode = 1;
      return;
    }
    const sign = delta > 0 ? "+" : "";
    console.log(`已为 ${result.email} 调整 ${sign}${delta} 次，当前剩余 ${result.credits} 次。`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
