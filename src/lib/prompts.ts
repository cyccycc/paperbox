import type { DocType } from "./types";

function invoiceShape(): string {
  return `{
  "merchant": "销售方或商家",
  "taxId": "销售方纳税人识别号或税号",
  "date": "开票日期",
  "amount": "价税合计，保留原文货币符号",
  "currency": "CNY 或 USD，无法判断则空字符串",
  "lineItems": [{ "name": "", "quantity": "", "unitPrice": "", "amount": "" }]
}`;
}

function contractShape(): string {
  return `{
  "title": "合同名称",
  "parties": [{ "role": "甲方", "name": "" }],
  "term": "合同期限",
  "amount": "合同金额，保留原文表述",
  "clauses": ["逐条摘录关键条款，不要编造"],
  "summary": "用原文事实压缩的要点，不要新增义务、数字或日期"
}`;
}

function resumeShape(rewrite: boolean): string {
  const rewriteField = rewrite
    ? `,
  "rewriteMarkdown": "Markdown。只改写原文已有事实，禁止新增公司、时间、职位、职责或数字"`
    : "";
  return `{
  "name": "",
  "phone": "",
  "email": "",
  "targetRole": "",
  "experience": [{ "period": "", "company": "", "title": "", "highlights": [""] }],
  "education": [{ "period": "", "school": "", "major": "", "degree": "" }]${rewriteField}
}`;
}

export function systemPrompt(type: DocType, rewrite: boolean): string {
  const shape = type === "invoice" ? invoiceShape() : type === "contract" ? contractShape() : resumeShape(rewrite);
  const rewriteRule = rewrite
    ? "用户要求润色简历。rewriteMarkdown 只能重组原文里已经出现的信息，不能补充新事实。"
    : "不要输出原文没有的字段值。缺失就用空字符串或空数组。";
  return [
    "你是纸匣的文档字段提取器。只根据用户给出的文档文本输出一个 json 对象，不要 Markdown 代码块，不要解释。",
    "禁止编造文档中不存在的公司、金额、日期、税号、条款或经历。",
    rewriteRule,
    "JSON 形状：",
    shape,
  ].join("\n");
}
