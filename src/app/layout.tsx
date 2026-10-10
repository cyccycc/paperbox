import type { Metadata } from "next";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "纸匣",
    template: "%s · 纸匣",
  },
  description: "上传发票、合同或简历，抽出结构化字段并导出。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <Header />
        <main className="mx-auto w-full max-w-5xl px-5 pb-16">{children}</main>
      </body>
    </html>
  );
}
