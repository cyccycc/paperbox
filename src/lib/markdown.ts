export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] }
  | { type: "br" };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "hr" };

function parseInline(input: string): Inline[] {
  const nodes: Inline[] = [];
  let text = "";
  let index = 0;

  const flush = () => {
    if (!text) return;
    nodes.push({ type: "text", text });
    text = "";
  };

  while (index < input.length) {
    if (input[index] === "\n") {
      flush();
      nodes.push({ type: "br" });
      index += 1;
      continue;
    }

    if (input.startsWith("**", index)) {
      const end = input.indexOf("**", index + 2);
      if (end !== -1) {
        flush();
        nodes.push({ type: "strong", children: parseInline(input.slice(index + 2, end)) });
        index = end + 2;
        continue;
      }
    }

    if (input[index] === "[") {
      const labelEnd = input.indexOf("]", index + 1);
      if (labelEnd !== -1 && input[labelEnd + 1] === "(") {
        const hrefEnd = input.indexOf(")", labelEnd + 2);
        if (hrefEnd !== -1) {
          const href = input.slice(labelEnd + 2, hrefEnd);
          if (/^https?:\/\//.test(href)) {
            flush();
            nodes.push({
              type: "link",
              href,
              children: parseInline(input.slice(index + 1, labelEnd)),
            });
            index = hrefEnd + 1;
            continue;
          }
        }
      }
    }

    text += input[index];
    index += 1;
  }

  flush();
  return nodes;
}

function joinLines(lines: string[]): string {
  let output = "";
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    const hardBreak = /  $/.test(raw);
    output += raw.trim();
    if (index < lines.length - 1) output += hardBreak ? "\n" : " ";
  }
  return output;
}

function isBlank(line: string | undefined): boolean {
  return (line ?? "").trim() === "";
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isBlank(line)) {
      index += 1;
      continue;
    }

    if (line.trim() === "---") {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3;
      blocks.push({ type: "heading", level, children: parseInline(heading[2].trim()) });
      index += 1;
      continue;
    }

    const unordered = /^[-*] /.test(line);
    const ordered = /^\d+\. /.test(line);
    if (unordered || ordered) {
      const items: Inline[][] = [];
      while (index < lines.length) {
        const current = lines[index] ?? "";
        if (isBlank(current)) {
          let lookAhead = index + 1;
          while (lookAhead < lines.length && isBlank(lines[lookAhead])) lookAhead += 1;
          const next = lines[lookAhead] ?? "";
          const continues = ordered ? /^\d+\. /.test(next) : /^[-*] /.test(next);
          if (!continues) break;
          index = lookAhead;
          continue;
        }

        const marker = ordered ? /^\d+\. / : /^[-*] /;
        if (!marker.test(current)) break;

        const itemLines = [current.replace(marker, "")];
        index += 1;
        while (index < lines.length && /^ {2,}\S/.test(lines[index] ?? "")) {
          itemLines.push(lines[index] ?? "");
          index += 1;
        }
        items.push(parseInline(joinLines(itemLines)));
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (isBlank(current) || /^(#{1,3} |[-*] |\d+\. )/.test(current) || current.trim() === "---") break;
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", children: parseInline(joinLines(paragraph)) });
  }

  return blocks;
}
