import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { hasPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const navItems: { href: string; label: string }[] = [];
  const canNoticeList = await hasPerm(user.id, "campus:notice:list");
  if (canNoticeList) navItems.push({ href: "/console/notices", label: "公告管理" });

  if (navItems.length === 0) redirect("/notices");

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950 text-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold tracking-wide">Console</span>
            <span className="text-sm text-zinc-200">管理后台</span>
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
            {navItems.map((item) => (
              <Link
                key={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
