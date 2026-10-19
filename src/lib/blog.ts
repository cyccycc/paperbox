import { readFileSync } from "node:fs";
import path from "node:path";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
};

export const posts: BlogPost[] = [
  {
    slug: "invoice-pdf-to-excel",
    title: "电子发票 PDF 怎么抽成表格（不用再手抄）",
    description:
      "电子发票还在手抄进 Excel？上传有文字层的 PDF/TXT/MD，核对后下载概览+明细表。新用户免费 10 次。",
  },
];

export function findPost(slug: string): BlogPost | undefined {
  return posts.find((post) => post.slug === slug);
}

export function readPostMarkdown(slug: string): string {
  const post = findPost(slug);
  if (!post || !/^[a-z0-9-]+$/.test(post.slug)) {
    throw new Error("Unknown blog post");
  }
  return readFileSync(path.join(process.cwd(), "content/blog", `${post.slug}.md`), "utf8");
}
