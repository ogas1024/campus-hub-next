import "server-only";

import { and, asc, desc, eq, inArray, isNull, sql, type SQLWrapper } from "drizzle-orm";

import { db } from "@/lib/db";
import { badRequest } from "@/lib/http/errors";
import { auditLogs, collectSubmissions, courseResourceDownloadEvents, courseResourceScoreEvents, courseResources, courses, facilityReservations, libraryBookDownloadEvents, libraryBooks, lostfoundItems, majors, noticeReads, notices, profiles, surveyResponses, voteResponses } from "@campus-hub/db";

export const ANALYTICS_DAYS_OPTIONS = [7, 30, 90, 365] as const;
export type AnalyticsDays = (typeof ANALYTICS_DAYS_OPTIONS)[number];

function assertAnalyticsDays(days: number): asserts days is AnalyticsDays {
  if ((ANALYTICS_DAYS_OPTIONS as readonly number[]).includes(days)) return;
  throw badRequest("days 仅支持 7/30/90/365");
}

export function parseAnalyticsDaysParam(value: string | null, options: { defaultValue: AnalyticsDays }): AnalyticsDays {
  if (value == null || value.trim() === "") return options.defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw badRequest("days 仅支持 7/30/90/365");
  const days = Math.trunc(parsed);
  assertAnalyticsDays(days);
  return days;
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDayRange(days: AnalyticsDays) {
  const ms = 24 * 60 * 60 * 1000;
  const now = new Date();
  const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const start = new Date(todayStartUtc.getTime() - (days - 1) * ms);
  return { start };
}

function buildDayList(days: AnalyticsDays): string[] {
  const { start } = getDayRange(days);
  const ms = 24 * 60 * 60 * 1000;
  const out: string[] = [];
  for (let i = 0; i < days; i += 1) {
    out.push(toUtcDateString(new Date(start.getTime() + i * ms)));
  }
  return out;
}

type DayCountRow = { day: string; count: number };

function fillDayCounts(days: AnalyticsDays, rows: DayCountRow[]) {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, Number(r.count ?? 0));
  return buildDayList(days).map((day) => ({ day, count: byDay.get(day) ?? 0 }));
}

function mergeDayCounts(target: Map<string, number>, rows: DayCountRow[]) {
  for (const r of rows) {
    const day = r.day;
    if (!day) continue;
    const prev = target.get(day) ?? 0;
    target.set(day, prev + Number(r.count ?? 0));
  }
}

function toDayExpr(column: SQLWrapper) {
  return sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD')`;
}

export async function getConsoleCourseResourcesAnalytics(params: { days: number }) {
  assertAnalyticsDays(params.days);
  const days = params.days;
  const { start } = getDayRange(days);

  const sinceIso = start.toISOString();

  const downloadsWhere = [isNull(courseResources.deletedAt), eq(courseResources.status, "published"), sql`${courseResourceDownloadEvents.occurredAt} >= ${sinceIso}`];

  const downloadLeaderboardRows = await db
    .select({
      resourceId: courseResources.id,
      title: courseResources.title,
      majorName: majors.name,
      courseName: courses.name,
      windowDownloadCount: sql<number>`count(*)`.as("windowDownloadCount"),
    })
    .from(courseResourceDownloadEvents)
    .innerJoin(courseResources, eq(courseResources.id, courseResourceDownloadEvents.resourceId))
    .innerJoin(majors, eq(majors.id, courseResources.majorId))
    .innerJoin(courses, eq(courses.id, courseResources.courseId))
    .where(and(...downloadsWhere))
    .groupBy(courseResources.id, courseResources.title, majors.name, courses.name)
    .orderBy(desc(sql<number>`count(*)`), asc(courseResources.title))
    .limit(20);

  const publishedWhere = [isNull(courseResources.deletedAt), eq(courseResources.status, "published")];

  const majorDistributionRows = await db
    .select({
      majorId: courseResources.majorId,
      majorName: majors.name,
      publishedCount: sql<number>`count(*)`.as("publishedCount"),
    })
    .from(courseResources)
    .innerJoin(majors, eq(majors.id, courseResources.majorId))
    .where(and(...publishedWhere))
    .groupBy(courseResources.majorId, majors.name)
    .orderBy(desc(sql<number>`count(*)`), asc(majors.name));

  const courseDistributionRaw = await db
    .select({
      courseId: courseResources.courseId,
      courseName: courses.name,
      majorName: majors.name,
      publishedCount: sql<number>`count(*)`.as("publishedCount"),
    })
    .from(courseResources)
    .innerJoin(courses, eq(courses.id, courseResources.courseId))
    .innerJoin(majors, eq(majors.id, courseResources.majorId))
    .where(and(...publishedWhere))
    .groupBy(courseResources.courseId, courses.name, majors.name)
    .orderBy(desc(sql<number>`count(*)`), asc(courses.name));

  const courseDistributionTopN = 10;
  const courseDistributionTop = courseDistributionRaw.slice(0, courseDistributionTopN);
  const courseDistributionTail = courseDistributionRaw.slice(courseDistributionTopN);
  const courseDistributionOtherCount = courseDistributionTail.reduce((sum, r) => sum + Number(r.publishedCount ?? 0), 0);

  const courseDistribution = [
    ...courseDistributionTop.map((r) => ({
      courseId: r.courseId,
      courseName: r.courseName,
      majorName: r.majorName,
      publishedCount: Number(r.publishedCount ?? 0),
    })),
    ...(courseDistributionOtherCount > 0 ? [{ courseId: null as string | null, courseName: "其他", majorName: null as string | null, publishedCount: courseDistributionOtherCount }] : []),
  ];

  const downloadsDayExpr = toDayExpr(courseResourceDownloadEvents.occurredAt);
  const downloadsSeriesRows = await db
    .select({
      day: downloadsDayExpr.as("day"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(courseResourceDownloadEvents)
    .innerJoin(courseResources, eq(courseResources.id, courseResourceDownloadEvents.resourceId))
    .where(and(...downloadsWhere))
    .groupBy(downloadsDayExpr)
    .orderBy(asc(downloadsDayExpr));

  const downloadsSeries = fillDayCounts(
    days,
    downloadsSeriesRows.map((r) => ({ day: r.day, count: Number(r.count ?? 0) })),
  );

  const userScoreRows = await db
    .select({
      userId: courseResourceScoreEvents.userId,
      name: profiles.name,
      score: sql<number>`sum(${courseResourceScoreEvents.delta})`.as("score"),
    })
    .from(courseResourceScoreEvents)
    .innerJoin(profiles, eq(profiles.id, courseResourceScoreEvents.userId))
    .groupBy(courseResourceScoreEvents.userId, profiles.name)
    .orderBy(desc(sql<number>`sum(${courseResourceScoreEvents.delta})`), asc(profiles.name))
    .limit(20);

  return {
    days,
    downloadLeaderboard: downloadLeaderboardRows.map((r) => ({
      resourceId: r.resourceId,
      title: r.title,
      majorName: r.majorName,
      courseName: r.courseName,
      windowDownloadCount: Number(r.windowDownloadCount ?? 0),
    })),
    majorDistribution: majorDistributionRows.map((r) => ({
      majorId: r.majorId,
      majorName: r.majorName,
      publishedCount: Number(r.publishedCount ?? 0),
    })),
    courseDistribution,
    downloadsSeries,
    userScoreLeaderboard: userScoreRows.map((r) => ({
      userId: r.userId,
      name: r.name ?? "—",
      score: Number(r.score ?? 0),
    })),
  };
}

export async function getConsoleLibraryAnalytics(params: { days: number }) {
  assertAnalyticsDays(params.days);
  const days = params.days;
  const { start } = getDayRange(days);

  const sinceIso = start.toISOString();
  const downloadsWhere = [isNull(libraryBooks.deletedAt), eq(libraryBooks.status, "published"), sql`${libraryBookDownloadEvents.occurredAt} >= ${sinceIso}`];

  const downloadLeaderboardRows = await db
    .select({
      bookId: libraryBooks.id,
      title: libraryBooks.title,
      author: libraryBooks.author,
      windowDownloadCount: sql<number>`count(*)`.as("windowDownloadCount"),
    })
    .from(libraryBookDownloadEvents)
    .innerJoin(libraryBooks, eq(libraryBooks.id, libraryBookDownloadEvents.bookId))
    .where(and(...downloadsWhere))
    .groupBy(libraryBooks.id, libraryBooks.title, libraryBooks.author)
    .orderBy(desc(sql<number>`count(*)`), asc(libraryBooks.title))
    .limit(20);

  const downloadsDayExpr = toDayExpr(libraryBookDownloadEvents.occurredAt);
  const downloadsSeriesRows = await db
    .select({
      day: downloadsDayExpr.as("day"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(libraryBookDownloadEvents)
    .innerJoin(libraryBooks, eq(libraryBooks.id, libraryBookDownloadEvents.bookId))
    .where(and(...downloadsWhere))
    .groupBy(downloadsDayExpr)
    .orderBy(asc(downloadsDayExpr));

  const downloadsSeries = fillDayCounts(
    days,
    downloadsSeriesRows.map((r) => ({ day: r.day, count: Number(r.count ?? 0) })),
  );

  const contributorWhere = [isNull(libraryBooks.deletedAt), eq(libraryBooks.status, "published")];
  contributorWhere.push(sql`${libraryBooks.publishedAt} >= ${sinceIso}`);

  const contributorRows = await db
    .select({
      userId: libraryBooks.createdBy,
      publishedBookCount: sql<number>`count(*)`.as("publishedBookCount"),
    })
    .from(libraryBooks)
    .where(and(...contributorWhere))
    .groupBy(libraryBooks.createdBy)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(20);

  const userIds = contributorRows.map((r) => r.userId);
  const profileRows = userIds.length
    ? await db.select({ id: profiles.id, name: profiles.name }).from(profiles).where(inArray(profiles.id, userIds))
    : [];
  const nameById = new Map(profileRows.map((p) => [p.id, p.name]));

  return {
    days,
    downloadLeaderboard: downloadLeaderboardRows.map((r) => ({
      bookId: r.bookId,
      title: r.title,
      author: r.author,
      windowDownloadCount: Number(r.windowDownloadCount ?? 0),
    })),
    downloadsSeries,
    contributorLeaderboard: contributorRows.map((r) => ({
      userId: r.userId,
      name: nameById.get(r.userId) ?? "—",
      publishedBookCount: Number(r.publishedBookCount ?? 0),
    })),
  };
}

export async function getConsoleActivityHeatmap(params: { days: number }) {
  assertAnalyticsDays(params.days);
  const days = params.days;
  const { start } = getDayRange(days);
  const sinceIso = start.toISOString();

  function normalizeRows(rows: Array<{ day: string; count: unknown }>): DayCountRow[] {
    return rows.map((r) => ({ day: r.day, count: Number(r.count ?? 0) }));
  }

  const dayMap = new Map<string, number>();

  const [
    auditRows,
    crDownloadRows,
    libDownloadRows,
    noticeReadRows,
    voteResponseRows,
    surveyResponseRows,
    reservationRows,
    lostfoundRows,
    noticeCreateRows,
    crCreateRows,
    libCreateRows,
    collectRows,
  ] = await Promise.all([
    (async () => {
      const expr = toDayExpr(auditLogs.occurredAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(auditLogs)
        .where(sql`${auditLogs.occurredAt} >= ${sinceIso}`)
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
    (async () => {
      const expr = toDayExpr(courseResourceDownloadEvents.occurredAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(courseResourceDownloadEvents)
        .where(sql`${courseResourceDownloadEvents.occurredAt} >= ${sinceIso}`)
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
    (async () => {
      const expr = toDayExpr(libraryBookDownloadEvents.occurredAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(libraryBookDownloadEvents)
        .where(sql`${libraryBookDownloadEvents.occurredAt} >= ${sinceIso}`)
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
    (async () => {
      const expr = toDayExpr(noticeReads.readAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(noticeReads)
        .where(sql`${noticeReads.readAt} >= ${sinceIso}`)
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
    (async () => {
      const expr = toDayExpr(voteResponses.createdAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(voteResponses)
        .where(sql`${voteResponses.createdAt} >= ${sinceIso}`)
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
    (async () => {
      const expr = toDayExpr(surveyResponses.createdAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(surveyResponses)
        .where(sql`${surveyResponses.createdAt} >= ${sinceIso}`)
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
    (async () => {
      const expr = toDayExpr(facilityReservations.createdAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(facilityReservations)
        .where(sql`${facilityReservations.createdAt} >= ${sinceIso}`)
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
    (async () => {
      const expr = toDayExpr(lostfoundItems.createdAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(lostfoundItems)
        .where(and(isNull(lostfoundItems.deletedAt), sql`${lostfoundItems.createdAt} >= ${sinceIso}`))
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
    (async () => {
      const expr = toDayExpr(notices.createdAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(notices)
        .where(and(isNull(notices.deletedAt), sql`${notices.createdAt} >= ${sinceIso}`))
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
    (async () => {
      const expr = toDayExpr(courseResources.createdAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(courseResources)
        .where(and(isNull(courseResources.deletedAt), sql`${courseResources.createdAt} >= ${sinceIso}`))
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
    (async () => {
      const expr = toDayExpr(libraryBooks.createdAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(libraryBooks)
        .where(and(isNull(libraryBooks.deletedAt), sql`${libraryBooks.createdAt} >= ${sinceIso}`))
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
    (async () => {
      const expr = toDayExpr(collectSubmissions.submittedAt);
      return db
        .select({ day: expr.as("day"), count: sql<number>`count(*)`.as("count") })
        .from(collectSubmissions)
        .where(sql`${collectSubmissions.submittedAt} is not null and ${collectSubmissions.submittedAt} >= ${sinceIso}`)
        .groupBy(expr)
        .orderBy(asc(expr));
    })(),
  ]);

  mergeDayCounts(dayMap, normalizeRows(auditRows));
  mergeDayCounts(dayMap, normalizeRows(crDownloadRows));
  mergeDayCounts(dayMap, normalizeRows(libDownloadRows));
  mergeDayCounts(dayMap, normalizeRows(noticeReadRows));
  mergeDayCounts(dayMap, normalizeRows(voteResponseRows));
  mergeDayCounts(dayMap, normalizeRows(surveyResponseRows));
  mergeDayCounts(dayMap, normalizeRows(reservationRows));
  mergeDayCounts(dayMap, normalizeRows(lostfoundRows));
  mergeDayCounts(dayMap, normalizeRows(noticeCreateRows));
  mergeDayCounts(dayMap, normalizeRows(crCreateRows));
  mergeDayCounts(dayMap, normalizeRows(libCreateRows));
  mergeDayCounts(dayMap, normalizeRows(collectRows));

  const items = buildDayList(days).map((day) => ({ day, count: dayMap.get(day) ?? 0 }));
  const total = items.reduce((sum, r) => sum + r.count, 0);

  return { days, total, items };
}
