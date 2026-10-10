import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { QUOTA_EXHAUSTED_CODE, QUOTA_EXHAUSTED_MESSAGE } from "./billing";
import { prisma } from "./db";
import { extractFields } from "./extract";
import { chargeSuccessfulJob, getCreditBalance } from "./quota";
import { extensionOf, readSource } from "./read-source";
import { sourcePreview } from "./text";
import type { DocType, StoredResult } from "./types";

const MAX_BYTES = 5 * 1024 * 1024;

export function uploadsDir(): string {
  return path.join(process.cwd(), "uploads");
}

export type CreateJobResult =
  | { id: string }
  | { error: string; status: number; code?: typeof QUOTA_EXHAUSTED_CODE };

export async function createJob(input: {
  userId: string;
  type: DocType;
  filename: string;
  bytes: Buffer;
  rewrite: boolean;
}): Promise<CreateJobResult> {
  if (input.bytes.byteLength > MAX_BYTES) {
    return { error: "文件不能超过 5 MB。", status: 400 };
  }

  const balance = await getCreditBalance(prisma, input.userId);
  if (balance === null) return { error: "账号不存在。", status: 401 };
  if (balance < 1) {
    return { error: QUOTA_EXHAUSTED_MESSAGE, status: 402, code: QUOTA_EXHAUSTED_CODE };
  }

  const id = randomUUID();
  let read: Awaited<ReturnType<typeof readSource>>;
  try {
    read = await readSource(input.filename, input.bytes);
  } catch (error) {
    console.error("read source failed", error);
    return { error: "无法读取这个文件。", status: 400 };
  }

  if (!read.ok && read.code !== "no_text") {
    return { error: read.message, status: 400 };
  }

  const extension = extensionOf(input.filename) || ".bin";
  const storedName = `${id}${extension}`;
  await mkdir(uploadsDir(), { recursive: true });
  const storedPath = path.join(uploadsDir(), storedName);
  await writeFile(storedPath, input.bytes);

  try {
    if (!read.ok) {
      await prisma.job.create({
        data: {
          id,
          userId: input.userId,
          type: input.type,
          originalName: input.filename,
          storedName,
          status: "no_text",
          mode: "none",
          message: read.message,
          rewrite: input.rewrite,
        },
      });
      return { id };
    }

    const extracted = await extractFields(input.type, read.text, input.type === "resume" && input.rewrite);
    const stored: StoredResult = {
      data: extracted.data,
      note: extracted.note,
      sourcePreview: sourcePreview(read.text),
    };
    const charged = await chargeSuccessfulJob(prisma, {
      id,
      userId: input.userId,
      type: input.type,
      originalName: input.filename,
      storedName,
      mode: extracted.mode,
      fallbackReason: extracted.fallbackReason,
      resultJson: JSON.stringify(stored),
      rewrite: input.type === "resume" && input.rewrite,
    });
    if (charged === "ok") return { id };
    await unlink(storedPath).catch(() => undefined);
    if (charged === "missing") return { error: "账号不存在。", status: 401 };
    return { error: QUOTA_EXHAUSTED_MESSAGE, status: 402, code: QUOTA_EXHAUSTED_CODE };
  } catch (error) {
    console.error("create job failed", error);
    await unlink(storedPath).catch(() => undefined);
    return { error: "处理文件时出错，请稍后再试。", status: 500 };
  }
}
