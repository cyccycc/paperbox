import { labeledValue, sectionBody } from "../text";
import type { ContractData, ContractParty } from "../types";

function clausesFrom(text: string): string[] {
  const body =
    sectionBody(text, ["主要条款", "关键条款", "条款", "Key Clauses", "Clauses"], ["附件", "签署", "签章"]) ||
    text;
  const clauses: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:\d+[.、)]\s*|[-*•]\s+)(.+)$/);
    if (!match?.[1]) continue;
    const clause = match[1].trim();
    if (!clause || /[:：]/.test(clause) && /^(甲方|乙方|合同期限|合同金额)/.test(clause)) continue;
    clauses.push(clause);
  }
  return clauses;
}

function titleFrom(text: string): string {
  const explicit = labeledValue(text, ["合同名称", "合同标题", "Title"]);
  if (explicit) return explicit;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim().replace(/^#+\s*/, "");
    if (!trimmed) continue;
    if (/[:：]/.test(trimmed)) continue;
    if (/^[-*|`]/.test(trimmed)) continue;
    return trimmed;
  }
  return "";
}

export function parseContract(text: string): ContractData {
  const parties: ContractParty[] = [];
  const partyA = labeledValue(text, ["甲方", "Party A"]);
  const partyB = labeledValue(text, ["乙方", "Party B"]);
  if (partyA) parties.push({ role: "甲方", name: partyA });
  if (partyB) parties.push({ role: "乙方", name: partyB });

  const clauses = clausesFrom(text);
  const summary = clauses.join(" ");

  return {
    title: titleFrom(text),
    parties,
    term: labeledValue(text, ["合同期限", "履行期限", "期限", "Term"]),
    amount: labeledValue(text, ["合同金额", "总金额", "合同价款", "Amount"]),
    clauses,
    summary,
  };
}
