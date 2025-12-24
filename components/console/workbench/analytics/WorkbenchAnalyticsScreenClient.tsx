"use client";

/**
 * 用法：
 * - 大屏「数据概览」（`/screen/workbench/analytics`）：
 *   - 多场景 + Bento Grid（S/M/L 尺寸映射到 col-span）
 *   - 60s 自动刷新（静默刷新：保留旧数据避免闪烁）
 *   - 60s 自动轮播场景（可通过偏好开关启停）
 *   - 支持浏览器 Fullscreen
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Expand, RefreshCcw, Settings } from "lucide-react";

import type { AnalyticsDays, ConsoleActivityHeatmap, ConsoleCourseResourcesAnalytics, ConsoleLibraryAnalytics } from "@/lib/api/console-analytics";
import { fetchConsoleActivityHeatmap, fetchConsoleCourseResourcesAnalytics, fetchConsoleLibraryAnalytics } from "@/lib/api/console-analytics";
import { cn } from "@/lib/utils";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ANALYTICS_COL_SPAN_CLASS_BY_SIZE,
  ANALYTICS_DEFAULT_SCENE_WIDGET_IDS,
  ANALYTICS_LAYOUT_TEMPLATES,
  ANALYTICS_SCENES,
  ANALYTICS_WIDGETS,
  type AnalyticsSceneId,
  type AnalyticsWidgetId,
} from "@/lib/workbench/analytics";
import { mergePreferredIdOrder, normalizeWorkbenchAnalyticsPreferences, type WorkbenchAnalyticsPreferences } from "@/lib/workbench/preferences";

import { WorkbenchAnalyticsPreferencesDialog } from "./WorkbenchAnalyticsPreferencesDialog";
import {
  ActivityHeatmapWidget,
  CourseCoursePieWidget,
  CourseDownloadLeaderboardWidget,
  CourseDownloadsLineWidget,
  CourseMajorPieWidget,
  CourseScoreLeaderboardWidget,
  LibraryContributorLeaderboardWidget,
  LibraryDownloadLeaderboardWidget,
  LibraryDownloadsLineWidget,
  type QueryState,
  useConsoleQuery,
} from "./analytics-widgets";

type Props = {
  initialPreferences: WorkbenchAnalyticsPreferences;
  initialDays: AnalyticsDays;
};

const DAYS_OPTIONS: AnalyticsDays[] = [7, 30, 90, 365];
const INTERVAL_MS = 60_000;

function formatTime(date: Date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function KpiRow(props: {
  days: AnalyticsDays;
  courseState: QueryState<ConsoleCourseResourcesAnalytics>;
  libraryState: QueryState<ConsoleLibraryAnalytics>;
  activityState: QueryState<ConsoleActivityHeatmap>;
}) {
  const course = props.courseState.data;
  const library = props.libraryState.data;
  const activity = props.activityState.data;

  const courseDownloads = course ? course.downloadsSeries.reduce((acc, r) => acc + (r.count ?? 0), 0) : null;
  const libraryDownloads = library ? library.downloadsSeries.reduce((acc, r) => acc + (r.count ?? 0), 0) : null;
  const publishedResources = course ? course.majorDistribution.reduce((acc, r) => acc + (r.publishedCount ?? 0), 0) : null;
  const totalActivity = activity ? activity.total : null;

  const items = [
    { label: `最近 ${props.days} 天活动`, value: totalActivity },
    { label: `最近 ${props.days} 天资源下载`, value: courseDownloads },
    { label: `最近 ${props.days} 天图书下载`, value: libraryDownloads },
    { label: "已发布课程资源", value: publishedResources },
  ];

  const anyLoading = props.courseState.status === "loading" && course == null;
  const anyLoading2 = props.libraryState.status === "loading" && library == null;
  const anyLoading3 = props.activityState.status === "loading" && activity == null;
  const loading = anyLoading || anyLoading2 || anyLoading3;

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-muted/10 p-3">
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {loading ? <span className="text-muted-foreground">…</span> : item.value == null ? <span className="text-muted-foreground">—</span> : item.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">提示：热力图默认置顶；自动刷新/轮播可在“自定义”中关闭。</div>
    </div>
  );
}

function promoteToFront(ids: AnalyticsWidgetId[], id: AnalyticsWidgetId) {
  if (!ids.includes(id)) return ids;
  return [id, ...ids.filter((x) => x !== id)];
}

export function WorkbenchAnalyticsScreenClient(props: Props) {
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState<WorkbenchAnalyticsPreferences>(() => normalizeWorkbenchAnalyticsPreferences(props.initialPreferences));
  const [days, setDays] = useState<AnalyticsDays>(props.initialDays);
  const [refreshToken, setRefreshToken] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const initialScene = useMemo(() => {
    const hidden = new Set(prefs.hiddenSceneIds);
    const visible = prefs.sceneOrder.filter((id) => !hidden.has(id));
    return (visible[0] ?? "overview") as AnalyticsSceneId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [scene, setScene] = useState<AnalyticsSceneId>(initialScene);

  const visibleSceneIds = useMemo(() => {
    const hidden = new Set(prefs.hiddenSceneIds);
    const ordered = mergePreferredIdOrder({ allIds: ANALYTICS_SCENES.map((s) => s.id), preferredOrder: prefs.sceneOrder }) as AnalyticsSceneId[];
    return ordered.filter((id) => !hidden.has(id));
  }, [prefs.hiddenSceneIds, prefs.sceneOrder]);

  useEffect(() => {
    if (visibleSceneIds.length === 0) return;
    if (visibleSceneIds.includes(scene)) return;
    setScene(visibleSceneIds[0]!);
  }, [scene, visibleSceneIds]);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    onChange();
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      return;
    }
    document.exitFullscreen?.().catch(() => {});
  }

  useEffect(() => {
    if (!prefs.autoRefreshEnabled) return;
    const id = window.setInterval(() => setRefreshToken((v) => v + 1), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [prefs.autoRefreshEnabled]);

  useEffect(() => {
    if (!prefs.autoRotateEnabled) return;
    if (visibleSceneIds.length <= 1) return;
    const id = window.setInterval(() => {
      setScene((prev) => {
        const idx = visibleSceneIds.indexOf(prev);
        const nextIdx = idx < 0 ? 0 : (idx + 1) % visibleSceneIds.length;
        return visibleSceneIds[nextIdx] ?? prev;
      });
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [prefs.autoRotateEnabled, visibleSceneIds]);

  const courseState = useConsoleQuery<ConsoleCourseResourcesAnalytics>({
    hardKey: `course:${days}`,
    refreshToken,
    fetcher: (signal) => fetchConsoleCourseResourcesAnalytics({ days, signal }),
  });
  const libraryState = useConsoleQuery<ConsoleLibraryAnalytics>({
    hardKey: `library:${days}`,
    refreshToken,
    fetcher: (signal) => fetchConsoleLibraryAnalytics({ days, signal }),
  });
  const activityState = useConsoleQuery<ConsoleActivityHeatmap>({
    hardKey: `activity:${days}`,
    refreshToken,
    fetcher: (signal) => fetchConsoleActivityHeatmap({ days, signal }),
  });

  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const prevStatusRef = useRef<{ course: string; library: string; activity: string }>({ course: "loading", library: "loading", activity: "loading" });

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (courseState.status === "success" && prev.course !== "success") setLastUpdatedAt(new Date());
    if (libraryState.status === "success" && prev.library !== "success") setLastUpdatedAt(new Date());
    if (activityState.status === "success" && prev.activity !== "success") setLastUpdatedAt(new Date());
    prevStatusRef.current = { course: courseState.status, library: libraryState.status, activity: activityState.status };
  }, [courseState.status, libraryState.status, activityState.status]);

  const widgetById = useMemo(() => new Map(ANALYTICS_WIDGETS.map((w) => [w.id, w] as const)), []);
  const sceneLabelById = useMemo(() => new Map(ANALYTICS_SCENES.map((s) => [s.id, s.label] as const)), []);
  const templateLabelById = useMemo(() => new Map(ANALYTICS_LAYOUT_TEMPLATES.map((t) => [t.id, t.label] as const)), []);

  const sceneWidgetIds = useMemo(() => {
    const base = ANALYTICS_DEFAULT_SCENE_WIDGET_IDS[scene] ?? [];
    const ordered = mergePreferredIdOrder({ allIds: base, preferredOrder: prefs.widgetOrder }) as AnalyticsWidgetId[];
    const hidden = new Set(prefs.hiddenWidgetIds);
    const visible = ordered.filter((id) => !hidden.has(id));
    return promoteToFront(visible, "activity-heatmap");
  }, [prefs.hiddenWidgetIds, prefs.widgetOrder, scene]);

  function renderWidget(id: AnalyticsWidgetId) {
    if (id === "kpi-row") {
      return <KpiRow days={days} courseState={courseState} libraryState={libraryState} activityState={activityState} />;
    }
    if (id === "activity-heatmap") return <ActivityHeatmapWidget state={activityState} height="100%" />;

    if (id === "course-download-leaderboard") return <CourseDownloadLeaderboardWidget state={courseState} height="100%" />;
    if (id === "library-download-leaderboard") return <LibraryDownloadLeaderboardWidget state={libraryState} height="100%" />;
    if (id === "course-major-pie") return <CourseMajorPieWidget state={courseState} height="100%" />;
    if (id === "course-course-pie") return <CourseCoursePieWidget state={courseState} height="100%" />;
    if (id === "course-downloads-line") return <CourseDownloadsLineWidget state={courseState} height="100%" />;
    if (id === "library-downloads-line") return <LibraryDownloadsLineWidget state={libraryState} height="100%" />;
    if (id === "course-score-leaderboard") return <CourseScoreLeaderboardWidget state={courseState} height="100%" />;
    if (id === "library-contributor-leaderboard") return <LibraryContributorLeaderboardWidget state={libraryState} height="100%" />;

    return null;
  }

  function refreshingHintForWidget(id: AnalyticsWidgetId) {
    if (id === "activity-heatmap") return activityState.status === "refreshing" ? "刷新中…" : null;
    if (id === "kpi-row") {
      const refreshing = courseState.status === "refreshing" || libraryState.status === "refreshing" || activityState.status === "refreshing";
      return refreshing ? "刷新中…" : null;
    }
    if (id.startsWith("course-")) return courseState.status === "refreshing" ? "刷新中…" : null;
    if (id.startsWith("library-")) return libraryState.status === "refreshing" ? "刷新中…" : null;
    return null;
  }

  return (
    <div ref={containerRef} className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-[1600px] px-6 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground">工作台 · 大屏</div>
              <h1 className="text-2xl font-semibold tracking-tight">数据概览</h1>
              <div className="text-sm text-muted-foreground">面向管理端的整体数据视图：活动热力图、排行榜、占比与趋势。</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>时间窗：{days} 天</span>
                {lastUpdatedAt ? <span>最后更新：{formatTime(lastUpdatedAt)}</span> : <span>最后更新：—</span>}
                {prefs.autoRefreshEnabled ? <span>自动刷新：开</span> : <span>自动刷新：关</span>}
                {prefs.autoRotateEnabled ? <span>轮播：开</span> : <span>轮播：关</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as AnalyticsDays)}>
                <TabsList>
                  {DAYS_OPTIONS.map((d) => (
                    <TabsTrigger key={d} value={String(d)}>
                      {d} 天
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <Button size="sm" variant="outline" onClick={() => setRefreshToken((v) => v + 1)}>
                <RefreshCcw className="h-4 w-4" />
                刷新
              </Button>

              <Button size="sm" variant="outline" onClick={() => setPrefsOpen(true)}>
                <Settings className="h-4 w-4" />
                自定义
              </Button>

              <Button size="sm" variant="outline" onClick={toggleFullscreen}>
                <Expand className="h-4 w-4" />
                {isFullscreen ? "退出全屏" : "全屏"}
              </Button>

              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href={`/console/workbench/analytics?days=${days}`}>
                <ArrowLeft className="h-4 w-4" />
                返回
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Tabs value={scene} onValueChange={(v) => setScene(v as AnalyticsSceneId)}>
              <TabsList className="h-10">
                {visibleSceneIds.map((s) => (
                  <TabsTrigger key={s} value={s} className="h-9 px-4">
                    {sceneLabelById.get(s) ?? s}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="text-xs text-muted-foreground">当前模板：{templateLabelById.get(prefs.templateId) ?? prefs.templateId}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="mx-auto h-full w-full max-w-[1600px] px-6 py-6">
          <div key={scene} className="ch-enter grid h-full grid-cols-12 auto-rows-fr gap-3">
            {sceneWidgetIds.map((id) => {
              const widget = widgetById.get(id);
              if (!widget) return null;

              const size = prefs.widgetSizeById[id] ?? "m";
              const colSpan =
                scene === "overview" && id === "activity-heatmap"
                  ? "lg:col-span-8"
                  : scene === "overview" && id === "kpi-row"
                    ? "lg:col-span-4"
                    : scene === "activity" && id === "activity-heatmap"
                      ? "lg:col-span-12"
                    : (ANALYTICS_COL_SPAN_CLASS_BY_SIZE[size] ?? "lg:col-span-6");
              const hint = refreshingHintForWidget(id);

              return (
                <Card key={id} className={cn("col-span-12 flex min-h-0 flex-col overflow-hidden", colSpan)}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base">{widget.title}</CardTitle>
                        <CardDescription>{widget.description}</CardDescription>
                      </div>
                      {hint ? <div className="shrink-0 text-xs text-muted-foreground">{hint}</div> : null}
                    </div>
                  </CardHeader>
                  <CardContent className={cn("flex-1 p-4 pt-0", id === "kpi-row" ? "pb-4" : "", "min-h-0")}>{renderWidget(id)}</CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {prefsOpen ? (
        <WorkbenchAnalyticsPreferencesDialog
          open={prefsOpen}
          onOpenChange={setPrefsOpen}
          initialPreferences={prefs}
          onSaved={(next) => setPrefs(normalizeWorkbenchAnalyticsPreferences(next))}
        />
      ) : null}
    </div>
  );
}
