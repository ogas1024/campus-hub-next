"use client";

/**
 * 用法：
 * - 工作台「数据概览」与「大屏」复用的图表组件与查询 Hook。
 * - 目标：保持 UI 一致（shadcn 风格）、减少重复代码、支持静默刷新（保留旧数据避免闪烁）。
 */

import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ConsoleActivityHeatmap, ConsoleCourseResourcesAnalytics, ConsoleLibraryAnalytics } from "@/lib/api/console-analytics";
import { ApiResponseError, getApiErrorMessage } from "@/lib/api/http";
import { Skeleton } from "@/components/ui/skeleton";

export type WidgetHeight = number | "100%";

export type QueryState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "refreshing"; data: T; error: null }
  | { status: "forbidden"; data: null; error: null }
  | { status: "error"; data: T | null; error: string }
  | { status: "success"; data: T; error: null };

export function useConsoleQuery<T>(params: { hardKey: string; refreshToken?: number; fetcher: (signal: AbortSignal) => Promise<T> }): QueryState<T> {
  const refreshToken = params.refreshToken ?? 0;
  const previousHardKeyRef = useRef<string | null>(null);
  const [state, setState] = useState<QueryState<T>>({ status: "loading", data: null, error: null });

  useEffect(() => {
    const isHardReload = previousHardKeyRef.current !== params.hardKey;
    previousHardKeyRef.current = params.hardKey;

    const ac = new AbortController();
    setState((prev) => {
      if (isHardReload) return { status: "loading", data: null, error: null };
      if (prev.data == null) return { status: "loading", data: null, error: null };
      return { status: "refreshing", data: prev.data, error: null };
    });

    params
      .fetcher(ac.signal)
      .then((data) => {
        if (ac.signal.aborted) return;
        setState({ status: "success", data, error: null });
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        if (err instanceof ApiResponseError && err.status === 403) {
          setState({ status: "forbidden", data: null, error: null });
          return;
        }
        const message = getApiErrorMessage(err, "加载失败");
        setState((prev) => ({ status: "error", data: prev.data, error: message }));
      });

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.hardKey, refreshToken]);

  return state;
}

function heightStyle(height: WidgetHeight) {
  return { height };
}

function tickShortDate(value: unknown) {
  if (typeof value !== "string") return value as string;
  return value.length >= 10 ? value.slice(5) : value;
}

function tickShortText(value: unknown) {
  if (typeof value !== "string") return value as string;
  const s = value.trim();
  if (s.length <= 10) return s;
  return `${s.slice(0, 10)}…`;
}

type RechartsTooltipPayload = { name?: string; value?: unknown; payload?: unknown };
type RechartsTooltipProps = { active?: boolean; payload?: RechartsTooltipPayload[]; label?: unknown } | null;

export function ChartTooltip(props: unknown) {
  const p = (props ?? null) as RechartsTooltipProps;
  if (!p?.active) return null;
  const payload = p.payload;
  if (!payload?.length) return null;
  const label = p.label;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-sm">
      {label != null ? <div className="font-medium">{String(label)}</div> : null}
      <div className="mt-1 space-y-0.5 text-muted-foreground">
        {payload.map((p, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">{String(p.name ?? "—")}</span>
            <span className="shrink-0 font-medium text-foreground">{String(p.value ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardStateBlock(props: { kind: "loading" | "forbidden" | "error" | "empty"; message?: string; height?: WidgetHeight }) {
  const height = props.height ?? 240;
  if (props.kind === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="w-full rounded-lg" style={heightStyle(height)} />
      </div>
    );
  }

  const message =
    props.kind === "forbidden"
      ? "无权限查看（请联系管理员授权）"
      : props.kind === "error"
        ? props.message ?? "加载失败"
        : props.message ?? "暂无数据";

  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground"
      style={heightStyle(height)}
    >
      <div className="max-w-[32rem] text-center">{message}</div>
    </div>
  );
}

export function ActivityHeatmap(props: { items: ConsoleActivityHeatmap["items"] }) {
  const dayToCount = useMemo(() => new Map(props.items.map((i) => [i.day, i.count] as const)), [props.items]);
  const counts = useMemo(() => props.items.map((i) => i.count), [props.items]);
  const max = useMemo(() => Math.max(0, ...counts), [counts]);

  const cells = useMemo(() => {
    if (props.items.length === 0) return [] as Array<{ day: string; count: number } | null>;

    const start = new Date(`${props.items[0]!.day}T00:00:00.000Z`);
    const weekdayMonday0 = (start.getUTCDay() + 6) % 7;
    const leading: Array<null> = Array.from({ length: weekdayMonday0 }, () => null);

    const days = props.items.map((d) => ({ day: d.day, count: dayToCount.get(d.day) ?? 0 }));
    return [...leading, ...days];
  }, [dayToCount, props.items]);

  const weeks = useMemo(() => {
    const out: Array<Array<{ day: string; count: number } | null>> = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [cells]);

  function levelOf(count: number) {
    if (count <= 0) return 0;
    if (max <= 0) return 0;
    const p = count / max;
    if (p <= 0.25) return 1;
    if (p <= 0.5) return 2;
    if (p <= 0.75) return 3;
    return 4;
  }

  function bgOf(count: number) {
    const level = levelOf(count);
    if (level === 0) return "hsl(var(--muted) / 0.45)";
    if (level === 1) return "hsl(var(--chart-2) / 0.25)";
    if (level === 2) return "hsl(var(--chart-2) / 0.45)";
    if (level === 3) return "hsl(var(--chart-2) / 0.65)";
    return "hsl(var(--chart-2) / 0.85)";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div>最近 {props.items.length} 天</div>
        <div className="flex items-center gap-2">
          <span>少</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((l) => (
              <div
                key={l}
                className="h-3 w-3 rounded-[3px] border border-border/60"
                style={{ backgroundColor: bgOf(l === 0 ? 0 : Math.max(1, Math.round((max * l) / 4))) }}
              />
            ))}
          </div>
          <span>多</span>
        </div>
      </div>

      <div className="no-scrollbar overflow-x-auto">
        <div className="grid grid-flow-col auto-cols-max gap-1">
          {weeks.map((week, idx) => (
            <div key={idx} className="grid grid-rows-7 gap-1">
              {Array.from({ length: 7 }).map((_, rowIdx) => {
                const cell = week[rowIdx] ?? null;
                const count = cell?.count ?? 0;
                return (
                  <div
                    key={rowIdx}
                    className="h-3 w-3 rounded-[3px] border border-border/50"
                    style={{ backgroundColor: bgOf(count) }}
                    title={cell ? `${cell.day}：${count}` : ""}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CourseDownloadLeaderboardWidget(props: { state: QueryState<ConsoleCourseResourcesAnalytics>; height?: WidgetHeight }) {
  const height = props.height ?? 240;
  if (props.state.status === "loading") return <CardStateBlock kind="loading" height={height} />;
  if (props.state.status === "forbidden") return <CardStateBlock kind="forbidden" height={height} />;
  if (props.state.status === "error" && props.state.data == null) return <CardStateBlock kind="error" message={props.state.error} height={height} />;
  const data = props.state.data ?? null;
  if (!data) return <CardStateBlock kind="loading" height={height} />;

  const rows = data.downloadLeaderboard.slice(0, 10).map((r) => ({ name: r.title, value: r.windowDownloadCount }));
  if (rows.length === 0) return <CardStateBlock kind="empty" message="该时间窗暂无下载记录" height={height} />;

  return (
    <div className="w-full" style={heightStyle(height)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <YAxis dataKey="name" type="category" width={110} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={tickShortText} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="value" name="下载量" fill="hsl(var(--chart-1))" radius={[4, 4, 4, 4]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LibraryDownloadLeaderboardWidget(props: { state: QueryState<ConsoleLibraryAnalytics>; height?: WidgetHeight }) {
  const height = props.height ?? 240;
  if (props.state.status === "loading") return <CardStateBlock kind="loading" height={height} />;
  if (props.state.status === "forbidden") return <CardStateBlock kind="forbidden" height={height} />;
  if (props.state.status === "error" && props.state.data == null) return <CardStateBlock kind="error" message={props.state.error} height={height} />;
  const data = props.state.data ?? null;
  if (!data) return <CardStateBlock kind="loading" height={height} />;

  const rows = data.downloadLeaderboard.slice(0, 10).map((r) => ({ name: r.title, value: r.windowDownloadCount }));
  if (rows.length === 0) return <CardStateBlock kind="empty" message="该时间窗暂无下载记录" height={height} />;

  return (
    <div className="w-full" style={heightStyle(height)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <YAxis dataKey="name" type="category" width={110} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={tickShortText} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="value" name="下载量" fill="hsl(var(--chart-2))" radius={[4, 4, 4, 4]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CourseMajorPieWidget(props: { state: QueryState<ConsoleCourseResourcesAnalytics>; height?: WidgetHeight }) {
  const height = props.height ?? 240;
  if (props.state.status === "loading") return <CardStateBlock kind="loading" height={height} />;
  if (props.state.status === "forbidden") return <CardStateBlock kind="forbidden" height={height} />;
  if (props.state.status === "error" && props.state.data == null) return <CardStateBlock kind="error" message={props.state.error} height={height} />;
  const data = props.state.data ?? null;
  if (!data) return <CardStateBlock kind="loading" height={height} />;

  const rows = data.majorDistribution.map((r) => ({ name: r.majorName, value: r.publishedCount }));
  if (rows.length === 0) return <CardStateBlock kind="empty" message="暂无已发布资源" height={height} />;

  const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  return (
    <div className="w-full" style={heightStyle(height)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
            {rows.map((_, idx) => (
              <Cell key={idx} fill={colors[idx % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CourseCoursePieWidget(props: { state: QueryState<ConsoleCourseResourcesAnalytics>; height?: WidgetHeight }) {
  const height = props.height ?? 240;
  if (props.state.status === "loading") return <CardStateBlock kind="loading" height={height} />;
  if (props.state.status === "forbidden") return <CardStateBlock kind="forbidden" height={height} />;
  if (props.state.status === "error" && props.state.data == null) return <CardStateBlock kind="error" message={props.state.error} height={height} />;
  const data = props.state.data ?? null;
  if (!data) return <CardStateBlock kind="loading" height={height} />;

  const rows = data.courseDistribution.map((r) => ({ name: r.courseName, value: r.publishedCount }));
  if (rows.length === 0) return <CardStateBlock kind="empty" message="暂无已发布资源" height={height} />;

  const colors = ["hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-1))"];

  return (
    <div className="w-full" style={heightStyle(height)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
            {rows.map((_, idx) => (
              <Cell key={idx} fill={colors[idx % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CourseDownloadsLineWidget(props: { state: QueryState<ConsoleCourseResourcesAnalytics>; height?: WidgetHeight }) {
  const height = props.height ?? 240;
  if (props.state.status === "loading") return <CardStateBlock kind="loading" height={height} />;
  if (props.state.status === "forbidden") return <CardStateBlock kind="forbidden" height={height} />;
  if (props.state.status === "error" && props.state.data == null) return <CardStateBlock kind="error" message={props.state.error} height={height} />;
  const data = props.state.data ?? null;
  if (!data) return <CardStateBlock kind="loading" height={height} />;

  const rows = data.downloadsSeries.map((r) => ({ day: r.day, value: r.count }));
  if (rows.length === 0) return <CardStateBlock kind="empty" message="暂无数据" height={height} />;

  return (
    <div className="w-full" style={heightStyle(height)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="day" tickFormatter={tickShortDate} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="value" name="下载量" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LibraryDownloadsLineWidget(props: { state: QueryState<ConsoleLibraryAnalytics>; height?: WidgetHeight }) {
  const height = props.height ?? 240;
  if (props.state.status === "loading") return <CardStateBlock kind="loading" height={height} />;
  if (props.state.status === "forbidden") return <CardStateBlock kind="forbidden" height={height} />;
  if (props.state.status === "error" && props.state.data == null) return <CardStateBlock kind="error" message={props.state.error} height={height} />;
  const data = props.state.data ?? null;
  if (!data) return <CardStateBlock kind="loading" height={height} />;

  const rows = data.downloadsSeries.map((r) => ({ day: r.day, value: r.count }));
  if (rows.length === 0) return <CardStateBlock kind="empty" message="暂无数据" height={height} />;

  return (
    <div className="w-full" style={heightStyle(height)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="day" tickFormatter={tickShortDate} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="value" name="下载量" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CourseScoreLeaderboardWidget(props: { state: QueryState<ConsoleCourseResourcesAnalytics>; height?: WidgetHeight }) {
  const height = props.height ?? 240;
  if (props.state.status === "loading") return <CardStateBlock kind="loading" height={height} />;
  if (props.state.status === "forbidden") return <CardStateBlock kind="forbidden" height={height} />;
  if (props.state.status === "error" && props.state.data == null) return <CardStateBlock kind="error" message={props.state.error} height={height} />;
  const data = props.state.data ?? null;
  if (!data) return <CardStateBlock kind="loading" height={height} />;

  const rows = data.userScoreLeaderboard.slice(0, 10).map((r) => ({ name: r.name, value: r.score }));
  if (rows.length === 0) return <CardStateBlock kind="empty" message="暂无贡献数据" height={height} />;

  return (
    <div className="w-full" style={heightStyle(height)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={tickShortText} interval={0} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="value" name="积分" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LibraryContributorLeaderboardWidget(props: { state: QueryState<ConsoleLibraryAnalytics>; height?: WidgetHeight }) {
  const height = props.height ?? 240;
  if (props.state.status === "loading") return <CardStateBlock kind="loading" height={height} />;
  if (props.state.status === "forbidden") return <CardStateBlock kind="forbidden" height={height} />;
  if (props.state.status === "error" && props.state.data == null) return <CardStateBlock kind="error" message={props.state.error} height={height} />;
  const data = props.state.data ?? null;
  if (!data) return <CardStateBlock kind="loading" height={height} />;

  const rows = data.contributorLeaderboard.slice(0, 10).map((r) => ({ name: r.name, value: r.publishedBookCount }));
  if (rows.length === 0) return <CardStateBlock kind="empty" message="暂无贡献数据" height={height} />;

  return (
    <div className="w-full" style={heightStyle(height)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={tickShortText} interval={0} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="value" name="发布数" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ActivityHeatmapWidget(props: { state: QueryState<ConsoleActivityHeatmap>; height?: WidgetHeight }) {
  const height = props.height ?? 240;
  if (props.state.status === "loading") return <CardStateBlock kind="loading" height={height} />;
  if (props.state.status === "forbidden") return <CardStateBlock kind="forbidden" height={height} />;
  if (props.state.status === "error" && props.state.data == null) return <CardStateBlock kind="error" message={props.state.error} height={height} />;
  const data = props.state.data ?? null;
  if (!data) return <CardStateBlock kind="loading" height={height} />;

  if (data.items.length === 0) return <CardStateBlock kind="empty" message="暂无数据" height={height} />;
  return (
    <div className="w-full overflow-hidden" style={heightStyle(height)}>
      <ActivityHeatmap items={data.items} />
    </div>
  );
}
