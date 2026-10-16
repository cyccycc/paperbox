import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyAnchors } from "@/components/copy-anchors";
import { UploadForm } from "@/components/upload-form";
import { runtimeMode } from "@/lib/config";
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

  const [user, jobs] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.uid }, select: { credits: true } }),
    prisma.job.findMany({
      where: { userId: session.uid },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  if (!user) redirect("/login");
  const credits = user.credits;
  const mode = runtimeMode();
  const modeActive = mode.id !== "offline";

  return (
    <div className="space-y-8 pt-2">
      <div>
        <h1 className="font-serif text-4xl">工作台</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">选择文档类型并上传文件。提取完成后可以下载 Excel 或 Markdown。</p>
        <p className="mt-4" role="status">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
              modeActive ? "border-moss bg-moss-soft text-moss" : "border-line bg-sheet text-ink-soft"
            }`}
          >
            <span>当前模式</span>
            <span className="font-medium text-ink">{mode.label}</span>
            {mode.model ? <span>{mode.model}</span> : null}
          </span>
        </p>
      </div>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-sheet px-5 py-4">
        <div>
          <p className="text-sm text-ink-soft">剩余额度</p>
          <p className="mt-1 font-serif text-4xl leading-none">
            {credits}
            <span className="ml-2 font-sans text-lg">次</span>
          </p>
        </div>
        <p className="max-w-sm text-sm leading-6 text-ink-soft">
          {credits > 0
            ? "每次成功提取消耗 1 次。读不出文字的 PDF 不扣额度。"
            : "额度已用完，上传已暂停。购买额度后可以继续。"}
        </p>
        <Link
          href="/billing"
          className={
            credits > 0
              ? "rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-seal hover:text-seal"
              : "rounded-full bg-seal px-4 py-2 text-sm text-white hover:bg-seal-deep"
          }
        >
          购买额度
        </Link>
      </section>
      <UploadForm credits={credits} />
      <CopyAnchors />
      <section>
        <h2 className="font-serif text-2xl">最近的结果</h2>
        {jobs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">还没有任务。选择类型并上传一份文档。</p>
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
