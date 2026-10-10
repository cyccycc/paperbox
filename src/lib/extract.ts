import { getOpenAIConfig, type OpenAIEnv } from "./config";
import { aiRewriteWasReplaced, normalizeAi } from "./normalize";
import { completeJson } from "./openai";
import { parseOffline } from "./parsers";
import { systemPrompt } from "./prompts";
import { clip } from "./text";
import type { DocType, ExtractionData } from "./types";

const MODEL_TEXT_LIMIT = 24_000;

export type ExtractionOutcome = {
  mode: "ai" | "offline";
  fallbackReason: string | null;
  note: string | null;
  data: ExtractionData;
};

export async function extractFields(
  type: DocType,
  text: string,
  rewrite: boolean,
  options?: { fetchImpl?: typeof fetch; env?: OpenAIEnv },
): Promise<ExtractionOutcome> {
  const offline = parseOffline(type, text, rewrite);
  const config = getOpenAIConfig(options?.env);
  if (!config.enabled) {
    return { mode: "offline", fallbackReason: null, note: null, data: offline };
  }
  if (!config.baseUrlOk) {
    return {
      mode: "offline",
      fallbackReason: config.baseUrlError,
      note: null,
      data: offline,
    };
  }

  const clipped = text.length > MODEL_TEXT_LIMIT ? `${text.slice(0, MODEL_TEXT_LIMIT)}\n\n[文档已截断]` : text;
  const ai = await completeJson(systemPrompt(type, rewrite), clipped, options);
  if (!ai.ok) {
    return { mode: "offline", fallbackReason: ai.reason, note: null, data: offline };
  }

  const data = normalizeAi(type, ai.data, text, rewrite);
  if (!data) {
    return {
      mode: "offline",
      fallbackReason: "模型返回的 JSON 无法识别为该文档类型",
      note: null,
      data: offline,
    };
  }

  const note = aiRewriteWasReplaced(type, ai.data, text, rewrite)
    ? "模型润色里出现了原文没有的数字，已改回只整理原文事实的版本。"
    : null;
  return { mode: "ai", fallbackReason: null, note, data };
}

export function offlineBanner(reason: string | null): string {
  if (reason) return `模型未能完成提取，已改用离线解析。原因：${clip(reason, 240)}`;
  return "本次使用离线解析。";
}
