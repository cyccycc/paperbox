import { extractText, getDocumentProxy } from "unpdf";
import { isBlankText } from "./text";
import { NO_TEXT_MESSAGE } from "./types";

export type SourceRead =
  | { ok: true; text: string }
  | { ok: false; code: "no_text"; message: string }
  | { ok: false; code: "unsupported" | "empty"; message: string };

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown"]);

export function extensionOf(filename: string): string {
  const match = filename.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function isAllowedFilename(filename: string): boolean {
  const extension = extensionOf(filename);
  return TEXT_EXTENSIONS.has(extension) || extension === ".pdf";
}

export async function readSource(filename: string, bytes: Uint8Array): Promise<SourceRead> {
  const extension = extensionOf(filename);
  if (!isAllowedFilename(filename)) {
    return { ok: false, code: "unsupported", message: "只支持 TXT、Markdown 和 PDF。" };
  }
  if (bytes.byteLength === 0) {
    return { ok: false, code: "empty", message: "文件是空的。" };
  }

  if (extension === ".pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const extracted = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text ?? "";
    if (isBlankText(text)) return { ok: false, code: "no_text", message: NO_TEXT_MESSAGE };
    return { ok: true, text };
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
  if (isBlankText(text)) return { ok: false, code: "empty", message: "文件是空的。" };
  return { ok: true, text };
}
