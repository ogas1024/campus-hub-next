"use client";

/**
 * 用法：
 * - Console 工作台“自定义”对话框：配置到期提醒窗口、卡片/快捷入口的显示与排序。
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, RotateCcw, Save } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  WORKBENCH_REMINDER_WINDOW_DAYS_OPTIONS,
  mergePreferredIdOrder,
  normalizeWorkbenchPreferences,
  type WorkbenchPreferences,
} from "@/lib/workbench/preferences";
import { resetWorkbenchPreferences, saveWorkbenchPreferences } from "@/lib/workbench/preferences.actions";
import type { WorkbenchCard, WorkbenchQuickLink } from "@/lib/workbench/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: WorkbenchCard[];
  quickLinks: WorkbenchQuickLink[];
  initialPreferences: WorkbenchPreferences;
};

function moveByDelta(ids: string[], id: string, delta: -1 | 1) {
  const idx = ids.indexOf(id);
  if (idx < 0) return ids;
  const nextIdx = idx + delta;
  if (nextIdx < 0 || nextIdx >= ids.length) return ids;
  const next = [...ids];
  next.splice(idx, 1);
  next.splice(nextIdx, 0, id);
  return next;
}

function toggleSet(prev: Set<string>, id: string, enabled: boolean) {
  const next = new Set(prev);
  if (enabled) next.delete(id);
  else next.add(id);
  return next;
}

export function WorkbenchPreferencesDialog(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const allCardIds = useMemo(() => props.cards.map((c) => c.id), [props.cards]);
  const allQuickLinkIds = useMemo(() => props.quickLinks.map((l) => l.id), [props.quickLinks]);

  const [reminderWindowDays, setReminderWindowDays] = useState<number>(() => props.initialPreferences.reminderWindowDays);
  const [cardOrder, setCardOrder] = useState<string[]>(() =>
    mergePreferredIdOrder({ allIds: allCardIds, preferredOrder: props.initialPreferences.cardOrder }),
  );
  const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(
    () => new Set(props.initialPreferences.hiddenCardIds.filter((id) => allCardIds.includes(id))),
  );
  const [quickLinkOrder, setQuickLinkOrder] = useState<string[]>(() =>
    mergePreferredIdOrder({ allIds: allQuickLinkIds, preferredOrder: props.initialPreferences.quickLinkOrder }),
  );
  const [hiddenQuickLinkIds, setHiddenQuickLinkIds] = useState<Set<string>>(
    () => new Set(props.initialPreferences.hiddenQuickLinkIds.filter((id) => allQuickLinkIds.includes(id))),
  );
  const [error, setError] = useState<string>("");

  const cardTitleById = useMemo(() => new Map(props.cards.map((c) => [c.id, c.title] as const)), [props.cards]);
  const quickLinkLabelById = useMemo(() => new Map(props.quickLinks.map((l) => [l.id, l.label] as const)), [props.quickLinks]);

  function buildNextPreferences() {
    return normalizeWorkbenchPreferences({
      reminderWindowDays,
      cardOrder,
      hiddenCardIds: [...hiddenCardIds],
      quickLinkOrder,
      hiddenQuickLinkIds: [...hiddenQuickLinkIds],
    });
  }

  function onSave() {
    setError("");
    const next = buildNextPreferences();

    startTransition(() => {
      saveWorkbenchPreferences(next)
        .then(() => {
          props.onOpenChange(false);
          router.refresh();
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "保存失败";
          setError(msg);
        });
    });
  }

  function onReset() {
    setError("");
    startTransition(() => {
      resetWorkbenchPreferences()
        .then(() => {
          props.onOpenChange(false);
          router.refresh();
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "恢复默认失败";
          setError(msg);
        });
    });
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>自定义工作台</DialogTitle>
          <DialogDescription>偏好仅对当前浏览器生效；可随时恢复默认。</DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="reminderWindowDays">到期提醒窗口</Label>
              <div className="text-xs text-muted-foreground">影响“到期/截止提醒”类卡片（不影响审核类卡片）。</div>
            </div>
            <Select
              id="reminderWindowDays"
              value={String(reminderWindowDays)}
              onChange={(e) => setReminderWindowDays(Number(e.target.value))}
              disabled={isPending}
            >
              {WORKBENCH_REMINDER_WINDOW_DAYS_OPTIONS.map((d) => (
                <option key={d} value={String(d)}>
                  {d} 天
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">说明</div>
              <div className="text-xs text-muted-foreground">“上移/下移”用于排序；取消勾选表示隐藏。</div>
            </div>
            {error ? <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">卡片</div>
              <div className="text-xs text-muted-foreground">{cardOrder.length} 项</div>
            </div>
            <div className="max-h-[45vh] overflow-auto rounded-xl border border-border">
              <ul className="divide-y divide-border/50">
                {cardOrder.map((id) => {
                  const title = cardTitleById.get(id) ?? id;
                  const visible = !hiddenCardIds.has(id);
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 p-3">
                      <label className="flex min-w-0 items-center gap-3">
                        <Checkbox
                          checked={visible}
                          onCheckedChange={(v) => setHiddenCardIds((prev) => toggleSet(prev, id, v === true))}
                          disabled={isPending}
                        />
                        <span className="min-w-0 truncate text-sm">{title}</span>
                      </label>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => setCardOrder((prev) => moveByDelta(prev, id, -1))}
                          disabled={isPending || cardOrder[0] === id}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => setCardOrder((prev) => moveByDelta(prev, id, 1))}
                          disabled={isPending || cardOrder[cardOrder.length - 1] === id}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">快捷入口</div>
              <div className="text-xs text-muted-foreground">{quickLinkOrder.length} 项</div>
            </div>
            <div className="max-h-[45vh] overflow-auto rounded-xl border border-border">
              <ul className="divide-y divide-border/50">
                {quickLinkOrder.map((id) => {
                  const label = quickLinkLabelById.get(id) ?? id;
                  const visible = !hiddenQuickLinkIds.has(id);
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 p-3">
                      <label className="flex min-w-0 items-center gap-3">
                        <Checkbox
                          checked={visible}
                          onCheckedChange={(v) => setHiddenQuickLinkIds((prev) => toggleSet(prev, id, v === true))}
                          disabled={isPending}
                        />
                        <span className="min-w-0 truncate text-sm">{label}</span>
                      </label>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => setQuickLinkOrder((prev) => moveByDelta(prev, id, -1))}
                          disabled={isPending || quickLinkOrder[0] === id}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => setQuickLinkOrder((prev) => moveByDelta(prev, id, 1))}
                          disabled={isPending || quickLinkOrder[quickLinkOrder.length - 1] === id}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onReset} disabled={isPending}>
            <RotateCcw className="h-4 w-4" />
            恢复默认
          </Button>
          <div className="flex-1" />
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              取消
            </Button>
          </DialogClose>
          <Button size="sm" onClick={onSave} disabled={isPending}>
            <Save className="h-4 w-4" />
            {isPending ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
