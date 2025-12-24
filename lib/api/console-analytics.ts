import { apiFetchJson } from "@/lib/api/http";

export type AnalyticsDays = 7 | 30 | 90 | 365;
export type DayCount = { day: string; count: number };

export type ConsoleCourseResourcesAnalytics = {
  days: AnalyticsDays;
  downloadLeaderboard: Array<{
    resourceId: string;
    title: string;
    majorName: string;
    courseName: string;
    windowDownloadCount: number;
  }>;
  majorDistribution: Array<{ majorId: string; majorName: string; publishedCount: number }>;
  courseDistribution: Array<{ courseId: string | null; courseName: string; majorName: string | null; publishedCount: number }>;
  downloadsSeries: DayCount[];
  userScoreLeaderboard: Array<{ userId: string; name: string; score: number }>;
};

export type ConsoleLibraryAnalytics = {
  days: AnalyticsDays;
  downloadLeaderboard: Array<{ bookId: string; title: string; author: string; windowDownloadCount: number }>;
  downloadsSeries: DayCount[];
  contributorLeaderboard: Array<{ userId: string; name: string; publishedBookCount: number }>;
};

export type ConsoleActivityHeatmap = {
  days: AnalyticsDays;
  total: number;
  items: DayCount[];
};

export function fetchConsoleCourseResourcesAnalytics(params: { days: AnalyticsDays; signal?: AbortSignal }) {
  const sp = new URLSearchParams();
  sp.set("days", String(params.days));
  return apiFetchJson<ConsoleCourseResourcesAnalytics>(`/api/console/analytics/course-resources?${sp.toString()}`, {
    method: "GET",
    signal: params.signal,
  });
}

export function fetchConsoleLibraryAnalytics(params: { days: AnalyticsDays; signal?: AbortSignal }) {
  const sp = new URLSearchParams();
  sp.set("days", String(params.days));
  return apiFetchJson<ConsoleLibraryAnalytics>(`/api/console/analytics/library?${sp.toString()}`, { method: "GET", signal: params.signal });
}

export function fetchConsoleActivityHeatmap(params: { days: AnalyticsDays; signal?: AbortSignal }) {
  const sp = new URLSearchParams();
  sp.set("days", String(params.days));
  return apiFetchJson<ConsoleActivityHeatmap>(`/api/console/analytics/activity?${sp.toString()}`, { method: "GET", signal: params.signal });
}

