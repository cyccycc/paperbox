import Link from "next/link";
import { getSession } from "@/lib/current-user";

export async function Header() {
  const session = await getSession();

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5">
      <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-3">
        <span className="seal" aria-hidden>
          匣
        </span>
        <span>
          <span className="block font-serif text-xl leading-none">纸匣</span>
          <span className="mt-1 block text-xs tracking-wide text-ink-soft">Paperbox</span>
        </span>
      </Link>
      <nav className="flex items-center gap-2 text-sm">
        {session ? (
          <>
            <span className="hidden max-w-48 truncate text-ink-soft sm:inline">{session.email}</span>
            <Link href="/dashboard" className="rounded-full px-3 py-2 hover:bg-white/70">
              工作台
            </Link>
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
