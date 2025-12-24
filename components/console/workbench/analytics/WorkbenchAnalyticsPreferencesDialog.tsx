"use client";

/**
 * 用法：
 * - Console 工作台“数据概览”/“大屏”自定义对话框：
 *   - 模板（布局策略）、场景显示与顺序、自动刷新/轮播开关
 *   - 组件显示/排序、组件尺寸（S/M/L）
 *   - 通过 HTTP-only Cookie 持久化
 */

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, RotateCcw, Save } from "lucide-react";

import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import {
  ANALYTICS_LAYOUT_TEMPLATES,
  ANALYTICS_SCENES,
  ANALYTICS_TEMPLATE_DEFAULTS,
  ANALYTICS_WIDGETS,
  ANALYTICS_WIDGET_SIZES,
  type AnalyticsLayoutTemplateId,
  type AnalyticsSceneId,
  type AnalyticsWidgetId,
  type AnalyticsWidgetSize,
} from "@/lib/workbench/analytics";
import {
  defaultWorkbenchAnalyticsPreferences,
  mergePreferredIdOrder,
  normalizeWorkbenchAnalyticsPreferences,
  type WorkbenchAnalyticsPreferences,
} from "@/lib/workbench/preferences";
import { resetWorkbenchAnalyticsPreferences, saveWorkbenchAnalyticsPreferences } from "@/lib/workbench/preferences.actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPreferences: WorkbenchAnalyticsPreferences;
  onSaved: (next: WorkbenchAnalyticsPreferences) => void;
};

function moveByDelta<T>(ids: T[], id: T, delta: -1 | 1) {
  const idx = ids.indexOf(id);
  if (idx < 0) return ids;
  const nextIdx = idx + delta;
  if (nextIdx < 0 || nextIdx >= ids.length) return ids;
  const next = ids.slice();
  next.splice(idx, 1);
  next.splice(nextIdx, 0, id);
  return next;
}

function toggleSet<T extends string>(prev: Set<T>, id: T, enabled: boolean) {
  const next = new Set(prev);
  if (enabled) next.delete(id);
  else next.add(id);
  return next;
}

function sizeLabel(size: AnalyticsWidgetSize) {
  if (size === "s") return "小";
  if (size === "m") return "中";
  return "大";
}

export function WorkbenchAnalyticsPreferencesDialog(props: Props) {
  const [isPending, startTransition] = useTransition();
  const initial = useMemo(() => normalizeWorkbenchAnalyticsPreferences(props.initialPreferences), [props.initialPreferences]);

  const allSceneIds = useMemo(() => ANALYTICS_SCENES.map((s) => s.id), []);
  const allWidgetIds = useMemo(() => ANALYTICS_WIDGETS.map((w) => w.id), []);

  const [tab, setTab] = useState<"layout" | "widgets">("widgets");
  const [templateId, setTemplateId] = useState<AnalyticsLayoutTemplateId>(() => initial.templateId);
  const [sceneOrder, setSceneOrder] = useState<AnalyticsSceneId[]>(() => mergePreferredIdOrder({ allIds: allSceneIds, preferredOrder: initial.sceneOrder }) as AnalyticsSceneId[]);
  const [hiddenSceneIds, setHiddenSceneIds] = useState<Set<AnalyticsSceneId>>(() => new Set(initial.hiddenSceneIds));
  const [widgetOrder, setWidgetOrder] = useState<AnalyticsWidgetId[]>(() => mergePreferredIdOrder({ allIds: allWidgetIds, preferredOrder: initial.widgetOrder }) as AnalyticsWidgetId[]);
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<Set<AnalyticsWidgetId>>(() => new Set(initial.hiddenWidgetIds));
  const [widgetSizeById, setWidgetSizeById] = useState<Record<AnalyticsWidgetId, AnalyticsWidgetSize>>(() => ({ ...initial.widgetSizeById }));
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => initial.autoRefreshEnabled);
  const [autoRotateEnabled, setAutoRotateEnabled] = useState<boolean>(() => initial.autoRotateEnabled);
  const [error, setError] = useState<string>("");

  const templateDescById = useMemo(() => new Map(ANALYTICS_LAYOUT_TEMPLATES.map((t) => [t.id, t.description] as const)), []);
  const sceneLabelById = useMemo(() => new Map(ANALYTICS_SCENES.map((s) => [s.id, s.label] as const)), []);
  const widgetTitleById = useMemo(() => new Map(ANALYTICS_WIDGETS.map((w) => [w.id, w.title] as const)), []);
  const widgetDescById = useMemo(() => new Map(ANALYTICS_WIDGETS.map((w) => [w.id, w.description] as const)), []);

  function buildNextPreferences() {
    return normalizeWorkbenchAnalyticsPreferences({
      templateId,
      sceneOrder,
      hiddenSceneIds: [...hiddenSceneIds],
      widgetOrder,
      hiddenWidgetIds: [...hiddenWidgetIds],
      widgetSizeById,
      autoRefreshEnabled,
      autoRotateEnabled,
    });
  }

  function applyTemplate(nextId: AnalyticsLayoutTemplateId) {
    const next = ANALYTICS_TEMPLATE_DEFAULTS[nextId];
    setTemplateId(nextId);
    setSceneOrder(next.sceneOrder);
    setHiddenSceneIds(new Set(next.hiddenSceneIds));
    setWidgetSizeById({ ...next.widgetSizeById });
  }

  function onSave() {
    setError("");
    const next = buildNextPreferences();

    startTransition(() => {
      saveWorkbenchAnalyticsPreferences(next)
        .then(() => {
          toast.success("已保存数据概览偏好");
          props.onSaved(next);
          props.onOpenChange(false);
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
      resetWorkbenchAnalyticsPreferences()
        .then(() => {
          toast.success("已恢复默认数据概览偏好");
          props.onSaved(defaultWorkbenchAnalyticsPreferences);
          props.onOpenChange(false);
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
      title="自定义数据概览"
      description="偏好仅对当前浏览器生效；可随时恢复默认。"
      error={error || null}
      contentClassName="max-w-3xl"
      footer={footer}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v === "layout" ? "layout" : "widgets")}>
        <TabsList>
          <TabsTrigger value="widgets">组件</TabsTrigger>
          <TabsTrigger value="layout">布局</TabsTrigger>
        </TabsList>

        <TabsContent value="layout" className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">模板</div>
            <div className="text-xs text-muted-foreground">切换模板会重置「场景顺序/显隐」与「组件尺寸」，不影响组件的显隐与排序。</div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr] sm:items-center">
              <Label htmlFor="analytics-template">布局模板</Label>
              <div className="space-y-2">
                <Select
                  id="analytics-template"
                  uiSize="sm"
                  value={templateId}
                  onChange={(e) => applyTemplate(e.target.value as AnalyticsLayoutTemplateId)}
                  disabled={isPending}
                >
                  {ANALYTICS_LAYOUT_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                <div className="text-xs text-muted-foreground">{templateDescById.get(templateId) ?? ""}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">场景</div>
            <div className="text-xs text-muted-foreground">“上移/下移”用于排序；取消勾选表示隐藏（轮播会跳过隐藏场景）。</div>
          </div>

          <div className="rounded-xl border border-border">
            <ul className="divide-y divide-border/50">
              {sceneOrder.map((id) => {
                const label = sceneLabelById.get(id) ?? id;
                const visible = !hiddenSceneIds.has(id);
                return (
                  <li key={id} className="flex items-center justify-between gap-3 p-3">
                    <label className="flex min-w-0 items-center gap-3">
                      <Checkbox
                        checked={visible}
                        onCheckedChange={(v) => setHiddenSceneIds((prev) => toggleSet(prev, id, v === true))}
                        disabled={isPending}
                      />
                      <span className="truncate text-sm">{label}</span>
                    </label>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={() => setSceneOrder((prev) => moveByDelta(prev, id, -1))}
                        disabled={isPending || sceneOrder[0] === id}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={() => setSceneOrder((prev) => moveByDelta(prev, id, 1))}
                        disabled={isPending || sceneOrder[sceneOrder.length - 1] === id}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">自动刷新</div>
                  <div className="text-xs text-muted-foreground">每 60s 静默刷新一次（保留旧数据避免闪烁）。</div>
                </div>
                <Switch checked={autoRefreshEnabled} onCheckedChange={setAutoRefreshEnabled} disabled={isPending} />
              </label>

              <label className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">自动轮播</div>
                  <div className="text-xs text-muted-foreground">每 60s 自动切换到下一个可见场景。</div>
                </div>
                <Switch checked={autoRotateEnabled} onCheckedChange={setAutoRotateEnabled} disabled={isPending} />
              </label>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="widgets" className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">组件</div>
            <div className="text-xs text-muted-foreground">“上移/下移”用于排序；取消勾选表示隐藏；尺寸影响大屏的卡片宽度（S/M/L）。</div>
          </div>

          <div className="rounded-xl border border-border">
            <ul className="divide-y divide-border/50">
              {widgetOrder.map((id) => {
                const title = widgetTitleById.get(id) ?? id;
                const desc = widgetDescById.get(id) ?? "";
                const visible = !hiddenWidgetIds.has(id);
                const size = widgetSizeById[id] ?? ANALYTICS_TEMPLATE_DEFAULTS[templateId].widgetSizeById[id];

                return (
                  <li key={id} className="flex items-start justify-between gap-3 p-3">
                    <label className="flex min-w-0 items-start gap-3">
                      <Checkbox checked={visible} onCheckedChange={(v) => setHiddenWidgetIds((prev) => toggleSet(prev, id, v === true))} disabled={isPending} />
                      <span className="min-w-0">
                        <div className="truncate text-sm">{title}</div>
                        {desc ? <div className="mt-1 text-xs text-muted-foreground">{desc}</div> : null}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">尺寸</span>
                          <Select
                            uiSize="sm"
                            className="w-28"
                            value={size}
                            onChange={(e) => setWidgetSizeById((prev) => ({ ...prev, [id]: e.target.value as AnalyticsWidgetSize }))}
                            disabled={isPending}
                          >
                            {ANALYTICS_WIDGET_SIZES.map((s) => (
                              <option key={s} value={s}>
                                {sizeLabel(s)}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </span>
                    </label>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={() => setWidgetOrder((prev) => moveByDelta(prev, id, -1))}
                        disabled={isPending || widgetOrder[0] === id}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={() => setWidgetOrder((prev) => moveByDelta(prev, id, 1))}
                        disabled={isPending || widgetOrder[widgetOrder.length - 1] === id}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </StickyFormDialog>
  );
}
