import { chatCompletionsUrl, getOpenAIConfig, type OpenAIEnv } from "./config";
import { clip } from "./text";

export type AiCallResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: string };

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof (part as { text: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
      return "";
    })
    .join("");
}

export function parseJsonLoose(text: string): unknown {
  let raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) raw = fenced[1].trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error("模型没有返回 JSON");
  }
}

async function errorReason(response: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: string } | string; message?: string };
    if (typeof body.error === "string") detail = body.error;
    else if (body.error && typeof body.error.message === "string") detail = body.error.message;
    else if (typeof body.message === "string") detail = body.message;
  } catch {
    detail = "";
  }
  const suffix = detail ? `：${clip(detail, 160)}` : "";
  return `模型接口返回 ${response.status}${suffix}`;
}

export async function completeJson(
  system: string,
  user: string,
  options?: { fetchImpl?: typeof fetch; env?: OpenAIEnv },
): Promise<AiCallResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const config = getOpenAIConfig(options?.env);
  if (!config.enabled) return { ok: false, reason: "未配置 OPENAI_API_KEY" };
  if (!config.baseUrlOk) return { ok: false, reason: config.baseUrlError ?? "OPENAI_BASE_URL 无效" };

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const endpoint = chatCompletionsUrl(config.baseUrl);

  const send = (responseFormat: boolean) => {
    const body: Record<string, unknown> = {
      model: config.model,
      temperature: 0,
      messages,
    };
    if (responseFormat) body.response_format = { type: "json_object" };
    return fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
  };

  try {
    let response = await send(true);
    if (response.status === 400) response = await send(false);
    if (!response.ok) return { ok: false, reason: await errorReason(response) };
    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const text = messageText(payload.choices?.[0]?.message?.content);
    if (!text.trim()) return { ok: false, reason: "模型返回了空内容" };
    return { ok: true, data: parseJsonLoose(text) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return { ok: false, reason: `模型调用失败：${clip(message, 160)}` };
  }
}
