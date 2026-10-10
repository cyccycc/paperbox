import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DocType } from "./types";

const SAMPLE_FILES: Record<DocType, string> = {
  invoice: "invoice-zh.txt",
  contract: "contract-zh.txt",
  resume: "resume-zh.txt",
};

export function sampleFilename(type: DocType): string {
  return SAMPLE_FILES[type];
}

export async function readSample(type: DocType): Promise<{ filename: string; bytes: Buffer }> {
  const filename = sampleFilename(type);
  const bytes = await readFile(path.join(process.cwd(), "samples", filename));
  return { filename, bytes };
}
