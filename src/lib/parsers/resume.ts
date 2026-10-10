import { introducesNewNumbers, labeledValue, sectionBody } from "../text";
import type { EducationItem, ExperienceItem, ResumeData } from "../types";

const PERIOD =
  /(\d{4}[./\-年]\d{1,2}(?:月)?\s*[-–—~至到]+\s*(?:至今|现在|今|\d{4}[./\-年]\d{1,2}(?:月)?))/;

function splitParts(value: string): string[] {
  return value
    .split(/\s{2,}|\t+|\s\|\s/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseBlocks(section: string): { period: string; parts: string[]; highlights: string[] }[] {
  const blocks: { period: string; parts: string[]; highlights: string[] }[] = [];
  let current: { period: string; parts: string[]; highlights: string[] } | null = null;

  for (const raw of section.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^#{1,6}\s+/.test(line)) continue;
    const periodMatch = line.match(PERIOD);
    if (periodMatch?.[1] && periodMatch.index !== undefined) {
      const rest = line.slice(periodMatch.index + periodMatch[1].length).trim();
      current = { period: periodMatch[1].trim(), parts: splitParts(rest), highlights: [] };
      blocks.push(current);
      continue;
    }
    const bullet = line.match(/^(?:[-*•]\s+|\d+[.、)]\s+)(.+)$/);
    if (bullet?.[1] && current) current.highlights.push(bullet[1].trim());
  }
  return blocks;
}

function finishSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/[。！？.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}。`;
}

export function rewriteResume(data: Omit<ResumeData, "rewriteMarkdown">, source: string): string | null {
  const lines: string[] = [`# ${data.name || "简历"}`, ""];
  if (data.phone) lines.push(`- 电话：${data.phone}`);
  if (data.email) lines.push(`- 邮箱：${data.email}`);
  if (data.targetRole) lines.push(`- 求职意向：${data.targetRole}`);
  lines.push("", "本整理稿只使用原文已经写明的信息，没有新增公司、时间、职责或数字。", "");

  if (data.experience.length > 0) {
    lines.push("## 工作经历", "");
    for (const item of data.experience) {
      const heading = [item.title, item.company].filter(Boolean).join(" · ");
      lines.push(`### ${heading || "经历"}`);
      if (item.period) lines.push(item.period);
      lines.push("");
      for (const highlight of item.highlights) lines.push(`- ${finishSentence(highlight)}`);
      lines.push("");
    }
  }

  if (data.education.length > 0) {
    lines.push("## 教育经历", "");
    for (const item of data.education) {
      const heading = [item.school, item.major].filter(Boolean).join(" · ");
      lines.push(`### ${heading || "教育"}`);
      const meta = [item.period, item.degree].filter(Boolean).join(" · ");
      if (meta) lines.push(meta);
      lines.push("");
    }
  }

  const markdown = lines.join("\n").trim();
  if (introducesNewNumbers(source, markdown)) return null;
  return markdown;
}

export function parseResume(text: string, rewrite: boolean): ResumeData {
  const experienceSection = sectionBody(
    text,
    ["工作经历", "工作经验", "Experience"],
    ["教育经历", "教育背景", "Education", "项目经历", "技能特长", "技能"],
  );
  const educationSection = sectionBody(
    text,
    ["教育经历", "教育背景", "Education"],
    ["项目经历", "技能特长", "技能", "自我评价", "证书"],
  );

  const experience: ExperienceItem[] = parseBlocks(experienceSection).map((block) => ({
    period: block.period,
    company: block.parts[0] ?? "",
    title: block.parts[1] ?? "",
    highlights: block.highlights,
  }));

  const education: EducationItem[] = parseBlocks(educationSection).map((block) => ({
    period: block.period,
    school: block.parts[0] ?? "",
    major: block.parts[1] ?? "",
    degree: block.parts[2] ?? "",
  }));

  const base = {
    name: labeledValue(text, ["姓名", "名字", "Name"]),
    phone: labeledValue(text, ["电话", "手机", "联系电话", "Phone", "Tel"]),
    email: labeledValue(text, ["邮箱", "电子邮件", "Email", "E-mail"]),
    targetRole: labeledValue(text, ["求职意向", "应聘岗位", "目标岗位", "意向岗位", "Target Role"]),
    experience,
    education,
  };

  return {
    ...base,
    rewriteMarkdown: rewrite ? rewriteResume(base, text) : null,
  };
}
