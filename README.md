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

打开 http://localhost:3000 ，注册后进入工作台，上传发票、合同或简历。不配置模型时，带标签的文本仍会按离线规则解析。本地开发可以直接上传 `samples/` 里的文件。

## 环境变量

| 变量 | 作用 |
| --- | --- |
| `DATABASE_URL` | SQLite 连接串，默认 `file:./dev.db`（相对 `prisma/` 目录） |
| `AUTH_SECRET` | 登录会话签名。生产环境请换成足够长的随机字符串 |
| `OPENAI_API_KEY` | DeepSeek（或其他 OpenAI 兼容服务）的密钥。留空则只用离线解析 |
| `OPENAI_BASE_URL` | OpenAI 兼容接口根路径，**必须包含 `/v1`**。默认 `https://api.deepseek.com/v1` |
| `OPENAI_MODEL` | 模型名。默认 `deepseek-flash`（当前推荐的 DeepSeek 对话模型） |
| `FREE_QUOTA` | 新用户免费成功提取次数，默认 `10`。注册时写入账号，之后改这个值不会改已有账号 |
| `ADMIN_GRANT_SECRET` | 可选。测试发放额度用的口令，**不是**支付商户密钥。留空则管理接口关闭 |

纸匣请求 `${OPENAI_BASE_URL}/chat/completions`，不会再追加一层 `/v1`。

## 接入 DeepSeek

默认提供方是 [DeepSeek](https://api-docs.deepseek.com/)。`deepseek-chat` 已于 2026-07-24 停用，示例里用的是当前推荐的对话模型 `deepseek-flash`。

1. 打开 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys)，登录后创建 API key。
2. 如果还没有 `.env`，从示例复制一份：`cp .env.example .env`。
3. 把密钥填进 `OPENAI_API_KEY`。`OPENAI_BASE_URL` 和 `OPENAI_MODEL` 可以保持示例中的默认值。
4. 重启进程。`npm run dev` 只在启动时读取 `.env`，改完密钥后需要停掉再开一次。
5. 重新打开工作台。密钥已填写且地址指向 DeepSeek 时，页顶显示 **DeepSeek**；密钥留空时显示 **离线**。

调用产生的费用由运行纸匣的人支付：DeepSeek 按 token 从该 API key 的账户余额扣费。使用网页的人沿用服务器上的这一把密钥。用量和余额在 DeepSeek 控制台查看。不要把真实密钥写进仓库或提交到 git。

换别的 OpenAI 兼容接口时，改 `OPENAI_BASE_URL`（仍须以 `/v1` 结尾）和 `OPENAI_MODEL` 即可。指向 `api.deepseek.com` 时，请求会关闭思考模式（`thinking.type=disabled`，`reasoning_effort=none`），这样温度 0 会生效，JSON 出现在 `message.content` 里，并尽量在超时前返回。

## 额度

新用户按 `FREE_QUOTA` 获得免费次数（默认 10）。发票、合同、简历每次**成功**提取消耗 1 次。读不出文字的 PDF 会留下记录，但不扣额度。工作台显示剩余次数。

剩余 0 次时，上传会停住，并给出「购买额度」。额度页 `/billing` 列出 50 次（参考价 ¥29）和 200 次（参考价 ¥99）。「微信支付」「支付宝」只在数据库里创建状态为 `pending` 的订单，并提示「支付通道即将开通」。没有真实扣款，也不需要商户密钥。待支付订单不会增加额度。

已有账号在这次迁移里会得到 10 次，和当时的 `FREE_QUOTA` 无关。

测试补额度（需要已有账号，以及 `.env` 里的 `DATABASE_URL`）：

```bash
npm run grant -- user@example.com 50
```

也可以调用管理接口。`ADMIN_GRANT_SECRET` 留空时该接口返回 404。

```bash
curl -X POST http://localhost:3000/api/admin/credits \
  -H "Authorization: Bearer $ADMIN_GRANT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","credits":50}'
```

把一笔待支付订单标成已支付（会按订单次数入账，同一订单不会重复入账）：

```bash
curl -X POST http://localhost:3000/api/admin/credits \
  -H "Authorization: Bearer $ADMIN_GRANT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"<订单号>","action":"mark_paid"}'
```

`action` 还可以是 `cancel`（已支付的订单不能取消）。订单状态为 `pending`、`paid`、`cancelled`。

## 离线解析与模型

- **离线**：`OPENAI_API_KEY` 为空。按标签和表格做确定性解析，同一份文本每次结果相同。结果页和工作台都会说明当前是离线解析。
- **模型**：密钥非空，且 `OPENAI_BASE_URL` 以 `/v1` 结尾。温度固定为 0，要求只输出 json，不补充原文没有的事实。
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
| `invoice-zh.txt` / `invoice-zh.md` | 中文发票。本地开发可直接上传 |
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

- `src/app`：页面与接口（注册、登录、工作台、额度、结果、下载）
- `src/lib/parsers`：离线解析
- `src/lib/extract.ts`：模型调用与回退
- `src/lib/quota.ts`：免费额度、扣次、待支付订单
- `prisma/`：SQLite 模型与迁移
- `uploads/`：上传文件，不入库
