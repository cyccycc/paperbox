import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession, safeNext } from "@/lib/current-user";

export const metadata: Metadata = { title: "登录" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  const nextPath = safeNext((await searchParams).next);
  if (session) redirect(nextPath);

  return (
    <div className="mx-auto max-w-md pt-8">
      <h1 className="font-serif text-4xl">登录</h1>
      <p className="mt-2 text-sm text-ink-soft">
        还没有账号？{" "}
        <Link className="text-seal underline-offset-2 hover:underline" href="/register">
          注册
        </Link>
      </p>
      <div className="mt-6">
        <AuthForm mode="login" nextPath={nextPath} />
      </div>
    </div>
  );
}
