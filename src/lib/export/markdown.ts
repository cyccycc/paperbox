import type { ContractData, ResumeData } from "../types";

export function contractToMarkdown(data: ContractData): string {
  const lines: string[] = [`# ${data.title || "合同"}`, ""];
  if (data.parties.length > 0) {
    lines.push("## 当事人", "");
    for (const party of data.parties) lines.push(`- ${party.role}：${party.name}`);
    lines.push("");
  }
  lines.push("## 合同期限", "", data.term || "未识别", "");
  lines.push("## 合同金额", "", data.amount || "未识别", "");
  lines.push("## 要点摘要", "", data.summary || "未识别", "");
  lines.push("## 主要条款", "");
  if (data.clauses.length === 0) lines.push("未识别");
  else data.clauses.forEach((clause, index) => lines.push(`${index + 1}. ${clause}`));
  lines.push("");
  return lines.join("\n");
}

export function resumeToMarkdown(data: ResumeData): string {
  const lines: string[] = [`# ${data.name || "简历"}`, ""];
  if (data.phone) lines.push(`- 电话：${data.phone}`);
  if (data.email) lines.push(`- 邮箱：${data.email}`);
  if (data.targetRole) lines.push(`- 求职意向：${data.targetRole}`);
  lines.push("");

  lines.push("## 工作经历", "");
  if (data.experience.length === 0) lines.push("未识别", "");
  for (const item of data.experience) {
    lines.push(`### ${[item.title, item.company].filter(Boolean).join(" · ") || "经历"}`);
    if (item.period) lines.push(item.period, "");
    for (const highlight of item.highlights) lines.push(`- ${highlight}`);
    lines.push("");
  }

  lines.push("## 教育经历", "");
  if (data.education.length === 0) lines.push("未识别", "");
  for (const item of data.education) {
    lines.push(`### ${[item.school, item.major].filter(Boolean).join(" · ") || "教育"}`);
    const meta = [item.period, item.degree].filter(Boolean).join(" · ");
    if (meta) lines.push(meta);
    lines.push("");
  }

  if (data.rewriteMarkdown) {
    lines.push("---", "", "## 润色稿", "", data.rewriteMarkdown, "");
  }
  return lines.join("\n");
}
