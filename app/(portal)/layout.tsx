import Link from "next/link";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { hasPerm } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const canEnterConsole = user ? await hasPerm(user.id, "campus:notice:list") : false;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link className="text-sm font-semibold" href="/">
              Campus Hub
            </Link>
            <Link className="text-sm text-zinc-700 transition-colors hover:text-zinc-900" href="/notices">
              通知公告
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {user && canEnterConsole ? (
              <Link
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 transition hover:bg-zinc-50"
                href="/console/notices"
              >
                管理后台
              </Link>
            ) : null}
            {user ? (
              <>
                <span className="hidden text-sm text-zinc-600 sm:inline">{user.email ?? user.id}</span>
                <LogoutButton className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm transition hover:bg-zinc-50" />
              </>
            ) : (
              <Link className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white transition hover:bg-zinc-800" href="/login">
                登录
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
