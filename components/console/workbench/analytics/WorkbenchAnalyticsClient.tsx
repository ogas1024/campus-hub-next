"use client";

/**
 * 用法：
 * - Console 工作台“数据概览”（`/console/workbench/analytics`）的客户端渲染：
 *   - 分块加载（课程资源 / 数字图书 / 全站活动热力图）
 *   - 7/30/90/365 天时间窗切换
 *   - 图表显示/排序自定义（HTTP-only Cookie 持久化）
 */

import type * as React from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Monitor, SlidersHorizontal } from "lucide-react";

import type { AnalyticsDays, ConsoleActivityHeatmap, ConsoleCourseResourcesAnalytics, ConsoleLibraryAnalytics } from "@/lib/api/console-analytics";
import { fetchConsoleActivityHeatmap, fetchConsoleCourseResourcesAnalytics, fetchConsoleLibraryAnalytics } from "@/lib/api/console-analytics";
import { PageHeader } from "@/components/common/PageHeader";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  mergePreferredIdOrder,
  normalizeWorkbenchAnalyticsPreferences,
  type WorkbenchAnalyticsPreferences,
} from "@/lib/workbench/preferences";
import { ANALYTICS_CHARTS } from "@/lib/workbench/analytics";

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
  useConsoleQuery,
} from "./analytics-widgets";

type Props = {
  initialPreferences: WorkbenchAnalyticsPreferences;
};

const DAYS_OPTIONS: AnalyticsDays[] = [7, 30, 90, 365];

export function WorkbenchAnalyticsClient({ initialPreferences }: Props) {
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState<WorkbenchAnalyticsPreferences>(() => normalizeWorkbenchAnalyticsPreferences(initialPreferences));
  const [days, setDays] = useState<AnalyticsDays>(30);
  const searchParams = useSearchParams();

  useEffect(() => {
    const raw = searchParams.get("days");
    if (!raw) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const days = Math.trunc(parsed);
    if ((DAYS_OPTIONS as readonly number[]).includes(days)) setDays(days as AnalyticsDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const courseState = useConsoleQuery<ConsoleCourseResourcesAnalytics>({
    hardKey: `course:${days}`,
    fetcher: (signal) => fetchConsoleCourseResourcesAnalytics({ days, signal }),
  });
  const libraryState = useConsoleQuery<ConsoleLibraryAnalytics>({
    hardKey: `library:${days}`,
    fetcher: (signal) => fetchConsoleLibraryAnalytics({ days, signal }),
  });
  const activityState = useConsoleQuery<ConsoleActivityHeatmap>({
    hardKey: `activity:${days}`,
    fetcher: (signal) => fetchConsoleActivityHeatmap({ days, signal }),
  });

  const chartById = useMemo(() => new Map(ANALYTICS_CHARTS.map((c) => [c.id, c] as const)), []);
  const chartOrder = useMemo(() => mergePreferredIdOrder({ allIds: ANALYTICS_CHARTS.map((c) => c.id), preferredOrder: prefs.widgetOrder }), [prefs.widgetOrder]);
  const visibleCharts = useMemo(() => {
    const hidden = new Set(prefs.hiddenWidgetIds);
    const ordered = chartOrder.map((id) => chartById.get(id)).filter((c): c is (typeof ANALYTICS_CHARTS)[number] => !!c && !hidden.has(c.id));
    const heatmap = ordered.find((c) => c.id === "activity-heatmap") ?? null;
    const rest = ordered.filter((c) => c.id !== "activity-heatmap");
    return heatmap ? [heatmap, ...rest] : rest;
  }, [chartById, chartOrder, prefs.hiddenWidgetIds]);

  const renderById = useMemo(() => {
    return {
      "course-download-leaderboard": () => <CourseDownloadLeaderboardWidget state={courseState} />,
      "library-download-leaderboard": () => <LibraryDownloadLeaderboardWidget state={libraryState} />,
      "course-major-pie": () => <CourseMajorPieWidget state={courseState} />,
      "course-course-pie": () => <CourseCoursePieWidget state={courseState} />,
      "course-downloads-line": () => <CourseDownloadsLineWidget state={courseState} />,
      "library-downloads-line": () => <LibraryDownloadsLineWidget state={libraryState} />,
      "course-score-leaderboard": () => <CourseScoreLeaderboardWidget state={courseState} />,
      "library-contributor-leaderboard": () => <LibraryContributorLeaderboardWidget state={libraryState} />,
      "activity-heatmap": () => <ActivityHeatmapWidget state={activityState} />,
    } satisfies Record<(typeof ANALYTICS_CHARTS)[number]["id"], () => React.ReactNode>;
  }, [courseState, libraryState, activityState]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="数据概览"
        description="面向管理端的整体数据视图：排行榜、占比、趋势与全站活动热力图。"
        actions={
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
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/screen/workbench/analytics?days=${days}`}>
              <Monitor className="h-4 w-4" />
              大屏
            </Link>
            <Button size="sm" variant="outline" onClick={() => setPrefsOpen(true)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              自定义
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {visibleCharts.map((c) => (
          <Card key={c.id} className={c.id === "activity-heatmap" ? "lg:col-span-2" : undefined}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{c.title}</CardTitle>
              <CardDescription>{c.description}</CardDescription>
            </CardHeader>
            <CardContent>{renderById[c.id]()}</CardContent>
          </Card>
        ))}
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
