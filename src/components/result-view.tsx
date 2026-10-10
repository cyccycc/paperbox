import type { ContractData, InvoiceData, ResumeData, StoredResult } from "@/lib/types";
import { docLabel, type DocType } from "@/lib/types";
import { offlineBanner } from "@/lib/extract";

function Missing({ value }: { value: string }) {
  if (value) return <span>{value}</span>;
  return <span className="text-ink/40">未识别</span>;
}

function InvoiceView({ data }: { data: InvoiceData }) {
  return (
    <div className="space-y-5">
      <dl className="grid gap-3 sm:grid-cols-2">
        {[
          ["销售方", data.merchant],
          ["纳税人识别号", data.taxId],
          ["开票日期", data.date],
          ["价税合计", data.amount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-white px-4 py-3">
            <dt className="text-xs text-ink-soft">{label}</dt>
            <dd className="mt-1 text-base">
              <Missing value={value ?? ""} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-seal text-white">
            <tr>
              {["项目", "数量", "单价", "金额"].map((heading) => (
                <th key={heading} className="px-3 py-2 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.lineItems.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-ink-soft" colSpan={4}>
                  未识别到明细。
                </td>
              </tr>
            ) : (
              data.lineItems.map((item, index) => (
                <tr key={`${item.name}-${index}`} className="border-b border-line">
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{item.unitPrice}</td>
                  <td className="px-3 py-2">{item.amount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContractView({ data }: { data: ContractData }) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-2xl">{data.title || "合同"}</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {data.parties.map((party) => (
          <div key={`${party.role}-${party.name}`} className="rounded-xl border border-line bg-white px-4 py-3">
            <dt className="text-xs text-ink-soft">{party.role}</dt>
            <dd className="mt-1">{party.name}</dd>
          </div>
        ))}
        <div className="rounded-xl border border-line bg-white px-4 py-3">
          <dt className="text-xs text-ink-soft">合同期限</dt>
          <dd className="mt-1">
            <Missing value={data.term} />
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-white px-4 py-3">
          <dt className="text-xs text-ink-soft">合同金额</dt>
          <dd className="mt-1">
            <Missing value={data.amount} />
          </dd>
        </div>
      </dl>
      <section>
        <h3 className="text-sm text-ink-soft">要点摘要</h3>
        <p className="mt-2 leading-7">
          <Missing value={data.summary} />
        </p>
      </section>
      <section>
        <h3 className="text-sm text-ink-soft">主要条款</h3>
        {data.clauses.length === 0 ? (
          <p className="mt-2 text-ink/40">未识别</p>
        ) : (
          <ol className="mt-2 list-decimal space-y-2 pl-5 leading-7">
            {data.clauses.map((clause) => (
              <li key={clause}>{clause}</li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function ResumeView({ data }: { data: ResumeData }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl">{data.name || "简历"}</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {[data.targetRole && `意向 ${data.targetRole}`, data.phone, data.email].filter(Boolean).join(" · ") || "未识别联系方式"}
        </p>
      </div>
      <section>
        <h3 className="font-serif text-xl">工作经历</h3>
        <div className="mt-3 space-y-4">
          {data.experience.length === 0 ? <p className="text-ink/40">未识别</p> : null}
          {data.experience.map((item, index) => (
            <article key={`${item.company}-${index}`} className="rounded-xl border border-line bg-white px-4 py-3">
              <h4 className="font-medium">{[item.title, item.company].filter(Boolean).join(" · ") || "经历"}</h4>
              <p className="mt-1 text-sm text-ink-soft">{item.period}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
                {item.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h3 className="font-serif text-xl">教育经历</h3>
        <div className="mt-3 space-y-3">
          {data.education.length === 0 ? <p className="text-ink/40">未识别</p> : null}
          {data.education.map((item, index) => (
            <article key={`${item.school}-${index}`} className="rounded-xl border border-line bg-white px-4 py-3">
              <h4 className="font-medium">{[item.school, item.major].filter(Boolean).join(" · ")}</h4>
              <p className="mt-1 text-sm text-ink-soft">{[item.period, item.degree].filter(Boolean).join(" · ")}</p>
            </article>
          ))}
        </div>
      </section>
      {data.rewriteMarkdown ? (
        <section>
          <h3 className="font-serif text-xl">润色稿</h3>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl border border-line bg-white p-4 text-sm leading-7">
            {data.rewriteMarkdown}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

export function ResultView({
  type,
  mode,
  fallbackReason,
  stored,
}: {
  type: DocType;
  mode: string;
  fallbackReason: string | null;
  stored: StoredResult;
}) {
  const banner =
    mode === "offline" ? offlineBanner(fallbackReason) : mode === "ai" ? "本次由模型提取。" : null;
  const warning = mode === "offline" && Boolean(fallbackReason);

  return (
    <div className="space-y-5">
      {banner ? (
        <p className={`rounded-xl px-4 py-3 text-sm leading-6 ${warning ? "bg-warn-soft text-warn" : "bg-moss-soft text-moss"}`} role="status">
          {banner}
        </p>
      ) : null}
      {stored.note ? (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm leading-6 text-warn" role="status">
          {stored.note}
        </p>
      ) : null}
      <div className="sheet rounded-2xl p-5">
        <p className="text-xs tracking-wide text-ink-soft">{docLabel(type)}</p>
        {type === "invoice" ? <InvoiceView data={stored.data as InvoiceData} /> : null}
        {type === "contract" ? <ContractView data={stored.data as ContractData} /> : null}
        {type === "resume" ? <ResumeView data={stored.data as ResumeData} /> : null}
      </div>
      {stored.sourcePreview ? (
        <details className="rounded-2xl border border-line bg-sheet px-4 py-3 text-sm">
          <summary className="cursor-pointer text-ink-soft">查看原文摘录</summary>
          <pre className="mt-3 whitespace-pre-wrap leading-6">{stored.sourcePreview}</pre>
        </details>
      ) : null}
    </div>
  );
}
