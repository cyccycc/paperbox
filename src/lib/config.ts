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

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

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
      : "OPENAI_BASE_URL 必须以 /v1 结尾，例如 https://api.openai.com/v1",
  };
}

export function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}
