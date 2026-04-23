import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { UserAvatar } from "@/components/common/UserAvatar";
import { ConsoleSidebar } from "@/components/console/ConsoleSidebar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { getPermissionChecker } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { consoleNavGroups } from "@/lib/navigation/modules";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const checker = await getPermissionChecker(user.id);
  const navGroups = consoleNavGroups
    .map((group) => {
      const items = group.items
        .filter((module) => checker.hasAnyPerm(module.permCodes))
        .map(({ id, label, href }) => ({ id, label, href }));
      if (items.length === 0) return null;
      return { id: group.id, label: group.label, items };
    })
    .filter((group): group is NonNullable<typeof group> => group !== null);

  if (navGroups.length === 0) redirect("/notices");

  navGroups.unshift({
    id: "workbench",
    label: "工作台",
    items: [
      { id: "workbench", label: "概览", href: "/console/workbench" },
      { id: "workbench-analytics", label: "数据概览", href: "/console/workbench/analytics" },
    ],
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-primary px-2 py-1 text-xs font-semibold tracking-wide text-primary-foreground">Console</span>
            <span className="text-sm text-muted-foreground">管理后台</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/">
              返回前台
            </Link>
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/profile">
              <span className="flex items-center gap-2">
                <UserAvatar name={user.name} userId={user.id} avatarUrl={user.avatarUrl} />
                <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
              </span>
            </Link>
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
