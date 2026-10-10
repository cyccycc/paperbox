import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ResultView } from "@/components/result-view";
import { getSession } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { docLabel, isDocType, type StoredResult } from "@/lib/types";

export const metadata: Metadata = { title: "提取结果" };
export const dynamic = "force-dynamic";

function readStored(raw: string | null): StoredResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredResult;
    if (!parsed || typeof parsed !== "object" || !("data" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.uid } });
  if (!job || !isDocType(job.type)) notFound();
  const stored = readStored(job.resultJson);

  return (
    <div className="space-y-6 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">
            <Link className="hover:text-seal" href="/dashboard">
              工作台
            </Link>
            <span> / {docLabel(job.type)}</span>
          </p>
          <h1 className="mt-1 font-serif text-4xl">提取结果</h1>
          <p className="mt-2 text-sm text-ink-soft">{job.originalName}</p>
        </div>
        {job.status === "done" ? (
          <a className="rounded-full bg-seal px-5 py-2.5 text-sm text-white hover:bg-seal-deep" href={`/api/jobs/${job.id}/download`}>
            下载{job.type === "invoice" ? " Excel" : " Markdown"}
          </a>
        ) : null}
      </div>

      {job.status === "no_text" ? (
        <div className="rounded-2xl border border-warn bg-warn-soft p-5 leading-7 text-warn" role="alert">
          <p className="font-medium">无法从这份 PDF 抽出文字</p>
          <p className="mt-2">{job.message}</p>
        </div>
      ) : null}

      {job.status === "done" && stored ? (
        <ResultView type={job.type} mode={job.mode} fallbackReason={job.fallbackReason} stored={stored} />
      ) : null}

      {job.status === "done" && !stored ? (
        <p className="text-warn">结果已损坏，请重新上传。</p>
      ) : null}
    </div>
  );
}
