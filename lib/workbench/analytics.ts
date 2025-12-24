export const ANALYTICS_WIDGET_SIZES = ["s", "m", "l"] as const;
export type AnalyticsWidgetSize = (typeof ANALYTICS_WIDGET_SIZES)[number];

export const ANALYTICS_LAYOUT_TEMPLATES = [
  { id: "balanced", label: "平衡", description: "默认布局：兼顾总览、资源、图书与活动。" },
  { id: "resources", label: "资源优先", description: "突出课程资源相关内容，弱化图书场景。" },
  { id: "library", label: "图书优先", description: "突出数字图书相关内容，弱化课程资源场景。" },
  { id: "activity", label: "活动优先", description: "突出全站活动热力图与趋势。" },
] as const;
export type AnalyticsLayoutTemplateId = (typeof ANALYTICS_LAYOUT_TEMPLATES)[number]["id"];

export const ANALYTICS_SCENES = [
  { id: "overview", label: "总览" },
  { id: "resources", label: "课程资源" },
  { id: "library", label: "数字图书" },
  { id: "activity", label: "活动" },
] as const;
export type AnalyticsSceneId = (typeof ANALYTICS_SCENES)[number]["id"];

export const ANALYTICS_WIDGETS = [
  { id: "kpi-row", title: "关键指标", description: "全站关键指标与概览。" },
  { id: "activity-heatmap", title: "全站活动热力图", description: "GitHub 风格：按天统计各模块动作总量（含成功与失败）。" },
  { id: "course-download-leaderboard", title: "课程资源下载排行榜", description: "按时间窗统计下载事件次数（Top 20）。" },
  { id: "library-download-leaderboard", title: "数字图书下载排行榜", description: "按时间窗统计下载事件次数（Top 20）。" },
  { id: "course-major-pie", title: "课程资源专业占比", description: "已发布资源数占比（按专业）。" },
  { id: "course-course-pie", title: "课程资源课程占比", description: "已发布资源数占比（按课程，Top 10 + 其他）。" },
  { id: "course-downloads-line", title: "课程资源下载趋势", description: "按天汇总下载事件次数。" },
  { id: "library-downloads-line", title: "数字图书下载趋势", description: "按天汇总下载事件次数。" },
  { id: "course-score-leaderboard", title: "课程资源用户贡献榜", description: "按积分汇总（Top 20）。" },
  { id: "library-contributor-leaderboard", title: "数字图书用户贡献榜", description: "按发布图书数汇总（Top 20）。" },
] as const;

export type AnalyticsWidgetId = (typeof ANALYTICS_WIDGETS)[number]["id"];

export const ANALYTICS_CHARTS = ANALYTICS_WIDGETS.filter((w) => w.id !== "kpi-row");

export const analyticsWidgetIdSet = new Set<AnalyticsWidgetId>(ANALYTICS_WIDGETS.map((w) => w.id));
export const analyticsSceneIdSet = new Set<AnalyticsSceneId>(ANALYTICS_SCENES.map((s) => s.id));
export const analyticsTemplateIdSet = new Set<AnalyticsLayoutTemplateId>(ANALYTICS_LAYOUT_TEMPLATES.map((t) => t.id));

export const ANALYTICS_DEFAULT_SCENE_ORDER: AnalyticsSceneId[] = ["overview", "resources", "library", "activity"];

export const ANALYTICS_DEFAULT_SCENE_WIDGET_IDS: Record<AnalyticsSceneId, AnalyticsWidgetId[]> = {
  overview: ["activity-heatmap", "kpi-row", "course-downloads-line", "library-downloads-line", "course-download-leaderboard", "library-download-leaderboard"],
  resources: ["course-downloads-line", "course-download-leaderboard", "course-score-leaderboard", "course-major-pie", "course-course-pie"],
  library: ["library-downloads-line", "library-download-leaderboard", "library-contributor-leaderboard"],
  activity: ["activity-heatmap", "course-downloads-line", "library-downloads-line"],
};

function withAllWidgetDefaults(overrides: Partial<Record<AnalyticsWidgetId, AnalyticsWidgetSize>>) {
  const base: Record<AnalyticsWidgetId, AnalyticsWidgetSize> = {
    "kpi-row": "s",
    "activity-heatmap": "m",
    "course-download-leaderboard": "m",
    "library-download-leaderboard": "m",
    "course-major-pie": "s",
    "course-course-pie": "s",
    "course-downloads-line": "m",
    "library-downloads-line": "m",
    "course-score-leaderboard": "m",
    "library-contributor-leaderboard": "m",
  };
  return { ...base, ...overrides };
}

export const ANALYTICS_COL_SPAN_CLASS_BY_SIZE: Record<AnalyticsWidgetSize, string> = {
  s: "lg:col-span-4",
  m: "lg:col-span-6",
  l: "lg:col-span-12",
};

export const ANALYTICS_CHART_HEIGHT_CLASS_BY_SIZE: Record<AnalyticsWidgetSize, string> = {
  s: "h-56",
  m: "h-72",
  l: "h-80",
};

export const ANALYTICS_TEMPLATE_DEFAULTS: Record<
  AnalyticsLayoutTemplateId,
  {
    sceneOrder: AnalyticsSceneId[];
    hiddenSceneIds: AnalyticsSceneId[];
    widgetSizeById: Record<AnalyticsWidgetId, AnalyticsWidgetSize>;
  }
> = {
  balanced: {
    sceneOrder: [...ANALYTICS_DEFAULT_SCENE_ORDER],
    hiddenSceneIds: [],
    widgetSizeById: withAllWidgetDefaults({}),
  },
  resources: {
    sceneOrder: ["overview", "resources", "activity", "library"],
    hiddenSceneIds: ["library"],
    widgetSizeById: withAllWidgetDefaults({ "course-downloads-line": "l", "course-score-leaderboard": "l" }),
  },
  library: {
    sceneOrder: ["overview", "library", "activity", "resources"],
    hiddenSceneIds: ["resources"],
    widgetSizeById: withAllWidgetDefaults({ "library-downloads-line": "l", "library-contributor-leaderboard": "l" }),
  },
  activity: {
    sceneOrder: ["overview", "activity", "resources", "library"],
    hiddenSceneIds: ["resources", "library"],
    widgetSizeById: withAllWidgetDefaults({ "activity-heatmap": "l", "course-downloads-line": "m", "library-downloads-line": "m" }),
  },
};
