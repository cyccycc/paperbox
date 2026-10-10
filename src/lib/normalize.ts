import { introducesNewNumbers } from "./text";
import { parseResume } from "./parsers/resume";
import type { ContractData, DocType, ExtractionData, InvoiceData, ResumeData } from "./types";

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pick(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeInvoice(value: unknown): InvoiceData | null {
  const record = asRecord(value);
  if (!record) return null;
  const lineItems = asArray(record.lineItems ?? record.items ?? record.details).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      name: pick(row, ["name", "item", "description", "title", "项目", "名称"]),
      quantity: pick(row, ["quantity", "qty", "数量"]),
      unitPrice: pick(row, ["unitPrice", "price", "unit", "单价"]),
      amount: pick(row, ["amount", "total", "金额"]),
    };
  }).filter((item) => item.name || item.amount);

  return {
    merchant: pick(record, ["merchant", "seller", "vendor", "销售方", "商家"]),
    taxId: pick(record, ["taxId", "taxNo", "taxNumber", "税号", "纳税人识别号"]),
    date: pick(record, ["date", "invoiceDate", "开票日期", "日期"]),
    amount: pick(record, ["amount", "total", "价税合计", "合计"]),
    currency: pick(record, ["currency", "币种"]),
    lineItems,
  };
}

function normalizeContract(value: unknown): ContractData | null {
  const record = asRecord(value);
  if (!record) return null;
  const parties = asArray(record.parties).map((party) => {
    const row = asRecord(party) ?? {};
    return {
      role: pick(row, ["role", "角色"]) || "当事人",
      name: pick(row, ["name", "名称"]),
    };
  }).filter((party) => party.name);

  if (parties.length === 0) {
    const partyA = pick(record, ["partyA", "甲方"]);
    const partyB = pick(record, ["partyB", "乙方"]);
    if (partyA) parties.push({ role: "甲方", name: partyA });
    if (partyB) parties.push({ role: "乙方", name: partyB });
  }

  const clauses = asArray(record.clauses ?? record.keyClauses)
    .map((clause) => asString(clause))
    .filter(Boolean);

  return {
    title: pick(record, ["title", "name", "合同名称"]),
    parties,
    term: pick(record, ["term", "duration", "合同期限", "期限"]),
    amount: pick(record, ["amount", "合同金额", "金额"]),
    clauses,
    summary: pick(record, ["summary", "摘要", "要点"]),
  };
}

function normalizeResume(value: unknown, source: string, rewrite: boolean): ResumeData | null {
  const record = asRecord(value);
  if (!record) return null;
  const experience = asArray(record.experience ?? record.work).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      period: pick(row, ["period", "date", "时间"]),
      company: pick(row, ["company", "organization", "公司"]),
      title: pick(row, ["title", "role", "position", "职位"]),
      highlights: asArray(row.highlights ?? row.bullets ?? row.duties).map((entry) => asString(entry)).filter(Boolean),
    };
  }).filter((item) => item.company || item.title || item.highlights.length > 0);

  const education = asArray(record.education).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      period: pick(row, ["period", "date", "时间"]),
      school: pick(row, ["school", "university", "学校"]),
      major: pick(row, ["major", "field", "专业"]),
      degree: pick(row, ["degree", "学历"]),
    };
  }).filter((item) => item.school || item.major || item.degree);

  const base = {
    name: pick(record, ["name", "姓名"]),
    phone: pick(record, ["phone", "tel", "电话"]),
    email: pick(record, ["email", "邮箱"]),
    targetRole: pick(record, ["targetRole", "intention", "求职意向"]),
    experience,
    education,
  };

  let rewriteMarkdown: string | null = null;
  if (rewrite) {
    const modelRewrite = asString(record.rewriteMarkdown ?? record.rewrite);
    if (modelRewrite && !introducesNewNumbers(source, modelRewrite)) {
      rewriteMarkdown = modelRewrite;
    } else {
      rewriteMarkdown = parseResume(source, true).rewriteMarkdown;
    }
  }

  return { ...base, rewriteMarkdown };
}

export function normalizeAi(type: DocType, value: unknown, source: string, rewrite: boolean): ExtractionData | null {
  if (type === "invoice") return normalizeInvoice(value);
  if (type === "contract") return normalizeContract(value);
  return normalizeResume(value, source, rewrite);
}

export function aiRewriteWasReplaced(type: DocType, value: unknown, source: string, rewrite: boolean): boolean {
  if (type !== "resume" || !rewrite) return false;
  const record = asRecord(value);
  if (!record) return false;
  const modelRewrite = asString(record.rewriteMarkdown ?? record.rewrite);
  return Boolean(modelRewrite) && introducesNewNumbers(source, modelRewrite);
}
