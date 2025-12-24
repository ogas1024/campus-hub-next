import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { PortalShell } from "@/components/layout/PortalShell";
import { hasAnyPerm } from "@/lib/auth/permissions";
import { ModuleIcon } from "@/components/layout/ModuleIcon";
import { PortalHomeFavorites } from "@/components/portal/PortalHomeFavorites";
import { consoleEntryPermCodes, portalModules, portalNavItems, type PortalModuleStatus } from "@/lib/navigation/modules";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { readPortalHomePreferences } from "@/lib/workbench/preferences.server";

function filterPortalModulesByStatus(status: PortalModuleStatus) {
  return portalModules.filter((m) => m.status === status);
}

export default async function Home() {
  const user = await getCurrentUser();
  const canEnterConsole = user ? await hasAnyPerm(user.id, [...consoleEntryPermCodes]) : false;

  const portalHomePreferences = await readPortalHomePreferences();

  const totalCount = portalModules.length;
  const availableModules = filterPortalModulesByStatus("available");
  const comingSoonModules = filterPortalModulesByStatus("comingSoon");
  const availableCount = availableModules.length;

  return (
    <PortalShell user={user} canEnterConsole={canEnterConsole} navItems={portalNavItems}>
      <div className="space-y-10">
        <Card>
          <CardHeader>
            <CardTitle>Campus Hub</CardTitle>
            <CardDescription>多模块并行的校园服务平台（学习项目），按 MVP 逐步落地并持续优化。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  已上线 {availableCount} / {totalCount}
                </Badge>
                <Badge variant="secondary">登录后可使用全部阅读端能力</Badge>
              </div>

              {!user ? (
                <div className="flex flex-wrap gap-2">
                  <Link className={buttonVariants({ variant: "default" })} href="/login">
                    登录
                  </Link>
                  <Link className={buttonVariants({ variant: "outline" })} href="/register">
                    注册
                  </Link>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">欢迎回来，{user.email ?? user.id}。</div>
              )}
            </div>
          </CardContent>
        </Card>

        <PortalHomeFavorites modules={portalModules} initialPreferences={portalHomePreferences} />

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-semibold tracking-tight">已上线</h2>
            <div className="text-sm text-muted-foreground">可直接使用</div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {availableModules.map((m) => (
              <Link
                key={m.id}
                href={m.href}
                className={cn(
                  "block rounded-lg border border-border bg-card transition-colors duration-[var(--motion-duration-hover)] ease-[var(--motion-ease-standard)] hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                )}
              >
                <div className="flex items-start justify-between gap-4 p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">
                      <ModuleIcon moduleId={m.id} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold">{m.label}</div>
                        <Badge>可用</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{m.description}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-sm text-muted-foreground">进入 →</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {comingSoonModules.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <h2 className="text-lg font-semibold tracking-tight">建设中</h2>
              <div className="text-sm text-muted-foreground">按优先级逐步落地</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {comingSoonModules.map((m) => (
                <Link
                  key={m.id}
                  href={m.href}
                  className={cn(
                    "block rounded-lg border border-dashed border-border bg-card transition-colors duration-[var(--motion-duration-hover)] ease-[var(--motion-ease-standard)] hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  )}
                >
                  <div className="flex items-start justify-between gap-4 p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 text-muted-foreground">
                        <ModuleIcon moduleId={m.id} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold">{m.label}</div>
                          <Badge variant="secondary">建设中</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{m.description}</div>
                      </div>
                    </div>
                    <div className="shrink-0 text-sm text-muted-foreground">查看规划 →</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </PortalShell>
  );
}
