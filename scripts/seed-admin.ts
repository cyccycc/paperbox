import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile() {
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

async function main() {
  loadEnvFile();
  const password = process.env.ADMIN_SEED_PASSWORD ?? "";
  if (!process.env.DATABASE_URL) {
    console.error("缺少 DATABASE_URL。请先 cp .env.example .env");
    process.exitCode = 1;
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const { upsertSeedAdmin } = await import("../src/lib/admin-user");
  const prisma = new PrismaClient();
  try {
    const result = await upsertSeedAdmin(prisma, password);
    if (!result.ok) {
      console.error(result.error);
      process.exitCode = 1;
      return;
    }
    console.log(`已写入管理员 ${result.email}，剩余 ${result.credits} 次。`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
