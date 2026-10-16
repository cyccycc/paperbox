# 收款码

把支付宝、微信的个人收款码图片放在这个目录，再在 `.env` 里写上路径。购买页只显示已配置的渠道。

```bash
# public/pay/alipay.png 与 public/pay/wechat.png
PAYMENT_ALIPAY_QR_URL="/pay/alipay.png"
PAYMENT_WECHAT_QR_URL="/pay/wechat.png"
```

也可以把变量写成 https 图片地址。png、jpg、webp 都可以。改完后重启进程。

不要把真实收款码提交到 git。此目录里除了本说明，图片默认被忽略。

用户点次数包后会生成待支付订单，扫码并手动输入金额，再点「我已付款」。用 `ADMIN_GRANT_SECRET` 调用 `GET /api/admin/credits` 查看待核对订单，再用 `action=mark_paid` 入账。
