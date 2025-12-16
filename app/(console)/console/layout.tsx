import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { requirePerm } from "@/lib/auth/permissions";
import { HttpError } from "@/lib/http/errors";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  let user: Awaited<ReturnType<typeof requirePerm>>;
  try {
    user = await requirePerm("campus:notice:list");
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) redirect("/login");
    redirect("/notices");
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950 text-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold tracking-wide">Console</span>
            <span className="text-sm text-zinc-200">通知公告</span>
          </div>

          <div className="flex items-center gap-3">
            <Link className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15" href="/notices">
              返回前台
            </Link>
            <span className="hidden text-sm text-zinc-300 sm:inline">{user.email ?? user.id}</span>
            <LogoutButton className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-4 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-6 rounded-xl border border-zinc-200 bg-white p-2">
            <Link className="block rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white" href="/console/notices">
              公告管理
            </Link>
          </nav>
          <div className="mt-3 text-xs text-zinc-500">提示：审批与发布在后台完成，前台仅展示已发布公告。</div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
