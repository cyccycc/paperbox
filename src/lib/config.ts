export type OpenAIEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
};

export type OpenAIConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  baseUrlOk: boolean;
  baseUrlError: string | null;
};

const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-flash";

export function getOpenAIConfig(env?: OpenAIEnv): OpenAIConfig {
  const source = env ?? process.env;
  const apiKey = (source.OPENAI_API_KEY ?? "").trim();
  const model = (source.OPENAI_MODEL ?? "").trim() || DEFAULT_MODEL;
  const rawBase = (source.OPENAI_BASE_URL ?? "").trim() || DEFAULT_BASE_URL;
  const baseUrl = rawBase.replace(/\/+$/, "");
  const baseUrlOk = /\/v1$/i.test(baseUrl);

  return {
    apiKey,
    baseUrl,
    model,
    enabled: apiKey.length > 0,
    baseUrlOk,
    baseUrlError: baseUrlOk
      ? null
      : "OPENAI_BASE_URL 必须以 /v1 结尾，例如 https://api.deepseek.com/v1",
  };
}

export function isDeepSeekEndpoint(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === "api.deepseek.com" || host.endsWith(".deepseek.com");
  } catch {
    return false;
  }
}

export type RuntimeMode = {
  id: "offline" | "deepseek" | "model";
  label: "离线" | "DeepSeek" | "模型";
  model: string | null;
};

export function runtimeMode(env?: OpenAIEnv): RuntimeMode {
  const config = getOpenAIConfig(env);
  if (!config.enabled || !config.baseUrlOk) {
    return { id: "offline", label: "离线", model: null };
  }
  if (isDeepSeekEndpoint(config.baseUrl) || /^deepseek(?:-|$)/i.test(config.model)) {
    return { id: "deepseek", label: "DeepSeek", model: config.model };
  }
  return { id: "model", label: "模型", model: config.model };
}

export function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}
