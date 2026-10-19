import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownBody } from "@/components/markdown-body";
import { findPost, posts, readPostMarkdown } from "@/lib/blog";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl pt-6">
      <p className="text-sm text-ink-soft">
        <Link href="/blog" className="underline-offset-2 hover:text-seal hover:underline">
          教程
        </Link>
      </p>
      <div className="mt-4">
        <MarkdownBody source={readPostMarkdown(post.slug)} />
      </div>
    </article>
  );
}
