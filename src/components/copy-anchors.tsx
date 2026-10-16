import { freeQuota } from "@/lib/billing";

const FILE_TYPES = ["TXT（.txt）", "Markdown（.md、.markdown）", "带文字层的 PDF（.pdf）"] as const;

const OVERVIEW_ROWS = [
  ["销售方", "北京星河科技有限公司"],
  ["纳税人识别号", "91110108MA01ABCD1X"],
  ["开票日期", "2026-03-15"],
  ["价税合计", "¥12,580.00"],
  ["币种", "CNY"],
] as const;

const DETAIL_HEADINGS = ["序号", "项目", "数量", "单价", "金额"] as const;

const DETAIL_ROWS = [
  ["1", "云服务器年费", "1", "10000.00", "10000.00"],
  ["2", "技术支持服务", "1", "2580.00", "2580.00"],
] as const;

function SampleTable({
  caption,
  headings,
  rows,
  minWidth,
}: {
  caption: string;
  headings: readonly string[];
  rows: readonly (readonly string[])[];
  minWidth: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className={`w-full ${minWidth} text-left text-sm`}>
        <caption className="border-b border-line bg-paper-deep/40 px-3 py-2 text-left text-xs text-ink-soft">{caption}</caption>
        <thead className="bg-seal text-white">
          <tr>
            {headings.map((heading) => (
              <th key={heading} className="px-3 py-2 font-medium" scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")} className="border-b border-line last:border-b-0">
              {row.map((cell, index) => (
                <td key={`${headings[index]}-${cell}`} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CopyAnchors() {
  const quota = freeQuota();

  return (
    <section className="sheet rounded-2xl p-5 sm:p-6" aria-label="上传说明">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="font-serif text-2xl" id="支持发票类型">
            支持发票类型
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            按文件里的文字抽字段。发票、合同和简历目前接受这三种，单份不超过 5 MB：
          </p>
          <ul className="mt-3 space-y-1 border-t border-dashed border-line pt-3 text-sm leading-6">
            {FILE_TYPES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            扫描件或纯图片 PDF 没有可选中文字，结果页会说明原因，且不扣次数。图片和其他格式不接受。
          </p>
        </div>
        <div>
          <h2 className="font-serif text-2xl" id="批量上限">
            批量上限
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">一次提交一份文件。这里的上限是次数，不是一次能传多少份。</p>
          <p className="mt-3 border-t border-dashed border-line pt-3 text-sm leading-6">
            次数上限：新用户免费 {quota} 次，注册时写入账号。每次成功提取消耗 1 次。读不出文字的 PDF 不扣次数。
          </p>
        </div>
      </div>
      <div className="mt-6 border-t border-dashed border-line pt-5">
        <h2 className="font-serif text-2xl" id="出表示例">
          出表示例
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          发票导出为 Excel，含「概览」和「明细」两张表。列名与下载文件一致。下面是一份中文发票抽出后的结果。
        </p>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <SampleTable caption="概览" headings={["字段", "内容"]} rows={OVERVIEW_ROWS} minWidth="min-w-[18rem]" />
          <SampleTable caption="明细" headings={DETAIL_HEADINGS} rows={DETAIL_ROWS} minWidth="min-w-[36rem]" />
        </div>
      </div>
    </section>
  );
}
