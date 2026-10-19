import Link from "next/link";
import { getSession } from "@/lib/current-user";
import { prisma } from "@/lib/db";

export async function Header() {
  const session = await getSession();
  const account = session
    ? await prisma.user.findUnique({
        where: { id: session.uid },
        select: { credits: true, isAdmin: true },
      })
    : null;
  const credits = account?.credits;

  return (
    <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-5">
      <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-3">
        <span className="seal" aria-hidden>
          匣
        </span>
        <span>
          <span className="block font-serif text-xl leading-none">纸匣</span>
          <span className="mt-1 block text-xs tracking-wide text-ink-soft">Paperbox</span>
        </span>
      </Link>
      <nav className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2 text-sm">
        <Link href="/blog" className="rounded-full px-3 py-2 hover:bg-white/70">
          教程
        </Link>
        {session ? (
          <>
            <span className="hidden max-w-48 truncate text-ink-soft sm:inline">{session.email}</span>
            {typeof credits === "number" ? (
              <Link
                href="/billing"
                className="rounded-full border border-line bg-sheet px-3 py-2 hover:border-seal hover:text-seal"
              >
                {credits === 0 ? "购买额度" : `剩余 ${credits} 次`}
              </Link>
            ) : null}
            <Link href="/dashboard" className="rounded-full px-3 py-2 hover:bg-white/70">
              工作台
            </Link>
            {account?.isAdmin ? (
              <Link href="/admin" className="rounded-full px-3 py-2 hover:bg-white/70">
                管理
              </Link>
            ) : null}
            <form action="/api/auth/logout" method="post">
              <button className="rounded-full border border-line bg-sheet px-3 py-2 hover:border-seal hover:text-seal" type="submit">
                退出
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="rounded-full px-3 py-2 hover:bg-white/70">
              登录
            </Link>
            <Link href="/register" className="rounded-full bg-seal px-4 py-2 text-white hover:bg-seal-deep">
              开始使用
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
