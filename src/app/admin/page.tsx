import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminCreditForm } from "@/components/admin-credit-form";
import { listAdminUsers } from "@/lib/admin-user";
import { formatShanghai } from "@/lib/billing";
import { getSession } from "@/lib/current-user";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "管理" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");

  const me = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { isAdmin: true },
  });
  if (!me?.isAdmin) notFound();

  const { users, total } = await listAdminUsers(prisma);
  const truncated = total > users.length;

  return (
    <div className="space-y-8 pt-2">
      <div>
        <h1 className="font-serif text-4xl">管理</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          账号按注册时间从新到旧排列。剩余额度可以直接改。
          {truncated ? ` 共 ${total} 个账号，这里显示最近 ${users.length} 个。` : ` 共 ${total} 个账号。`}
        </p>
      </div>
      {users.length === 0 ? (
        <p className="text-sm text-ink-soft">还没有账号。</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-sheet">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">账号</th>
                <th className="px-4 py-3 font-medium">用户 ID</th>
                <th className="px-4 py-3 font-medium">注册时间</th>
                <th className="px-4 py-3 font-medium">剩余额度</th>
                <th className="px-4 py-3 font-medium">成功提取</th>
                <th className="px-4 py-3 font-medium">管理员</th>
                <th className="px-4 py-3 font-medium">调整额度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((user) => (
                <tr key={user.id} className="align-top">
                  <td className="max-w-56 break-all px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft" title={user.id}>
                    {user.id}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatShanghai(user.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{user.credits}</td>
                  <td className="px-4 py-3">{user._count.jobs}</td>
                  <td className={`px-4 py-3 ${user.isAdmin ? "text-seal" : "text-ink-soft"}`}>
                    {user.isAdmin ? "是" : "否"}
                  </td>
                  <td className="px-4 py-3">
                    <AdminCreditForm userId={user.id} credits={user.credits} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
