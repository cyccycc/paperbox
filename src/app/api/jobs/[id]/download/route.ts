import { NextResponse } from "next/server";
import { getSession } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { contractToMarkdown, resumeToMarkdown } from "@/lib/export/markdown";
import { invoiceToXlsx } from "@/lib/export/invoice-xlsx";
import { contentDisposition, downloadName } from "@/lib/export/safe";
import { isDocType, type ContractData, type InvoiceData, type ResumeData, type StoredResult } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await context.params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.uid } });
  if (!job || !isDocType(job.type)) return NextResponse.json({ error: "找不到这份结果。" }, { status: 404 });
  if (job.status === "no_text") {
    return NextResponse.json({ error: job.message || "这份 PDF 没有文字层，无法导出。" }, { status: 400 });
  }
  if (job.status !== "done" || !job.resultJson) {
    return NextResponse.json({ error: "这份结果还不能下载。" }, { status: 409 });
  }

  let stored: StoredResult;
  try {
    stored = JSON.parse(job.resultJson) as StoredResult;
  } catch {
    return NextResponse.json({ error: "结果已损坏，请重新上传。" }, { status: 500 });
  }
  if (job.type === "invoice") {
    const data = stored.data as InvoiceData;
    const file = await invoiceToXlsx(data);
    const filename = downloadName(`纸匣-发票-${data.merchant || "未命名"}.xlsx`);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition(filename),
      },
    });
  }

  const markdown =
    job.type === "contract"
      ? contractToMarkdown(stored.data as ContractData)
      : resumeToMarkdown(stored.data as ResumeData);
  const stem =
    job.type === "contract"
      ? (stored.data as ContractData).title || "未命名"
      : (stored.data as ResumeData).name || "未命名";
  const filename = downloadName(`纸匣-${job.type === "contract" ? "合同" : "简历"}-${stem}.md`);
  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": contentDisposition(filename),
    },
  });
}
