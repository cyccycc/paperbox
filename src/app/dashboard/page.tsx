import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UploadForm } from "@/components/upload-form";
import { getSession } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { docLabel, isDocType } from "@/lib/types";

export const metadata: Metadata = { title: "工作台" };
export const dynamic = "force-dynamic";

function formatWhen(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

const statusLabel: Record<string, string> = {
  done: "已完成",
  no_text: "无法读取",
  error: "失败",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const jobs = await prisma.job.findMany({
    where: { userId: session.uid },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-8 pt-2">
      <div>
        <h1 className="font-serif text-4xl">工作台</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">选择文档类型，上传文件或使用示例。提取完成后可以下载 Excel 或 Markdown。</p>
      </div>
      <UploadForm />
      <section>
        <h2 className="font-serif text-2xl">最近的结果</h2>
        {jobs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">还没有任务。上传一份文档，或点击「使用示例」。</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-sheet">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-white" href={`/jobs/${job.id}`}>
                  <span>
                    <span className="mr-2 text-xs text-seal">{isDocType(job.type) ? docLabel(job.type) : job.type}</span>
                    <span>{job.originalName}</span>
                  </span>
                  <span className="text-sm text-ink-soft">
                    {statusLabel[job.status] ?? job.status} · {formatWhen(job.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
