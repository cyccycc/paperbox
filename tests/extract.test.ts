import assert from "node:assert/strict";
import test from "node:test";
import { extractFields } from "../src/lib/extract";
import { parseJsonLoose } from "../src/lib/openai";
import type { InvoiceData } from "../src/lib/types";

const invoiceText = ["销售方：离线商家", "纳税人识别号：TAX-1", "开票日期：2026-01-01", "价税合计：¥10.00"].join("\n");

function env(overrides: Record<string, string>): NodeJS.ProcessEnv {
  return { ...overrides };
}

test("empty API key stays on the offline parser", async () => {
  let called = false;
  const result = await extractFields("invoice", invoiceText, false, {
    env: env({ OPENAI_API_KEY: "", OPENAI_BASE_URL: "https://api.openai.com/v1" }),
    fetchImpl: async () => {
      called = true;
      throw new Error("should not be called");
    },
  });
  assert.equal(called, false);
  assert.equal(result.mode, "offline");
  assert.equal(result.fallbackReason, null);
  assert.equal((result.data as InvoiceData).merchant, "离线商家");
});

test("model failure falls back to offline and keeps the reason", async () => {
  const result = await extractFields("invoice", invoiceText, false, {
    env: env({
      OPENAI_API_KEY: "test-key",
      OPENAI_BASE_URL: "https://api.openai.com/v1",
      OPENAI_MODEL: "demo",
    }),
    fetchImpl: async () => {
      throw new Error("socket hang up");
    },
  });
  assert.equal(result.mode, "offline");
  assert.match(result.fallbackReason ?? "", /模型调用失败/);
  assert.match(result.fallbackReason ?? "", /socket hang up/);
  assert.equal((result.data as InvoiceData).merchant, "离线商家");
});

test("a base URL without /v1 falls back before any request", async () => {
  let called = false;
  const result = await extractFields("invoice", invoiceText, false, {
    env: env({ OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: "https://api.openai.com" }),
    fetchImpl: async () => {
      called = true;
      throw new Error("should not be called");
    },
  });
  assert.equal(called, false);
  assert.equal(result.mode, "offline");
  assert.match(result.fallbackReason ?? "", /\/v1/);
});

test("a successful model response is used as-is", async () => {
  const result = await extractFields("invoice", invoiceText, false, {
    env: env({ OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: "https://example.test/v1/" }),
    fetchImpl: async (input) => {
      assert.equal(String(input), "https://example.test/v1/chat/completions");
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                merchant: "模型商家",
                taxId: "MODEL-TAX",
                date: "2024-02-02",
                amount: "¥99.00",
                currency: "CNY",
                lineItems: [{ name: "咨询", quantity: "2", unitPrice: "10", amount: "20" }],
              }),
            },
          },
        ],
      });
    },
  });
  assert.equal(result.mode, "ai");
  assert.equal(result.fallbackReason, null);
  const data = result.data as InvoiceData;
  assert.equal(data.merchant, "模型商家");
  assert.equal(data.lineItems[0]?.name, "咨询");
});

test("retries without response_format after HTTP 400 and accepts fenced JSON", async () => {
  let calls = 0;
  const result = await extractFields("invoice", invoiceText, false, {
    env: env({ OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: "https://api.openai.com/v1" }),
    fetchImpl: async (_input, init) => {
      calls += 1;
      const body = JSON.parse(String(init?.body));
      if (calls === 1) {
        assert.equal(body.response_format.type, "json_object");
        return Response.json({ error: { message: "response_format unsupported" } }, { status: 400 });
      }
      assert.equal(body.response_format, undefined);
      return Response.json({
        choices: [{ message: { content: '```json\n{"merchant":"围栏商家","amount":"¥1"}\n```' } }],
      });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.mode, "ai");
  assert.equal((result.data as InvoiceData).merchant, "围栏商家");
});

test("resume rewrite that invents numbers is replaced", async () => {
  const source = "姓名：林晓舟\n工作经历：\n2022.03 - 至今  杭州青禾贸易有限公司  产品经理\n- 负责发票流程";
  const result = await extractFields("resume", source, true, {
    env: env({ OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: "https://api.openai.com/v1" }),
    fetchImpl: async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "林晓舟",
                experience: [
                  {
                    period: "2022.03 - 至今",
                    company: "杭州青禾贸易有限公司",
                    title: "产品经理",
                    highlights: ["负责发票流程"],
                  },
                ],
                rewriteMarkdown: "年薪 100 万，管理 80 人。",
              }),
            },
          },
        ],
      }),
  });
  assert.equal(result.mode, "ai");
  assert.match(result.note ?? "", /原文没有的数字/);
  const rewrite = (result.data as { rewriteMarkdown: string | null }).rewriteMarkdown ?? "";
  assert.match(rewrite, /杭州青禾贸易有限公司/);
  assert.doesNotMatch(rewrite, /100|80/);
});

test("parseJsonLoose reads a JSON object wrapped in prose", () => {
  const parsed = parseJsonLoose('结果如下：{"merchant":"甲"} 完');
  assert.deepEqual(parsed, { merchant: "甲" });
});
