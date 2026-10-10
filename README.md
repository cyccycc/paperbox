# 纸匣 Paperbox

上传发票、合同或简历，抽出结构化字段并导出。

- 发票：销售方、金额、税号、日期、明细 → Excel（xlsx）
- 合同：当事人、期限、金额、条款摘要 → Markdown
- 简历：结构化经历，可选润色且不编造事实 → Markdown

界面是中文。文件存在本地 `uploads/`，账号是邮箱加密码，数据库是 SQLite。

## 本地运行

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev
```

打开 http://localhost:3000 ，注册后进入工作台。每种文档都有「使用示例」，不配置模型也能走完。

## 环境变量

| 变量 | 作用 |
| --- | --- |
| `DATABASE_URL` | SQLite 连接串，默认 `file:./dev.db`（相对 `prisma/` 目录） |
| `AUTH_SECRET` | 登录会话签名。生产环境请换成足够长的随机字符串 |
| `OPENAI_API_KEY` | 留空则只用离线解析 |
| `OPENAI_BASE_URL` | OpenAI 兼容接口根路径，**必须包含 `/v1`**，例如 `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 模型名，默认 `gpt-4o-mini` |

纸匣请求 `${OPENAI_BASE_URL}/chat/completions`，不会再追加一层 `/v1`。

## 离线解析与模型

- **离线**：`OPENAI_API_KEY` 为空。按标签和表格做确定性解析，同一份文本每次结果相同。结果页会说明当前是离线解析。
- **模型**：密钥非空，且 `OPENAI_BASE_URL` 以 `/v1` 结尾。温度固定为 0，要求只输出 JSON，不补充原文没有的事实。
- **回退**：密钥已配置，但地址不合法、网络失败、接口报错、超时或返回无法识别的内容时，改用离线解析。结果页用警告写出原因，例如 `模型未能完成提取，已改用离线解析。原因：…`。
- 简历若勾选「润色表述（不编造事实）」，整理稿只重组已有信息。模型润色如果出现原文没有的数字，会改回离线整理稿并在结果页说明。

离线模式认这些标签（中英文冒号均可）：

- 发票：`销售方`、`纳税人识别号`、`开票日期`、`价税合计`；明细用 `名称 | 数量 | 单价 | 金额`，或带表头的 Markdown 表格
- 合同：`甲方`、`乙方`、`合同期限`、`合同金额`，以及「主要条款」下的编号列表
- 简历：`姓名`、`电话`、`邮箱`、`求职意向`；经历行用日期开头，公司和职位之间空两格

## 示例文件

`samples/`：

| 文件 | 说明 |
| --- | --- |
| `invoice-zh.txt` / `invoice-zh.md` | 中文发票。工作台「使用示例」用 TXT |
| `contract-zh.txt` / `contract-zh.md` | 中文合同 |
| `resume-zh.txt` / `resume-zh.md` | 中文简历 |
| `invoice-en.pdf` | 带文字层的英文发票，可直接上传 |
| `scanned-no-text.pdf` | 没有可选中文字的 PDF |

扫描件或纯图片 PDF 抽不出文字层。结果页会说明原因，并建议改成 TXT 或 Markdown 再上传。可用 `node scripts/generate-sample-pdfs.mjs` 重新生成两份 PDF。

## 检查

```bash
npm test
npm run lint
```

## 目录

- `src/app`：页面与接口（注册、登录、工作台、结果、下载）
- `src/lib/parsers`：离线解析
- `src/lib/extract.ts`：模型调用与回退
- `prisma/`：SQLite 模型与迁移
- `uploads/`：上传文件，不入库
