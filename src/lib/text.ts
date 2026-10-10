export function clip(value: string, max = 200): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}…`;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isBlankText(value: string): boolean {
  return value.replace(/[\s\u0000\uFEFF]/g, "").length === 0;
}

export function labeledValue(text: string, labels: string[]): string {
  const lines = text.split(/\r?\n/);
  for (const label of labels) {
    const pattern = new RegExp(`^${escapeRegExp(label)}\\s*[:：]\\s*(.+)$`, "i");
    for (const line of lines) {
      const match = line.trim().replace(/^[-*•]\s+/, "").match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }
  return "";
}

export function sectionBody(text: string, startLabels: string[], endLabels: string[]): string {
  const lines = text.split(/\r?\n/);
  const normalize = (line: string) =>
    line
      .trim()
      .replace(/^#{1,6}\s+/, "")
      .replace(/[:：]\s*$/, "");

  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const heading = normalize(lines[index] ?? "");
    if (startLabels.includes(heading)) {
      start = index + 1;
      break;
    }
  }
  if (start < 0) return "";

  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    const heading = normalize(lines[index] ?? "");
    if (endLabels.includes(heading)) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

export function currencyOf(amount: string): string {
  if (/\$|USD|美元/.test(amount)) return "USD";
  if (/¥|￥|人民币|CNY|元/.test(amount)) return "CNY";
  return "";
}

export function sourcePreview(text: string, max = 1500): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function numbersIn(text: string): Set<string> {
  return new Set(text.match(/\d+(?:\.\d+)?%?/g) ?? []);
}

export function introducesNewNumbers(source: string, rewrite: string): boolean {
  const known = numbersIn(source);
  for (const value of numbersIn(rewrite)) {
    if (!known.has(value)) return true;
  }
  return false;
}
