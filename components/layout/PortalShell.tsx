import Link from "next/link";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { PortalNav } from "@/components/layout/PortalNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import type { AppUser } from "@/lib/auth/types";

type NavItem = {
  id: string;
  label: string;
  href: string;
  status: "available" | "comingSoon";
};

type Props = {
  user: AppUser | null;
  canEnterConsole: boolean;
  navItems: NavItem[];
  children: React.ReactNode;
};

export function PortalShell({ user, canEnterConsole, navItems, children }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight" href="/">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary" />
              Campus Hub
            </Link>
            <PortalNav items={navItems} />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle />
            {user && canEnterConsole ? (
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console">
                管理后台
              </Link>
            ) : null}

            {user ? (
              <>
                <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/profile">
                  个人资料
                </Link>
                <span className="hidden text-sm text-muted-foreground sm:inline">{user.email ?? user.id}</span>
                <LogoutButton className={buttonVariants({ variant: "ghost", size: "sm" })} />
              </>
            ) : (
              <Link className={buttonVariants({ variant: "default", size: "sm" })} href="/login">
                登录
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
