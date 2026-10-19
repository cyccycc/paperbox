import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseMarkdown, type Block, type Inline } from "../src/lib/markdown";

const source = readFileSync(new URL("../content/blog/invoice-pdf-to-excel.md", import.meta.url), "utf8");

function textOf(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.text;
      if (node.type === "br") return "\n";
      if (node.type === "strong" || node.type === "link") return textOf(node.children);
      return "";
    })
    .join("");
}

function linksIn(nodes: Inline[]): string[] {
  return nodes.flatMap((node) => {
    if (node.type === "link") return [node.href, ...linksIn(node.children)];
    if (node.type === "strong") return linksIn(node.children);
    return [];
  });
}

function blockText(block: Block): string {
  if (block.type === "heading" || block.type === "paragraph") return textOf(block.children);
  if (block.type === "list") return block.items.map((item) => textOf(item)).join("\n");
  return "";
}

test("invoice article keeps its wording, headings, and absolute links", () => {
  const blocks = parseMarkdown(source);
  const combined = blocks.map(blockText).join("\n");
  const hrefs = blocks.flatMap((block) => {
    if (block.type === "heading" || block.type === "paragraph") return linksIn(block.children);
    if (block.type === "list") return block.items.flatMap((item) => linksIn(item));
    return [];
  });
  const sourceHrefs = [...source.matchAll(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g)].map((match) => match[1]);

  assert.equal(blocks[0]?.type, "heading");
  if (blocks[0]?.type === "heading") {
    assert.equal(blocks[0].level, 1);
    assert.equal(textOf(blocks[0].children), "电子发票 PDF 怎么抽成表格（不用再手抄）");
  }
  assert.deepEqual(
    blocks.filter((block) => block.type === "heading" && block.level === 2).map(blockText),
    ["导出结果长什么样", "怎么操作（5 步）", "使用边界（避免白跑）", "谁适合先试", "常见问题"],
  );
  assert.equal(blocks.filter((block) => block.type === "list" && block.ordered).flatMap((block) => (block.type === "list" ? block.items : [])).length, 5);
  assert.match(combined, /每月要处理多张电子发票/);
  assert.match(combined, /新用户免费 10 次/);
  assert.equal(combined.includes("**"), false);
  assert.deepEqual(hrefs, sourceHrefs);
  assert.ok(hrefs.every((href) => href.startsWith("https://paper.cyccycc.xyz")));
  assert.ok(hrefs.includes("https://paper.cyccycc.xyz/register"));
  assert.ok(hrefs.includes("https://paper.cyccycc.xyz/#支持发票类型"));
  assert.ok(hrefs.includes("https://paper.cyccycc.xyz/#批量上限"));
  assert.ok(hrefs.includes("https://paper.cyccycc.xyz/#出表示例"));
});
