import Link from "next/link";

const features = [
  {
    label: "发票",
    exportAs: "导出 Excel",
    lines: ["销售方、税号与开票日期", "价税合计和明细行", "下载可继续编辑的表格"],
  },
  {
    label: "合同",
    exportAs: "导出 Markdown",
    lines: ["当事人、期限与金额", "条款要点摘要", "下载可继续编辑的文稿"],
  },
  {
    label: "简历",
    exportAs: "导出 Markdown",
    lines: ["经历、教育与联系方式", "润色只使用原文已有事实", "下载结构化简历"],
  },
];

export default function HomePage() {
  return (
    <div className="space-y-14">
      <section className="grid items-end gap-10 pt-6 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-sm tracking-[0.18em] text-seal">文档进，字段出</p>
          <h1 className="mt-3 font-serif text-5xl leading-tight sm:text-6xl">把发票、合同和简历收成能导出的结果。</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-ink-soft">
            纸匣读取你上传的发票、合同和简历，抽出结构化字段。发票做成 Excel，合同和简历做成 Markdown。注册即可获得免费提取次数。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-full bg-seal px-5 py-2.5 text-white hover:bg-seal-deep">
              注册使用
            </Link>
            <Link href="/login" className="rounded-full border border-line bg-sheet px-5 py-2.5 hover:border-ink">
              已有账号
            </Link>
          </div>
        </div>
        <div className="sheet relative rounded-2xl p-5">
          <p className="text-xs tracking-wide text-ink-soft">一份文件，一次提取</p>
          <ol className="mt-4 space-y-4">
            {["注册并登录", "选择类型并上传文件", "核对字段并下载"].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="font-serif text-xl text-seal">{["壹", "贰", "叁"][index]}</span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map((item) => (
          <article key={item.label} className="sheet rounded-2xl p-5">
            <p className="text-xs text-ink-soft">{item.exportAs}</p>
            <h2 className="mt-1 font-serif text-3xl">{item.label}</h2>
            <ul className="mt-4 space-y-2 border-t border-dashed border-line pt-4 text-sm leading-6">
              {item.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-line bg-moss-soft p-5">
          <h2 className="font-serif text-2xl text-moss">带标签的文档可离线提取</h2>
          <p className="mt-2 leading-7 text-ink-soft">
            未接入模型时，纸匣按固定规则读取带标签的 TXT、Markdown，以及带文字层的 PDF。同一份文件每次得到相同结果。
          </p>
        </article>
        <article className="rounded-2xl border border-line bg-sheet p-5">
          <h2 className="font-serif text-2xl">接入模型后自动切换</h2>
          <p className="mt-2 leading-7 text-ink-soft">
            默认使用 DeepSeek 提取字段。超时、报错或返回无法识别的内容时，自动改用离线解析，并在结果页说明原因。
          </p>
        </article>
      </section>
    </div>
  );
}
