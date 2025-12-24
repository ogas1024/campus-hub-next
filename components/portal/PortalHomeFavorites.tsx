"use client";

/**
 * 用法：
 * - Portal 首页（`/`）“常用模块”区块：支持按个人偏好选择与排序。
 */

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, RotateCcw, Save, SlidersHorizontal } from "lucide-react";

import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { ModuleIcon } from "@/components/layout/ModuleIcon";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useAutoAnimate } from "@/lib/hooks/useAutoAnimate";
import {
  defaultPortalHomePreferences,
  normalizePortalHomePreferences,
  type PortalHomePreferences,
} from "@/lib/workbench/preferences";
import { resetPortalHomePreferences, savePortalHomePreferences } from "@/lib/workbench/preferences.actions";
import type { PortalModule, PortalModuleId } from "@/lib/navigation/modules";
import { cn } from "@/lib/utils";

type Props = {
  modules: readonly PortalModule[];
  initialPreferences: PortalHomePreferences;
};

function moveByDelta(ids: PortalModuleId[], id: PortalModuleId, delta: -1 | 1) {
  const idx = ids.indexOf(id);
  if (idx < 0) return ids;
  const nextIdx = idx + delta;
  if (nextIdx < 0 || nextIdx >= ids.length) return ids;
  const next = [...ids];
  next.splice(idx, 1);
  next.splice(nextIdx, 0, id);
  return next;
}

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: readonly PortalModule[];
  initialPreferences: PortalHomePreferences;
};

function PortalHomeFavoritesDialog(props: DialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const listRef = useAutoAnimate<HTMLUListElement>({ duration: 180 });

  const allModuleIds = useMemo(() => props.modules.map((m) => m.id), [props.modules]);
  const moduleById = useMemo(() => new Map(props.modules.map((m) => [m.id, m] as const)), [props.modules]);

  const initialFavoriteIds = useMemo(() => {
    const ids = props.initialPreferences.favoriteModuleIds;
    return ids.length > 0 ? ids : defaultPortalHomePreferences.favoriteModuleIds;
  }, [props.initialPreferences.favoriteModuleIds]);

  const [favoriteIds, setFavoriteIds] = useState<PortalModuleId[]>(() => initialFavoriteIds);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const dialogDisplayIds = useMemo(() => {
    const tail = allModuleIds.filter((id) => !favoriteSet.has(id));
    return [...favoriteIds, ...tail];
  }, [allModuleIds, favoriteIds, favoriteSet]);

  function toggleFavorite(id: PortalModuleId, enabled: boolean) {
    setFavoriteIds((prev) => {
      if (enabled) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function onSave() {
    setError("");
    const next = normalizePortalHomePreferences({ favoriteModuleIds: favoriteIds });
    startTransition(() => {
      savePortalHomePreferences(next)
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
      resetPortalHomePreferences()
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

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onReset} disabled={isPending}>
        <RotateCcw className="h-4 w-4" />
        恢复默认
      </Button>
      <div className="flex-1" />
      <Button variant="outline" size="sm" disabled={isPending} onClick={() => props.onOpenChange(false)}>
        取消
      </Button>
      <Button size="sm" onClick={onSave} disabled={isPending}>
        <Save className="h-4 w-4" />
        {isPending ? "保存中…" : "保存"}
      </Button>
    </div>
  );

  return (
    <StickyFormDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="自定义常用模块"
      description="“上移/下移”用于排序；取消勾选表示从常用区移除。"
      error={error || null}
      footer={footer}
      contentClassName="max-w-2xl"
    >
      <div className="rounded-xl border border-border">
        <ul ref={listRef} className="divide-y divide-border/50">
          {dialogDisplayIds.map((id) => {
            const m = moduleById.get(id);
            if (!m) return null;
            const enabled = favoriteSet.has(id);
            const isFirst = enabled && favoriteIds[0] === id;
            const isLast = enabled && favoriteIds[favoriteIds.length - 1] === id;
            return (
              <li key={id} className="flex items-center justify-between gap-3 p-3">
                <label className="flex min-w-0 items-center gap-3">
                  <Checkbox checked={enabled} onCheckedChange={(v) => toggleFavorite(id, v === true)} disabled={isPending} />
                  <span className="min-w-0 truncate text-sm">{m.label}</span>
                </label>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => setFavoriteIds((prev) => moveByDelta(prev, id, -1))}
                    disabled={isPending || !enabled || isFirst}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => setFavoriteIds((prev) => moveByDelta(prev, id, 1))}
                    disabled={isPending || !enabled || isLast}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </StickyFormDialog>
  );
}

export function PortalHomeFavorites({ modules, initialPreferences }: Props) {
  const [open, setOpen] = useState(false);

  const prefs = useMemo(() => normalizePortalHomePreferences(initialPreferences), [initialPreferences]);
  const allModuleIds = useMemo(() => modules.map((m) => m.id), [modules]);
  const moduleById = useMemo(() => new Map(modules.map((m) => [m.id, m] as const)), [modules]);

  const favoriteIds = useMemo(() => {
    const ids = prefs.favoriteModuleIds.filter((id) => allModuleIds.includes(id));
    return ids.length > 0 ? ids : defaultPortalHomePreferences.favoriteModuleIds;
  }, [prefs.favoriteModuleIds, allModuleIds]);

  const favorites = useMemo(() => favoriteIds.map((id) => moduleById.get(id)).filter(Boolean), [favoriteIds, moduleById]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">常用模块</h2>
          <div className="text-sm text-muted-foreground">可自定义显示与排序（仅对当前浏览器生效）。</div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          自定义
        </Button>
      </div>

      {favorites.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">尚未选择常用模块。</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {favorites.map((m) => (
            <Link
              key={m.id}
              href={m.href}
              className={cn(
                "block rounded-lg border border-border bg-card transition-colors duration-[var(--motion-duration-hover)] ease-[var(--motion-ease-standard)] hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              <div className="flex items-start justify-between gap-4 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 text-muted-foreground">
                    <ModuleIcon moduleId={m.id} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="text-base font-semibold">{m.label}</div>
                    <div className="line-clamp-2 text-sm text-muted-foreground">{m.description}</div>
                  </div>
                </div>
                <div className="shrink-0 text-sm text-muted-foreground">进入 →</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {open ? <PortalHomeFavoritesDialog open={open} onOpenChange={setOpen} modules={modules} initialPreferences={prefs} /> : null}

      <div className="text-xs text-muted-foreground">说明：此处仅影响首页“常用模块”区块；完整模块入口仍可通过顶部导航访问。</div>
    </section>
  );
}
