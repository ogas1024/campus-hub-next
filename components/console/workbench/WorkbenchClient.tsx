"use client";

/**
 * 用法：
 * - Console 工作台（`/console/workbench`）的客户端渲染与偏好配置入口。
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { WorkbenchDialogAction } from "@/components/console/WorkbenchDialogAction";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { WorkbenchPreferences } from "@/lib/workbench/preferences";
import { applyWorkbenchPreferencesToCards, applyWorkbenchPreferencesToQuickLinks, normalizeWorkbenchPreferences } from "@/lib/workbench/preferences";
import type { WorkbenchCard, WorkbenchQuickLink } from "@/lib/workbench/types";

import { WorkbenchPreferencesDialog } from "./WorkbenchPreferencesDialog";

type Props = {
  cards: WorkbenchCard[];
  quickLinks: WorkbenchQuickLink[];
  initialPreferences: WorkbenchPreferences;
};

export function WorkbenchClient({ cards, quickLinks, initialPreferences }: Props) {
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const prefs: WorkbenchPreferences = useMemo(() => normalizeWorkbenchPreferences(initialPreferences), [initialPreferences]);

  const visibleCards = useMemo(() => applyWorkbenchPreferencesToCards(cards, prefs), [cards, prefs]);
  const visibleQuickLinks = useMemo(() => applyWorkbenchPreferencesToQuickLinks(quickLinks, prefs), [quickLinks, prefs]);

  const actionableCards = useMemo(
    () => visibleCards.filter((card) => card.metrics.some((m) => Number(m.value) > 0)),
    [visibleCards],
  );

  const focusCards = useMemo(() => actionableCards.slice(0, 4), [actionableCards]);
  const focusCardIdSet = useMemo(() => new Set(focusCards.map((c) => c.id)), [focusCards]);
  const restCards = useMemo(() => visibleCards.filter((c) => !focusCardIdSet.has(c.id)), [visibleCards, focusCardIdSet]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="工作台"
        description="专注模式：默认聚焦近期需要处理的事项，其余折叠以降低信息压力。"
        actions={
          <Button size="sm" variant="outline" onClick={() => setPrefsOpen(true)}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            自定义
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-base">快捷入口</CardTitle>
              <CardDescription>不改变权限边界；仅提供跳转。</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {visibleQuickLinks.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无可用入口（请联系管理员授权）。</div>
          ) : (
            visibleQuickLinks.map((l) => (
              <Link key={l.id} href={l.href} className={buttonVariants({ size: "sm", variant: l.variant ?? "outline" })}>
                {l.label}
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">需要处理</h2>
            <div className="text-sm text-muted-foreground">主屏默认隐藏零值卡片；最多展示 4 张重点卡片。</div>
          </div>
        </div>

        {focusCards.length === 0 ? (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">当前没有待处理事项</div>
                <div className="text-sm text-muted-foreground">你可以通过上方快捷入口进入模块，或展开“显示全部”查看所有卡片。</div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {focusCards.map((card) => (
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
                        <Link key={a.id} className={buttonVariants({ size: "sm", variant: a.variant ?? "default" })} href={a.href}>
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
        )}

        {restCards.length > 0 ? (
          <Collapsible open={allOpen} onOpenChange={setAllOpen}>
            <CollapsibleTrigger asChild>
              <button
                className={buttonVariants({ variant: "outline", size: "sm", className: "w-full justify-between" })}
                type="button"
              >
                <span>{allOpen ? "收起（只看重点）" : `显示全部（共 ${visibleCards.length} 张）`}</span>
                <ChevronDown className={allOpen ? "h-4 w-4 rotate-180 transition-transform" : "h-4 w-4 transition-transform"} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="grid gap-4 lg:grid-cols-2">
                {restCards.map((card) => (
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
                            <Link key={a.id} className={buttonVariants({ size: "sm", variant: a.variant ?? "default" })} href={a.href}>
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
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </section>

      {prefsOpen ? (
        <WorkbenchPreferencesDialog
          open={prefsOpen}
          onOpenChange={setPrefsOpen}
          cards={cards}
          quickLinks={quickLinks}
          initialPreferences={prefs}
        />
      ) : null}
    </div>
  );
}
