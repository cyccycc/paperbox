import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/current-user";

export const metadata: Metadata = { title: "注册" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-md pt-8">
      <h1 className="font-serif text-4xl">注册</h1>
      <p className="mt-2 text-sm text-ink-soft">
        已有账号？{" "}
        <Link className="text-seal underline-offset-2 hover:underline" href="/login">
          登录
        </Link>
      </p>
      <div className="mt-6">
        <AuthForm mode="register" nextPath="/dashboard" />
      </div>
    </div>
  );
}
