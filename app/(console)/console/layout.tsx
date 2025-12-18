import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { ConsoleSidebar } from "@/components/console/ConsoleSidebar";
import { buttonVariants } from "@/components/ui/button";
import { hasPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { consoleNavGroups } from "@/lib/navigation/modules";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const allowedGroups = await Promise.all(
    consoleNavGroups.map(async (g) => {
      const allowedItems = await Promise.all(g.items.map(async (m) => ((await hasPerm(user.id, m.permCode)) ? m : null)));
      const items = allowedItems.filter((m): m is NonNullable<typeof m> => m !== null).map(({ id, label, href }) => ({ id, label, href }));
      if (items.length === 0) return null;
      return { id: g.id, label: g.label, items };
    }),
  );
  const navGroups = allowedGroups.filter((g): g is NonNullable<typeof g> => g !== null);

  if (navGroups.length === 0) redirect("/notices");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-primary px-2 py-1 text-xs font-semibold tracking-wide text-primary-foreground">Console</span>
            <span className="text-sm text-muted-foreground">管理后台</span>
          </div>

          <div className="flex items-center gap-3">
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/">
              返回前台
            </Link>
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email ?? user.id}</span>
            <LogoutButton className={buttonVariants({ variant: "ghost", size: "sm" })} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-4 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-6 rounded-xl border border-border bg-card p-2">
            <ConsoleSidebar groups={navGroups} />
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
