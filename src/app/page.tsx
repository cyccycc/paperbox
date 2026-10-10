import Link from "next/link";

const specimens = [
  {
    label: "发票",
    exportAs: "导出 Excel",
    lines: ["销售方  北京星河科技有限公司", "税号  91110108MA01ABCD1X", "价税合计  ¥12,580.00"],
  },
  {
    label: "合同",
    exportAs: "导出 Markdown",
    lines: ["甲方  杭州青禾贸易有限公司", "期限  2026-04-01 至 2027-03-31", "金额  人民币 360,000 元"],
  },
  {
    label: "简历",
    exportAs: "导出 Markdown",
    lines: ["林晓舟  ·  产品经理", "杭州青禾  2022.03 - 至今", "润色只使用原文事实"],
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
            纸匣读取你上传的文本，抽出结构化字段。发票做成 Excel，合同和简历做成 Markdown。没有模型密钥时，示例文档用离线解析也能走完。
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
            {["注册并登录", "选择类型，上传或使用示例", "查看字段并下载"].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="font-serif text-xl text-seal">{["壹", "贰", "叁"][index]}</span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {specimens.map((item) => (
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
          <h2 className="font-serif text-2xl text-moss">离线也能演示</h2>
          <p className="mt-2 leading-7 text-ink-soft">
            OPENAI_API_KEY 为空时，纸匣用确定性规则解析带标签的 TXT、Markdown，以及带文字层的 PDF。samples 目录里的中文示例可以直接点「使用示例」。
          </p>
        </article>
        <article className="rounded-2xl border border-line bg-sheet p-5">
          <h2 className="font-serif text-2xl">接上模型就切换</h2>
          <p className="mt-2 leading-7 text-ink-soft">
            默认对接 DeepSeek。填上 API key 后走模型提取，地址必须带 /v1。超时、报错或返回无法识别的内容时，自动退回离线解析，并在结果页写明原因。
          </p>
        </article>
      </section>
    </div>
  );
}
