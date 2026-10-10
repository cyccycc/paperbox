import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { invoiceToXlsx } from "../src/lib/export/invoice-xlsx";
import { contractToMarkdown, resumeToMarkdown } from "../src/lib/export/markdown";
import { chatCompletionsUrl, getOpenAIConfig, runtimeMode } from "../src/lib/config";
import type { ContractData, InvoiceData, ResumeData } from "../src/lib/types";

test("openAI base URL keeps a single /v1", () => {
  const config = getOpenAIConfig({
    OPENAI_API_KEY: "abc",
    OPENAI_BASE_URL: "https://api.openai.com/v1/",
    OPENAI_MODEL: "",
  });
  assert.equal(config.baseUrl, "https://api.openai.com/v1");
  assert.equal(config.baseUrlOk, true);
  assert.equal(config.model, "deepseek-flash");
  assert.equal(chatCompletionsUrl(config.baseUrl), "https://api.openai.com/v1/chat/completions");
  const unset = getOpenAIConfig({ OPENAI_API_KEY: "  " });
  assert.equal(unset.enabled, false);
  assert.equal(unset.baseUrl, "https://api.deepseek.com/v1");
  assert.equal(unset.model, "deepseek-flash");
  assert.deepEqual(runtimeMode({ OPENAI_API_KEY: "" }), { id: "offline", label: "离线", model: null });
  assert.deepEqual(runtimeMode({ OPENAI_API_KEY: "sk-test" }), {
    id: "deepseek",
    label: "DeepSeek",
    model: "deepseek-flash",
  });
  assert.equal(
    runtimeMode({ OPENAI_API_KEY: "sk-test", OPENAI_BASE_URL: "https://api.deepseek.com" }).id,
    "offline",
  );
  assert.deepEqual(
    runtimeMode({
      OPENAI_API_KEY: "sk-test",
      OPENAI_BASE_URL: "https://api.openai.com/v1",
      OPENAI_MODEL: "gpt-4o-mini",
    }),
    { id: "model", label: "模型", model: "gpt-4o-mini" },
  );
});

test("invoice workbook keeps fields and neutralizes formula text", async () => {
  const data: InvoiceData = {
    merchant: "=1+1",
    taxId: "91110108MA01ABCD1X",
    date: "2026-03-15",
    amount: "¥12,580.00",
    currency: "CNY",
    lineItems: [{ name: "云服务器年费", quantity: "1", unitPrice: "10000.00", amount: "10000.00" }],
  };
  const file = await invoiceToXlsx(data);
  assert.equal(file.subarray(0, 2).toString(), "PK");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
  const overview = workbook.getWorksheet("概览");
  assert.equal(overview?.getCell("A2").value, "销售方");
  assert.equal(overview?.getCell("B2").value, "'=1+1");
  assert.equal(overview?.getCell("B4").value, "2026-03-15");
  const items = workbook.getWorksheet("明细");
  assert.equal(items?.getCell("B2").value, "云服务器年费");
  assert.equal(items?.getCell("E2").value, "10000.00");
});

test("markdown exports include the structured contract and resume rewrite", () => {
  const contract: ContractData = {
    title: "技术服务合同",
    parties: [{ role: "甲方", name: "杭州青禾贸易有限公司" }],
    term: "2026年4月1日至2027年3月31日",
    amount: "人民币 360,000 元",
    clauses: ["乙方按月提供服务。"],
    summary: "乙方按月提供服务。",
  };
  const markdown = contractToMarkdown(contract);
  assert.match(markdown, /甲方：杭州青禾贸易有限公司/);
  assert.match(markdown, /人民币 360,000 元/);

  const resume: ResumeData = {
    name: "林晓舟",
    phone: "13800138000",
    email: "xiaozhou@example.com",
    targetRole: "产品经理",
    experience: [],
    education: [],
    rewriteMarkdown: "# 林晓舟\n\n只整理原文。",
  };
  assert.match(resumeToMarkdown(resume), /## 润色稿/);
  assert.match(resumeToMarkdown(resume), /只整理原文/);
});
