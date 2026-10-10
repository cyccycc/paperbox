"use client";

import { useState, type FormEvent } from "react";

const TYPES = [
  {
    id: "invoice",
    label: "发票",
    exportAs: "Excel",
    blurb: "销售方、金额、税号、日期和明细。",
  },
  {
    id: "contract",
    label: "合同",
    exportAs: "Markdown",
    blurb: "当事人、期限、金额和条款摘要。",
  },
  {
    id: "resume",
    label: "简历",
    exportAs: "Markdown",
    blurb: "经历结构化，可选润色且不编造事实。",
  },
] as const;

type DocId = (typeof TYPES)[number]["id"];

export function UploadForm() {
  const [type, setType] = useState<DocId>("invoice");
  const [rewrite, setRewrite] = useState(true);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  async function submit(form: FormData, label: string) {
    setError("");
    setPending(label);
    const response = await fetch("/api/jobs", { method: "POST", body: form });
    const payload = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!response.ok || !payload?.id) {
      setPending("");
      setError(payload?.error || "提取失败，请稍后再试。");
      return;
    }
    window.location.href = `/jobs/${payload.id}`;
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("type", type);
    if (type === "resume" && rewrite) form.set("rewrite", "1");
    else form.delete("rewrite");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("请先选择 TXT、Markdown 或 PDF 文件。");
      return;
    }
    await submit(form, "正在提取…");
  }

  async function runSample(sampleType: DocId) {
    const form = new FormData();
    form.set("type", sampleType);
    form.set("sample", "1");
    if (sampleType === "resume" && rewrite) form.set("rewrite", "1");
    setType(sampleType);
    await submit(form, "正在解析示例…");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {TYPES.map((item) => {
          const selected = type === item.id;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 text-left ${selected ? "border-seal bg-white" : "border-line bg-sheet"}`}
            >
              <button className="w-full text-left" type="button" onClick={() => setType(item.id)}>
                <span className="text-xs tracking-wide text-ink-soft">{item.exportAs}</span>
                <span className="mt-1 block font-serif text-2xl">{item.label}</span>
                <span className="mt-2 block text-sm leading-6 text-ink-soft">{item.blurb}</span>
              </button>
              <button
                className="mt-4 rounded-full border border-line px-3 py-1.5 text-sm hover:border-seal hover:text-seal disabled:opacity-60"
                type="button"
                disabled={Boolean(pending)}
                onClick={() => runSample(item.id)}
              >
                使用示例
              </button>
            </div>
          );
        })}
      </div>

      <form className="sheet space-y-4 rounded-2xl p-5" onSubmit={onUpload}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl">上传文件</h2>
            <p className="mt-1 text-sm text-ink-soft">当前类型：{TYPES.find((item) => item.id === type)?.label}。支持 TXT、Markdown、PDF，最大 5 MB。</p>
          </div>
        </div>
        <label className="block rounded-xl border border-dashed border-line bg-white px-4 py-5 text-sm">
          <span className="text-ink-soft">{fileName || "选择发票、合同或简历文件"}</span>
          <input
            className="mt-3 block w-full text-sm"
            name="file"
            type="file"
            accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
          />
        </label>
        {type === "resume" ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={rewrite}
              onChange={(event) => setRewrite(event.target.checked)}
            />
            <span>
              润色表述（不编造事实）
              <span className="mt-1 block text-ink-soft">只调整已有经历的写法，不会补充新的公司、时间或数字。示例也会遵守这个选项。</span>
            </span>
          </label>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper hover:bg-seal disabled:opacity-60"
          type="submit"
          disabled={Boolean(pending)}
        >
          {pending || "开始提取"}
        </button>
      </form>
      <p className="text-sm leading-6 text-ink-soft">
        「使用示例」会直接解析 samples 里的中文 TXT。也可以自行上传同目录的 Markdown，或带文字层的英文发票 PDF
        samples/invoice-en.pdf。扫描件 samples/scanned-no-text.pdf 没有可选中文字，结果页会说明并建议改用 TXT 或 Markdown。
      </p>
    </div>
  );
}
