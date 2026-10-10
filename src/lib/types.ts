export const DOC_TYPES = ["invoice", "contract", "resume"] as const;

export type DocType = (typeof DOC_TYPES)[number];

export type LineItem = {
  name: string;
  quantity: string;
  unitPrice: string;
  amount: string;
};

export type InvoiceData = {
  merchant: string;
  taxId: string;
  date: string;
  amount: string;
  currency: string;
  lineItems: LineItem[];
};

export type ContractParty = {
  role: string;
  name: string;
};

export type ContractData = {
  title: string;
  parties: ContractParty[];
  term: string;
  amount: string;
  clauses: string[];
  summary: string;
};

export type ExperienceItem = {
  period: string;
  company: string;
  title: string;
  highlights: string[];
};

export type EducationItem = {
  period: string;
  school: string;
  major: string;
  degree: string;
};

export type ResumeData = {
  name: string;
  phone: string;
  email: string;
  targetRole: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  rewriteMarkdown: string | null;
};

export type ExtractionData = InvoiceData | ContractData | ResumeData;

export type StoredResult = {
  data: ExtractionData;
  note: string | null;
  sourcePreview: string;
};

export type ExtractMode = "ai" | "offline" | "none";

export type JobStatus = "done" | "no_text" | "error";

export function isDocType(value: string): value is DocType {
  return (DOC_TYPES as readonly string[]).includes(value);
}

export const NO_TEXT_MESSAGE =
  "这份 PDF 没有可选中的文字，通常是扫描件或纯图片。纸匣只能读取文字层。请把内容另存为 TXT 或 Markdown 后再上传。";

export function docLabel(type: DocType): string {
  if (type === "invoice") return "发票";
  if (type === "contract") return "合同";
  return "简历";
}
