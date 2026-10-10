import { currencyOf, labeledValue } from "../text";
import type { InvoiceData, LineItem } from "../types";

const ITEM_LINE =
  /^\s*(?:\d+[.、)]\s*)?(.+?)\s*\|\s*(?:数量|qty)\s*[:：]?\s*([0-9.,]+)\s*\|\s*(?:单价|unit(?:\s*price)?)\s*[:：]?\s*([0-9.,]+)\s*\|\s*(?:金额|amount)\s*[:：]?\s*([0-9.,]+)\s*$/i;

function parsePipeItems(text: string): LineItem[] {
  const items: LineItem[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(ITEM_LINE);
    if (!match) continue;
    items.push({
      name: match[1]?.trim() ?? "",
      quantity: match[2]?.trim() ?? "",
      unitPrice: match[3]?.trim() ?? "",
      amount: match[4]?.trim() ?? "",
    });
  }
  return items;
}

function parseTableItems(text: string): LineItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));
  if (lines.length < 2) return [];

  const cells = (line: string) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

  const header = cells(lines[0] ?? "").map((cell) => cell.toLowerCase());
  const nameAt = header.findIndex((cell) => /项目|名称|name|description|item/.test(cell));
  const qtyAt = header.findIndex((cell) => /数量|qty|quantity/.test(cell));
  const priceAt = header.findIndex((cell) => /单价|unit/.test(cell));
  const amountAt = header.findIndex((cell) => /金额|amount|total/.test(cell));
  if (nameAt < 0 || amountAt < 0) return [];

  const items: LineItem[] = [];
  for (const line of lines.slice(1)) {
    const row = cells(line);
    if (row.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    const name = row[nameAt] ?? "";
    if (!name) continue;
    items.push({
      name,
      quantity: qtyAt >= 0 ? (row[qtyAt] ?? "") : "",
      unitPrice: priceAt >= 0 ? (row[priceAt] ?? "") : "",
      amount: row[amountAt] ?? "",
    });
  }
  return items;
}

export function parseInvoice(text: string): InvoiceData {
  const amount = labeledValue(text, [
    "价税合计（小写）",
    "价税合计(小写)",
    "价税合计",
    "合计金额",
    "总计",
    "应付金额",
    "Amount Due",
    "Grand Total",
    "Total",
  ]);

  const pipeItems = parsePipeItems(text);
  const lineItems = pipeItems.length > 0 ? pipeItems : parseTableItems(text);

  return {
    merchant: labeledValue(text, ["销售方名称", "销售方", "销方", "商家", "商户", "开票方", "收款方", "Merchant", "Seller", "Vendor"]),
    taxId: labeledValue(text, [
      "销售方纳税人识别号",
      "销售方税号",
      "纳税人识别号",
      "纳税识别号",
      "统一社会信用代码",
      "税号",
      "Tax ID",
      "Tax No.",
      "Tax No",
      "VAT No.",
      "VAT No",
    ]),
    date: labeledValue(text, ["开票日期", "发票日期", "Invoice Date", "日期", "Date"]),
    amount,
    currency: currencyOf(amount),
    lineItems,
  };
}
