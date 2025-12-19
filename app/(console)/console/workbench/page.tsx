import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkbenchDialogAction } from "@/components/console/WorkbenchDialogAction";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { consoleEntryPermCodes } from "@/lib/navigation/modules";
import { createWorkbenchContext } from "@/lib/workbench/context";
import { collectWorkbenchContributions } from "@/lib/workbench/registry";

export default async function ConsoleWorkbenchPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const ctx = createWorkbenchContext({ actorUserId: user.id });

  const canEnterConsole = await ctx.canAnyPerm([...consoleEntryPermCodes]);
  if (!canEnterConsole) redirect("/notices");

  const { cards, quickLinks } = await collectWorkbenchContributions(ctx);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">工作台</h1>
        <p className="text-sm text-muted-foreground">跨域待办与快捷入口（按权限动态展示）。</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <Card key={card.id}>
            <CardHeader>
              <CardTitle className="text-base">{card.title}</CardTitle>
              {card.description ? <CardDescription>{card.description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {card.metrics.map((m) => (
                  <div key={m.id} className="flex items-center gap-1">
                    <span>{m.label}：</span>
                    <Badge variant="secondary">{m.value}</Badge>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {card.actions.map((a) =>
                  a.kind === "link" ? (
                    <Link
                      key={a.id}
                      className={buttonVariants({ size: "sm", variant: a.variant ?? "default" })}
                      href={a.href}
                    >
                      {a.label}
                    </Link>
                  ) : (
                    <WorkbenchDialogAction key={a.id} label={a.label} variant={a.variant} dialog={a.dialog} />
                  ),
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">快捷入口</CardTitle>
          <CardDescription>不改变权限边界；仅提供跳转。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {quickLinks.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无可用入口（请联系管理员授权）。</div>
          ) : (
            quickLinks.map((l) => (
              <Link key={l.id} href={l.href} className={buttonVariants({ size: "sm", variant: l.variant ?? "outline" })}>
                {l.label}
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
