import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseContract } from "../src/lib/parsers/contract";
import { parseInvoice } from "../src/lib/parsers/invoice";
import { parseResume } from "../src/lib/parsers/resume";
import { numbersIn } from "../src/lib/text";

const samples = path.join(process.cwd(), "samples");

function readSample(name: string): string {
  return readFileSync(path.join(samples, name), "utf8");
}

test("parses the Chinese invoice text sample", () => {
  const invoice = parseInvoice(readSample("invoice-zh.txt"));
  assert.equal(invoice.merchant, "北京星河科技有限公司");
  assert.equal(invoice.taxId, "91110108MA01ABCD1X");
  assert.equal(invoice.date, "2026-03-15");
  assert.equal(invoice.amount, "¥12,580.00");
  assert.equal(invoice.currency, "CNY");
  assert.equal(invoice.lineItems.length, 2);
  assert.equal(invoice.lineItems[0]?.name, "云服务器年费");
  assert.equal(invoice.lineItems[0]?.quantity, "1");
  assert.equal(invoice.lineItems[0]?.unitPrice, "10000.00");
  assert.equal(invoice.lineItems[1]?.amount, "2580.00");
});

test("parses the Chinese invoice markdown table", () => {
  const invoice = parseInvoice(readSample("invoice-zh.md"));
  assert.equal(invoice.merchant, "北京星河科技有限公司");
  assert.equal(invoice.lineItems.length, 2);
  assert.equal(invoice.lineItems[1]?.name, "技术支持服务");
});

test("parses an English invoice text layer", () => {
  const invoice = parseInvoice(
    [
      "INVOICE",
      "Merchant: Northwind Trading LLC",
      "Tax ID: 12-3456789",
      "Invoice Date: 2026-01-20",
      "Total: $1,250.00",
      "Line items:",
      "1. Consulting hours | qty 10 | unit 100.00 | amount 1000.00",
      "2. Travel expenses | qty 1 | unit 250.00 | amount 250.00",
    ].join("\n"),
  );
  assert.equal(invoice.merchant, "Northwind Trading LLC");
  assert.equal(invoice.taxId, "12-3456789");
  assert.equal(invoice.date, "2026-01-20");
  assert.equal(invoice.amount, "$1,250.00");
  assert.equal(invoice.currency, "USD");
  assert.equal(invoice.lineItems[1]?.name, "Travel expenses");
});

test("parses Chinese contract samples", () => {
  for (const name of ["contract-zh.txt", "contract-zh.md"]) {
    const contract = parseContract(readSample(name));
    assert.equal(contract.title, "技术服务合同");
    assert.deepEqual(
      contract.parties.map((party) => party.name),
      ["杭州青禾贸易有限公司", "上海纸匣信息技术有限公司"],
    );
    assert.equal(contract.term, "2026年4月1日至2027年3月31日");
    assert.equal(contract.amount, "人民币 360,000 元");
    assert.equal(contract.clauses.length, 4);
    assert.match(contract.summary, /保密义务/);
  }
});

test("parses resume structure and refuses invented numbers in the rewrite", () => {
  const source = readSample("resume-zh.txt");
  const plain = parseResume(source, false);
  assert.equal(plain.name, "林晓舟");
  assert.equal(plain.phone, "13800138000");
  assert.equal(plain.email, "xiaozhou@example.com");
  assert.equal(plain.targetRole, "产品经理");
  assert.equal(plain.rewriteMarkdown, null);
  assert.equal(plain.experience.length, 2);
  assert.equal(plain.experience[0]?.company, "杭州青禾贸易有限公司");
  assert.equal(plain.experience[0]?.title, "产品经理");
  assert.equal(plain.experience[0]?.highlights.length, 2);
  assert.equal(plain.experience[1]?.company, "宁波海风软件有限公司");
  assert.equal(plain.education[0]?.school, "浙江大学");
  assert.equal(plain.education[0]?.major, "信息管理与信息系统");
  assert.equal(plain.education[0]?.degree, "本科");

  const rewritten = parseResume(readSample("resume-zh.md"), true);
  assert.ok(rewritten.rewriteMarkdown);
  const markdown = rewritten.rewriteMarkdown ?? "";
  assert.match(markdown, /杭州青禾贸易有限公司/);
  assert.match(markdown, /宁波海风软件有限公司/);
  assert.match(markdown, /浙江大学/);
  for (const value of numbersIn(markdown)) {
    assert.ok(numbersIn(readSample("resume-zh.md")).has(value), value);
  }
  assert.doesNotMatch(markdown, /年薪|精通|领导了/);
});
