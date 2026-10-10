import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pt-10">
      <h1 className="font-serif text-4xl">没有找到</h1>
      <p className="mt-3 text-ink-soft">这份页面不存在，或你没有权限查看。</p>
      <Link className="mt-6 inline-block text-seal" href="/dashboard">
        回到工作台
      </Link>
    </div>
  );
}
