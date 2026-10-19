import type { Metadata } from "next";
import Link from "next/link";
import { posts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "教程",
  description: "电子发票还在手抄进 Excel？上传有文字层的 PDF/TXT/MD，核对后下载概览+明细表。新用户免费 10 次。",
};

export default function BlogIndexPage() {
  return (
    <div className="mx-auto max-w-3xl pt-6">
      <h1 className="font-serif text-4xl">教程</h1>
      <ul className="mt-8 space-y-4">
        {posts.map((post) => (
          <li key={post.slug}>
            <article className="sheet rounded-2xl p-5">
              <h2 className="font-serif text-2xl leading-snug">
                <Link href={`/blog/${post.slug}`} className="hover:text-seal">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 leading-7 text-ink-soft">{post.description}</p>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
