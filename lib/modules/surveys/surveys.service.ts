import "server-only";

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { createChatCompletion } from "@/lib/ai/aiClient";
import { hasPerm } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { badRequest, forbidden, notFound } from "@/lib/http/errors";
import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import { buildVisibilityCondition, getAudienceContext, getVisibleIdsForUser } from "@/lib/modules/content-visibility/contentVisibility";
import { getVisibilityScopeOptions } from "@/lib/modules/content-visibility/scopeOptions";
import { buildUserIdDataScopeCondition } from "@/lib/modules/data-permission/dataPermission.where";
import type { SubmitSurveyResponseBody, SurveyQuestionType, UpdateSurveyDraftBody } from "./surveys.schemas";
import { buildSurveyCsv, buildSurveyResults, type SurveyAnswerValue, type SurveyQuestion, type SurveyResponse } from "./surveys.analytics";
import {
  profiles,
  surveyQuestionOptions,
  surveyQuestions,
  surveyResponseItems,
  surveyResponses,
  surveyScopes,
  surveySections,
  surveys,
} from "@campus-hub/db";

type SurveyDefinitionOption = { id: string; label: string; sort: number };

type SurveyDefinitionQuestion = {
  id: string;
  sectionId: string;
  questionType: SurveyQuestionType;
  title: string;
  description: string | null;
  required: boolean;
  sort: number;
  options: SurveyDefinitionOption[];
};

type SurveyDefinitionSection = {
  id: string;
  title: string;
  sort: number;
  questions: SurveyDefinitionQuestion[];
};

function parseIsoDateTime(value: string, name: string) {
  const v = value.trim();
  if (!v) throw badRequest(`${name} 必填`);
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) throw badRequest(`${name} 必须为 ISO 时间字符串`);
  return d;
}

function isSurveyEnded(endAt: Date, now: Date) {
  return endAt.getTime() <= now.getTime();
}

function effectiveStatus(params: { status: "draft" | "published" | "closed"; endAt: Date; now: Date }) {
  if (params.status === "draft") return "draft" as const;
  if (params.status === "closed") return "closed" as const;
  return isSurveyEnded(params.endAt, params.now) ? ("closed" as const) : ("published" as const);
}

function isBetween(params: { startAt: Date; endAt: Date; now: Date }) {
  return params.now.getTime() >= params.startAt.getTime() && params.now.getTime() < params.endAt.getTime();
}

export async function getSurveyScopeOptions() {
  return getVisibilityScopeOptions();
}

async function getSurveyDefinition(params: { surveyId: string }) {
  const sectionRows = await db
    .select({
      id: surveySections.id,
      title: surveySections.title,
      sort: surveySections.sort,
    })
    .from(surveySections)
    .where(eq(surveySections.surveyId, params.surveyId))
    .orderBy(asc(surveySections.sort), asc(surveySections.createdAt));

  const questionRows = await db
    .select({
      id: surveyQuestions.id,
      sectionId: surveyQuestions.sectionId,
      questionType: surveyQuestions.questionType,
      title: surveyQuestions.title,
      description: surveyQuestions.description,
      required: surveyQuestions.required,
      sort: surveyQuestions.sort,
    })
    .from(surveyQuestions)
    .where(eq(surveyQuestions.surveyId, params.surveyId))
    .orderBy(asc(surveyQuestions.sort), asc(surveyQuestions.createdAt));

  const questionIds = questionRows.map((q) => q.id);
  const optionRows =
    questionIds.length === 0
      ? []
      : await db
          .select({
            id: surveyQuestionOptions.id,
            questionId: surveyQuestionOptions.questionId,
            label: surveyQuestionOptions.label,
            sort: surveyQuestionOptions.sort,
          })
          .from(surveyQuestionOptions)
          .where(inArray(surveyQuestionOptions.questionId, questionIds))
          .orderBy(asc(surveyQuestionOptions.sort), asc(surveyQuestionOptions.createdAt));

  const optionMap = new Map<string, Array<{ id: string; label: string; sort: number }>>();
  for (const opt of optionRows) {
    const list = optionMap.get(opt.questionId) ?? [];
    list.push({ id: opt.id, label: opt.label, sort: opt.sort });
    optionMap.set(opt.questionId, list);
  }

  const sectionMap = new Map<string, SurveyDefinitionSection>();
  for (const s of sectionRows) {
    sectionMap.set(s.id, { id: s.id, title: s.title, sort: s.sort, questions: [] });
  }

  for (const q of questionRows) {
    const section = sectionMap.get(q.sectionId);
    if (!section) continue;
    section.questions.push({
      id: q.id,
      sectionId: q.sectionId,
      questionType: q.questionType,
      title: q.title,
      description: q.description ?? null,
      required: q.required,
      sort: q.sort,
      options: optionMap.get(q.id) ?? [],
    });
  }

  const sections = [...sectionMap.values()].sort((a, b) => a.sort - b.sort);
  for (const s of sections) s.questions.sort((a, b) => a.sort - b.sort);

  const flatQuestions: SurveyQuestion[] = sections.flatMap((s) =>
    s.questions.map((q) => ({
      id: q.id,
      title: q.title,
      questionType: q.questionType,
      required: q.required,
      sectionTitle: s.title,
      sectionSort: s.sort,
      sort: q.sort,
      options: q.options,
    })),
  );

  return { sections, flatQuestions };
}

async function getSurveyScopes(surveyId: string) {
  const rows = await db
    .select({ scopeType: surveyScopes.scopeType, refId: surveyScopes.refId })
    .from(surveyScopes)
    .where(eq(surveyScopes.surveyId, surveyId));
  return rows.map((r) => ({ scopeType: r.scopeType, refId: r.refId }));
}

function validateDraftDefinition(params: UpdateSurveyDraftBody) {
  const startAt = parseIsoDateTime(params.startAt, "startAt");
  const endAt = parseIsoDateTime(params.endAt, "endAt");
  if (endAt.getTime() <= startAt.getTime()) throw badRequest("endAt 必须晚于 startAt");

  if (!params.visibleAll && params.scopes.length === 0) {
    throw badRequest("visibleAll=false 时必须至少选择一个可见范围（role/department/position）");
  }

  const sectionIdSet = new Set<string>();
  for (const s of params.sections) {
    if (sectionIdSet.has(s.id)) throw badRequest("sections.id 不允许重复");
    sectionIdSet.add(s.id);
  }

  const questionIdSet = new Set<string>();
  for (const section of params.sections) {
    for (const q of section.questions) {
      if (q.sectionId !== section.id) throw badRequest("questions.sectionId 必须归属当前 section");
      if (questionIdSet.has(q.id)) throw badRequest("questions.id 不允许重复");
      questionIdSet.add(q.id);

      const qt = q.questionType;
      const options = q.options ?? [];

      if (qt === "text" || qt === "rating") {
        if (options.length > 0) throw badRequest(`${qt} 题型不允许包含 options`);
      }
      if (qt === "single" || qt === "multi") {
        if (options.length < 2) throw badRequest("单选/多选题至少需要 2 个选项");
        const optionIdSet = new Set<string>();
        for (const opt of options) {
          if (optionIdSet.has(opt.id)) throw badRequest("options.id 不允许重复");
          optionIdSet.add(opt.id);
        }
      }
    }
  }

  return { startAt, endAt };
}

function validatePublishReady(params: { sections: Array<{ id: string; questions: Array<{ id: string; questionType: SurveyQuestionType; options?: unknown[] }> }> }) {
  const questions = params.sections.flatMap((s) => s.questions);
  if (questions.length === 0) throw badRequest("发布失败：问卷至少需要 1 道题");

  for (const q of questions) {
    if (q.questionType === "single" || q.questionType === "multi") {
      if (!q.options || q.options.length < 2) throw badRequest("发布失败：单选/多选题至少需要 2 个选项");
    }
  }
}

export async function listPortalSurveys(params: { userId: string; page: number; pageSize: number; q?: string }) {
  const now = new Date();
  const ctx = await getAudienceContext(params.userId);
  const visibleIds = await getVisibleIdsForUser({
    ctx,
    scopesTable: surveyScopes,
    resourceIdColumn: surveyScopes.surveyId,
    scopeTypeColumn: surveyScopes.scopeType,
    refIdColumn: surveyScopes.refId,
  });

  const baseWhere = [isNull(surveys.deletedAt), or(eq(surveys.status, "published"), eq(surveys.status, "closed"))];

  baseWhere.push(
    or(
      eq(surveys.createdBy, params.userId),
      buildVisibilityCondition({ visibleIds, visibleAllColumn: surveys.visibleAll, idColumn: surveys.id }),
    )!,
  );

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    baseWhere.push(sql`${surveys.title} ilike ${pattern}`);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(surveys)
    .where(and(...baseWhere));

  const joinOn = and(eq(surveyResponses.surveyId, surveys.id), eq(surveyResponses.userId, params.userId));

  const rows = await db
    .select({
      id: surveys.id,
      title: surveys.title,
      status: surveys.status,
      startAt: surveys.startAt,
      endAt: surveys.endAt,
      anonymousResponses: surveys.anonymousResponses,
      responseUpdatedAt: surveyResponses.updatedAt,
      updatedAt: surveys.updatedAt,
    })
    .from(surveys)
    .leftJoin(surveyResponses, joinOn)
    .where(and(...baseWhere))
    .orderBy(
      sql`case
        when ${surveys.status} = 'draft' then 3
        when ${surveys.status} = 'closed' or ${surveys.endAt} <= now() then 2
        when ${surveys.startAt} > now() then 1
        else 0
      end asc`,
      desc(surveys.startAt),
      desc(surveys.updatedAt),
    )
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => {
      const eff = effectiveStatus({ status: r.status, endAt: r.endAt, now });
      const started = now.getTime() >= r.startAt.getTime();
      const ended = isSurveyEnded(r.endAt, now);
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        effectiveStatus: eff,
        startAt: r.startAt,
        endAt: r.endAt,
        anonymousResponses: r.anonymousResponses,
        phase: ended ? ("closed" as const) : started ? ("active" as const) : ("upcoming" as const),
        submittedAt: r.responseUpdatedAt,
        updatedAt: r.updatedAt,
      };
    }),
  };
}

export async function getPortalSurveyDetail(params: { userId: string; surveyId: string }) {
  const now = new Date();
  const ctx = await getAudienceContext(params.userId);
  const visibleIds = await getVisibleIdsForUser({
    ctx,
    scopesTable: surveyScopes,
    resourceIdColumn: surveyScopes.surveyId,
    scopeTypeColumn: surveyScopes.scopeType,
    refIdColumn: surveyScopes.refId,
  });
  const visibility = buildVisibilityCondition({ visibleIds, visibleAllColumn: surveys.visibleAll, idColumn: surveys.id });

  const rows = await db
    .select({
      id: surveys.id,
      title: surveys.title,
      descriptionMd: surveys.descriptionMd,
      status: surveys.status,
      startAt: surveys.startAt,
      endAt: surveys.endAt,
      anonymousResponses: surveys.anonymousResponses,
      createdBy: surveys.createdBy,
      visibleAll: surveys.visibleAll,
      deletedAt: surveys.deletedAt,
    })
    .from(surveys)
    .where(and(eq(surveys.id, params.surveyId), isNull(surveys.deletedAt), or(eq(surveys.status, "published"), eq(surveys.status, "closed")), or(eq(surveys.createdBy, params.userId), visibility)!))
    .limit(1);

  const survey = rows[0];
  if (!survey) throw notFound("问卷不存在或不可见");

  const { sections } = await getSurveyDefinition({ surveyId: survey.id });

  const responseRows = await db
    .select({ id: surveyResponses.id, updatedAt: surveyResponses.updatedAt })
    .from(surveyResponses)
    .where(and(eq(surveyResponses.surveyId, survey.id), eq(surveyResponses.userId, params.userId)))
    .limit(1);

  const response = responseRows[0];
  const itemRows =
    !response
      ? []
      : await db
          .select({ questionId: surveyResponseItems.questionId, value: surveyResponseItems.value })
          .from(surveyResponseItems)
          .where(eq(surveyResponseItems.responseId, response.id));

  const eff = effectiveStatus({ status: survey.status, endAt: survey.endAt, now });
  const canSubmit = eff === "published" && isBetween({ startAt: survey.startAt, endAt: survey.endAt, now });

  return {
    id: survey.id,
    title: survey.title,
    descriptionMd: survey.descriptionMd,
    status: survey.status,
    effectiveStatus: eff,
    startAt: survey.startAt,
    endAt: survey.endAt,
    anonymousResponses: survey.anonymousResponses,
    visibleAll: survey.visibleAll,
    canSubmit,
    sections,
    myResponse: response
      ? {
          submittedAt: response.updatedAt,
          items: itemRows.map((r) => ({ questionId: r.questionId, value: r.value as SurveyAnswerValue })),
        }
      : null,
  };
}

function buildQuestionIndex(params: { sections: Array<{ id: string; title: string; sort: number; questions: Array<{ id: string; questionType: SurveyQuestionType; required: boolean; options: Array<{ id: string }> }> }> }) {
  const questionMap = new Map<string, { questionType: SurveyQuestionType; required: boolean; optionIdSet: Set<string> }>();
  for (const section of params.sections) {
    for (const q of section.questions) {
      const optionIdSet = new Set<string>();
      for (const opt of q.options ?? []) optionIdSet.add(opt.id);
      questionMap.set(q.id, { questionType: q.questionType, required: q.required, optionIdSet });
    }
  }
  return questionMap;
}

function normalizeResponseItems(params: {
  questionIndex: Map<string, { questionType: SurveyQuestionType; required: boolean; optionIdSet: Set<string> }>;
  body: SubmitSurveyResponseBody;
}) {
  const itemsByQuestionId = new Map<string, SurveyAnswerValue>();

  for (const item of params.body.items) {
    const meta = params.questionIndex.get(item.questionId);
    if (!meta) throw badRequest("存在不属于该问卷的 questionId");

    if (itemsByQuestionId.has(item.questionId)) throw badRequest("同一题目不允许重复提交答案");

    const qt = meta.questionType;
    const v = item.value as SurveyAnswerValue;

    if (qt === "text") {
      if (!("text" in v)) throw badRequest("文本题答案格式错误");
      const text = v.text.trim();
      if (!text) {
        if (meta.required) throw badRequest("存在必填题未填写");
        continue;
      }
      itemsByQuestionId.set(item.questionId, { text });
      continue;
    }

    if (qt === "single") {
      if (!("optionId" in v)) throw badRequest("单选题答案格式错误");
      if (!meta.optionIdSet.has(v.optionId)) throw badRequest("单选题选项不合法");
      itemsByQuestionId.set(item.questionId, { optionId: v.optionId });
      continue;
    }

    if (qt === "multi") {
      if (!("optionIds" in v)) throw badRequest("多选题答案格式错误");
      const unique = [...new Set(v.optionIds)];
      if (unique.length === 0) {
        if (meta.required) throw badRequest("存在必填题未填写");
        continue;
      }
      for (const id of unique) {
        if (!meta.optionIdSet.has(id)) throw badRequest("多选题选项不合法");
      }
      itemsByQuestionId.set(item.questionId, { optionIds: unique });
      continue;
    }

    if (!("value" in v)) throw badRequest("评分题答案格式错误");
    const value = Math.trunc(v.value);
    if (value < 1 || value > 5) throw badRequest("评分题取值范围为 1~5");
    itemsByQuestionId.set(item.questionId, { value });
  }

  for (const [questionId, meta] of params.questionIndex.entries()) {
    if (!meta.required) continue;
    if (!itemsByQuestionId.has(questionId)) throw badRequest("存在必填题未填写");
  }

  return [...itemsByQuestionId.entries()].map(([questionId, value]) => ({ questionId, value }));
}

export async function submitSurveyResponse(params: { userId: string; surveyId: string; body: SubmitSurveyResponseBody }) {
  const now = new Date();
  const detail = await getPortalSurveyDetail({ userId: params.userId, surveyId: params.surveyId });
  if (!detail.canSubmit) throw badRequest("问卷当前不可提交（未开始或已结束）");

  const questionIndex = buildQuestionIndex({
    sections: detail.sections.map((s) => ({
      id: s.id,
      title: s.title,
      sort: s.sort,
      questions: s.questions.map((q) => ({
        id: q.id,
        questionType: q.questionType,
        required: q.required,
        options: q.options ?? [],
      })),
    })),
  });

  const normalized = normalizeResponseItems({ questionIndex, body: params.body });

  const responseId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(surveyResponses)
      .values({ surveyId: params.surveyId, userId: params.userId })
      .onConflictDoUpdate({
        target: [surveyResponses.surveyId, surveyResponses.userId],
        set: { updatedAt: sql`now()` },
      })
      .returning({ id: surveyResponses.id });

    const id = inserted[0]!.id;

    await tx.delete(surveyResponseItems).where(eq(surveyResponseItems.responseId, id));
    if (normalized.length > 0) {
      await tx.insert(surveyResponseItems).values(normalized.map((i) => ({ responseId: id, questionId: i.questionId, value: i.value })));
    }

    return id;
  });

  return {
    ok: true,
    responseId,
    submittedAt: now,
  };
}

export async function listConsoleSurveys(params: {
  actorUserId: string;
  page: number;
  pageSize: number;
  q?: string;
  status?: "draft" | "published" | "closed";
  mine: boolean;
}) {
  const now = new Date();
  const { condition: visibilityCondition } = await buildUserIdDataScopeCondition({
    actorUserId: params.actorUserId,
    module: "survey",
    targetUserIdColumn: surveys.createdBy,
  });

  const baseWhere = [isNull(surveys.deletedAt)];
  if (visibilityCondition) baseWhere.push(visibilityCondition);
  if (params.mine) baseWhere.push(eq(surveys.createdBy, params.actorUserId));

  if (params.status === "draft") {
    baseWhere.push(eq(surveys.status, "draft"));
  } else if (params.status === "published") {
    baseWhere.push(and(eq(surveys.status, "published"), sql`${surveys.endAt} > now()`)!);
  } else if (params.status === "closed") {
    baseWhere.push(or(eq(surveys.status, "closed"), and(eq(surveys.status, "published"), sql`${surveys.endAt} <= now()`)!)!);
  }

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    baseWhere.push(sql`${surveys.title} ilike ${pattern}`);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(surveys)
    .where(and(...baseWhere));

  const rows = await db
    .select({
      id: surveys.id,
      title: surveys.title,
      status: surveys.status,
      startAt: surveys.startAt,
      endAt: surveys.endAt,
      anonymousResponses: surveys.anonymousResponses,
      visibleAll: surveys.visibleAll,
      createdBy: surveys.createdBy,
      createdAt: surveys.createdAt,
      updatedAt: surveys.updatedAt,
    })
    .from(surveys)
    .where(and(...baseWhere))
    .orderBy(desc(surveys.updatedAt))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      effectiveStatus: effectiveStatus({ status: r.status, endAt: r.endAt, now }),
      startAt: r.startAt,
      endAt: r.endAt,
      anonymousResponses: r.anonymousResponses,
      visibleAll: r.visibleAll,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
}

export async function countConsolePublishedSurveysEndingSoon(params: { actorUserId: string; withinDays: number }) {
  const withinDays = Math.max(1, Math.min(365, Math.floor(params.withinDays)));
  const now = new Date();
  const to = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const { condition: visibilityCondition } = await buildUserIdDataScopeCondition({
    actorUserId: params.actorUserId,
    module: "survey",
    targetUserIdColumn: surveys.createdBy,
  });

  const where = [
    isNull(surveys.deletedAt),
    eq(surveys.status, "published"),
    sql`${surveys.endAt} > now()`,
    sql`${surveys.endAt} <= ${to.toISOString()}`,
  ];
  if (visibilityCondition) where.push(visibilityCondition);

  const row = await db
    .select({ total: sql<number>`count(*)` })
    .from(surveys)
    .where(and(...where));

  return Number(row[0]?.total ?? 0);
}

export async function listConsolePublishedSurveysEndingSoon(params: { actorUserId: string; withinDays: number; limit: number }) {
  const withinDays = Math.max(1, Math.min(365, Math.floor(params.withinDays)));
  const limit = Math.max(1, Math.min(100, Math.floor(params.limit)));
  const now = new Date();
  const to = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const { condition: visibilityCondition } = await buildUserIdDataScopeCondition({
    actorUserId: params.actorUserId,
    module: "survey",
    targetUserIdColumn: surveys.createdBy,
  });

  const where = [
    isNull(surveys.deletedAt),
    eq(surveys.status, "published"),
    sql`${surveys.endAt} > now()`,
    sql`${surveys.endAt} <= ${to.toISOString()}`,
  ];
  if (visibilityCondition) where.push(visibilityCondition);

  const rows = await db
    .select({
      id: surveys.id,
      title: surveys.title,
      endAt: surveys.endAt,
      updatedAt: surveys.updatedAt,
    })
    .from(surveys)
    .where(and(...where))
    .orderBy(asc(surveys.endAt), desc(surveys.updatedAt), desc(surveys.id))
    .limit(limit);

  return rows.map((r) => ({ id: r.id, title: r.title, endAt: r.endAt, updatedAt: r.updatedAt }));
}

async function getConsoleSurveyBase(params: { actorUserId: string; surveyId: string }) {
  const { condition: visibilityCondition } = await buildUserIdDataScopeCondition({
    actorUserId: params.actorUserId,
    module: "survey",
    targetUserIdColumn: surveys.createdBy,
  });

  const rows = await db
    .select({
      id: surveys.id,
      title: surveys.title,
      descriptionMd: surveys.descriptionMd,
      status: surveys.status,
      startAt: surveys.startAt,
      endAt: surveys.endAt,
      anonymousResponses: surveys.anonymousResponses,
      visibleAll: surveys.visibleAll,
      createdBy: surveys.createdBy,
      createdAt: surveys.createdAt,
      updatedAt: surveys.updatedAt,
      deletedAt: surveys.deletedAt,
    })
    .from(surveys)
    .where(and(eq(surveys.id, params.surveyId), isNull(surveys.deletedAt), visibilityCondition ?? sql`true`))
    .limit(1);

  const survey = rows[0];
  if (!survey) throw notFound("问卷不存在或无权限");
  return survey;
}

export async function getConsoleSurveyDetail(params: { actorUserId: string; surveyId: string }) {
  const now = new Date();
  const survey = await getConsoleSurveyBase(params);
  const scopes = survey.visibleAll ? [] : await getSurveyScopes(survey.id);
  const { sections } = await getSurveyDefinition({ surveyId: survey.id });

  return {
    id: survey.id,
    title: survey.title,
    descriptionMd: survey.descriptionMd,
    status: survey.status,
    effectiveStatus: effectiveStatus({ status: survey.status, endAt: survey.endAt, now }),
    startAt: survey.startAt,
    endAt: survey.endAt,
    anonymousResponses: survey.anonymousResponses,
    visibleAll: survey.visibleAll,
    scopes,
    sections,
    createdBy: survey.createdBy,
    createdAt: survey.createdAt,
    updatedAt: survey.updatedAt,
  };
}

export async function createSurveyDraft(params: {
  actorUserId: string;
  body: {
    title: string;
    descriptionMd: string;
    startAt: string;
    endAt: string;
    anonymousResponses: boolean;
    visibleAll: boolean;
    scopes: Array<{ scopeType: "role" | "department" | "position"; refId: string }>;
  };
  actor: AuditActor;
  request: RequestContext;
}) {
  const ok = await hasPerm(params.actorUserId, "campus:survey:create");
  if (!ok) throw forbidden();

  const startAt = parseIsoDateTime(params.body.startAt, "startAt");
  const endAt = parseIsoDateTime(params.body.endAt, "endAt");
  if (endAt.getTime() <= startAt.getTime()) throw badRequest("endAt 必须晚于 startAt");

  if (!params.body.visibleAll && params.body.scopes.length === 0) {
    throw badRequest("visibleAll=false 时必须至少选择一个可见范围（role/department/position）");
  }

  try {
    const created = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(surveys)
        .values({
          title: params.body.title.trim(),
          descriptionMd: params.body.descriptionMd ?? "",
          startAt,
          endAt,
          anonymousResponses: params.body.anonymousResponses,
          visibleAll: params.body.visibleAll,
          status: "draft",
          createdBy: params.actorUserId,
          updatedBy: params.actorUserId,
        })
        .returning({ id: surveys.id });

      const surveyId = inserted[0]!.id;

      await tx.insert(surveySections).values({ surveyId, title: "第 1 部分", sort: 0 });

      if (!params.body.visibleAll && params.body.scopes.length > 0) {
        await tx.insert(surveyScopes).values(
          params.body.scopes.map((s) => ({
            surveyId,
            scopeType: s.scopeType,
            refId: s.refId,
          })),
        );
      }

      return surveyId;
    });

    await writeAuditLog({
      actor: params.actor,
      action: "survey.create",
      targetType: "survey",
      targetId: created,
      success: true,
      request: params.request,
      diff: { title: params.body.title.trim() },
    });

    return { id: created };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "survey.create",
      targetType: "survey",
      targetId: "new",
      success: false,
      errorCode: "INTERNAL_ERROR",
      request: params.request,
      diff: { title: params.body.title.trim() },
    }).catch(() => {});
    throw err;
  }
}

export async function updateSurveyDraft(params: {
  actorUserId: string;
  surveyId: string;
  body: UpdateSurveyDraftBody;
  actor: AuditActor;
  request: RequestContext;
}) {
  const ok = await hasPerm(params.actorUserId, "campus:survey:update");
  if (!ok) throw forbidden();

  const survey = await getConsoleSurveyBase({ actorUserId: params.actorUserId, surveyId: params.surveyId });
  if (survey.status !== "draft") throw badRequest("仅草稿状态允许编辑结构");

  const responseExists = await db
    .select({ id: surveyResponses.id })
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, params.surveyId))
    .limit(1);
  if (responseExists[0]) throw badRequest("该草稿已产生答卷，禁止编辑结构（请新建问卷）");

  const { startAt, endAt } = validateDraftDefinition(params.body);

  const before = await getConsoleSurveyDetail({ actorUserId: params.actorUserId, surveyId: params.surveyId });

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(surveys)
        .set({
          title: params.body.title.trim(),
          descriptionMd: params.body.descriptionMd ?? "",
          startAt,
          endAt,
          anonymousResponses: params.body.anonymousResponses,
          visibleAll: params.body.visibleAll,
          updatedBy: params.actorUserId,
        })
        .where(eq(surveys.id, params.surveyId));

      await tx.delete(surveyScopes).where(eq(surveyScopes.surveyId, params.surveyId));
      if (!params.body.visibleAll && params.body.scopes.length > 0) {
        await tx.insert(surveyScopes).values(
          params.body.scopes.map((s) => ({
            surveyId: params.surveyId,
            scopeType: s.scopeType,
            refId: s.refId,
          })),
        );
      }

      await tx.delete(surveySections).where(eq(surveySections.surveyId, params.surveyId));

      if (params.body.sections.length > 0) {
        await tx.insert(surveySections).values(
          params.body.sections.map((s) => ({
            id: s.id,
            surveyId: params.surveyId,
            title: s.title,
            sort: s.sort,
          })),
        );

        const qValues = params.body.sections.flatMap((s) =>
          s.questions.map((q) => ({
            id: q.id,
            surveyId: params.surveyId,
            sectionId: s.id,
            questionType: q.questionType,
            title: q.title,
            description: q.description?.trim() ? q.description.trim() : null,
            required: q.required,
            sort: q.sort,
          })),
        );
        if (qValues.length > 0) await tx.insert(surveyQuestions).values(qValues);

        const optValues = params.body.sections.flatMap((s) =>
          s.questions.flatMap((q) =>
            (q.options ?? []).map((opt) => ({
              id: opt.id,
              questionId: q.id,
              label: opt.label,
              sort: opt.sort,
            })),
          ),
        );
        if (optValues.length > 0) await tx.insert(surveyQuestionOptions).values(optValues);
      }
    });

    const after = await getConsoleSurveyDetail({ actorUserId: params.actorUserId, surveyId: params.surveyId });

    await writeAuditLog({
      actor: params.actor,
      action: "survey.update",
      targetType: "survey",
      targetId: params.surveyId,
      success: true,
      request: params.request,
      diff: { before, after },
    });

    return after;
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "survey.update",
      targetType: "survey",
      targetId: params.surveyId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      request: params.request,
      diff: { beforeId: params.surveyId },
    }).catch(() => {});
    throw err;
  }
}

export async function publishSurvey(params: { actorUserId: string; surveyId: string; actor: AuditActor; request: RequestContext }) {
  const ok = await hasPerm(params.actorUserId, "campus:survey:publish");
  if (!ok) throw forbidden();

  const survey = await getConsoleSurveyBase({ actorUserId: params.actorUserId, surveyId: params.surveyId });
  if (survey.status !== "draft") return getConsoleSurveyDetail({ actorUserId: params.actorUserId, surveyId: params.surveyId });

  const { sections } = await getSurveyDefinition({ surveyId: params.surveyId });
  validatePublishReady({ sections });

  try {
    await db
      .update(surveys)
      .set({ status: "published", updatedBy: params.actorUserId })
      .where(eq(surveys.id, params.surveyId));

    await writeAuditLog({
      actor: params.actor,
      action: "survey.publish",
      targetType: "survey",
      targetId: params.surveyId,
      success: true,
      request: params.request,
      diff: null,
    });

    return getConsoleSurveyDetail({ actorUserId: params.actorUserId, surveyId: params.surveyId });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "survey.publish",
      targetType: "survey",
      targetId: params.surveyId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      request: params.request,
      diff: null,
    }).catch(() => {});
    throw err;
  }
}

export async function closeSurvey(params: { actorUserId: string; surveyId: string; actor: AuditActor; request: RequestContext }) {
  const ok = await hasPerm(params.actorUserId, "campus:survey:close");
  if (!ok) throw forbidden();

  const survey = await getConsoleSurveyBase({ actorUserId: params.actorUserId, surveyId: params.surveyId });
  if (survey.status === "draft") throw badRequest("草稿问卷不允许关闭（请先发布或直接删除）");
  if (survey.status === "closed") return getConsoleSurveyDetail({ actorUserId: params.actorUserId, surveyId: params.surveyId });

  try {
    await db.update(surveys).set({ status: "closed", updatedBy: params.actorUserId }).where(eq(surveys.id, params.surveyId));

    await writeAuditLog({
      actor: params.actor,
      action: "survey.close",
      targetType: "survey",
      targetId: params.surveyId,
      success: true,
      request: params.request,
      diff: null,
    });

    return getConsoleSurveyDetail({ actorUserId: params.actorUserId, surveyId: params.surveyId });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "survey.close",
      targetType: "survey",
      targetId: params.surveyId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      request: params.request,
      diff: null,
    }).catch(() => {});
    throw err;
  }
}

export async function deleteSurvey(params: { actorUserId: string; surveyId: string; actor: AuditActor; request: RequestContext }) {
  const ok = await hasPerm(params.actorUserId, "campus:survey:delete");
  if (!ok) throw forbidden();

  await getConsoleSurveyBase({ actorUserId: params.actorUserId, surveyId: params.surveyId });

  await db.update(surveys).set({ deletedAt: sql`now()`, updatedBy: params.actorUserId }).where(eq(surveys.id, params.surveyId));

  await writeAuditLog({
    actor: params.actor,
    action: "survey.delete",
    targetType: "survey",
    targetId: params.surveyId,
    success: true,
    request: params.request,
    diff: null,
  });

  return { ok: true };
}

export async function getSurveyResults(params: { actorUserId: string; surveyId: string }) {
  const ok = await hasPerm(params.actorUserId, "campus:survey:read");
  if (!ok) throw forbidden();

  const survey = await getConsoleSurveyBase({ actorUserId: params.actorUserId, surveyId: params.surveyId });

  const { sections, flatQuestions } = await getSurveyDefinition({ surveyId: params.surveyId });

  const responseRows = await db
    .select({ id: surveyResponses.id, userId: surveyResponses.userId, updatedAt: surveyResponses.updatedAt })
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, params.surveyId))
    .orderBy(desc(surveyResponses.updatedAt));

  const responseIds = responseRows.map((r) => r.id);
  const itemRows =
    responseIds.length === 0
      ? []
      : await db
          .select({ responseId: surveyResponseItems.responseId, questionId: surveyResponseItems.questionId, value: surveyResponseItems.value })
          .from(surveyResponseItems)
          .where(inArray(surveyResponseItems.responseId, responseIds));

  const itemMap = new Map<string, Array<{ questionId: string; value: SurveyAnswerValue }>>();
  for (const row of itemRows) {
    const list = itemMap.get(row.responseId) ?? [];
    list.push({ questionId: row.questionId, value: row.value as SurveyAnswerValue });
    itemMap.set(row.responseId, list);
  }

  const responses: SurveyResponse[] = responseRows.map((r) => ({
    submittedAt: r.updatedAt,
    items: itemMap.get(r.id) ?? [],
  }));

  const results = buildSurveyResults({ questions: flatQuestions, responses, textSampleLimitPerQuestion: 30 });

  return {
    survey: {
      id: survey.id,
      title: survey.title,
      status: survey.status,
      startAt: survey.startAt,
      endAt: survey.endAt,
      anonymousResponses: survey.anonymousResponses,
      visibleAll: survey.visibleAll,
    },
    sections,
    results,
  };
}

export async function exportSurveyCsv(params: { actorUserId: string; surveyId: string }) {
  const ok = await hasPerm(params.actorUserId, "campus:survey:export");
  if (!ok) throw forbidden();

  const survey = await getConsoleSurveyBase({ actorUserId: params.actorUserId, surveyId: params.surveyId });
  const { flatQuestions } = await getSurveyDefinition({ surveyId: params.surveyId });

  const responseRows = await db
    .select({
      id: surveyResponses.id,
      userId: surveyResponses.userId,
      updatedAt: surveyResponses.updatedAt,
      name: profiles.name,
      studentId: profiles.studentId,
    })
    .from(surveyResponses)
    .leftJoin(profiles, eq(profiles.id, surveyResponses.userId))
    .where(eq(surveyResponses.surveyId, params.surveyId))
    .orderBy(desc(surveyResponses.updatedAt));

  const responseIds = responseRows.map((r) => r.id);
  const itemRows =
    responseIds.length === 0
      ? []
      : await db
          .select({ responseId: surveyResponseItems.responseId, questionId: surveyResponseItems.questionId, value: surveyResponseItems.value })
          .from(surveyResponseItems)
          .where(inArray(surveyResponseItems.responseId, responseIds));

  const itemMap = new Map<string, Array<{ questionId: string; value: SurveyAnswerValue }>>();
  for (const row of itemRows) {
    const list = itemMap.get(row.responseId) ?? [];
    list.push({ questionId: row.questionId, value: row.value as SurveyAnswerValue });
    itemMap.set(row.responseId, list);
  }

  const includeIdentity = !survey.anonymousResponses;

  const responses: SurveyResponse[] = responseRows.map((r) => ({
    submittedAt: r.updatedAt,
    user: includeIdentity && r.name && r.studentId ? { name: r.name, studentId: r.studentId } : undefined,
    items: itemMap.get(r.id) ?? [],
  }));

  const csv = buildSurveyCsv({ questions: flatQuestions, responses, includeIdentity });
  return { csv, fileName: `${survey.title}-答卷.csv` };
}

function sanitizeTextSampleForAi(raw: string) {
  let text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+/g, " ").trim();
  if (!text) return "";

  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<邮箱已脱敏>");
  text = text.replace(/(^|[^0-9])(1[3-9][0-9]{9})(?![0-9])/g, "$1<手机号已脱敏>");
  text = text.replace(/(^|[^0-9])(\d{15}|\d{17}[0-9Xx])(?![0-9])/g, "$1<身份证号已脱敏>");
  text = text.replace(/```/g, "`\u200b``");

  const maxLen = 300;
  if (text.length > maxLen) text = `${text.slice(0, maxLen)}…`;
  return text;
}

function buildAiPrompt(params: {
  title: string;
  startAt: Date;
  endAt: Date;
  totalResponses: number;
  results: ReturnType<typeof buildSurveyResults>;
}) {
  const lines: string[] = [];

  lines.push(`# 问卷：${params.title}`);
  lines.push(`- 时间：${params.startAt.toISOString()} ~ ${params.endAt.toISOString()}`);
  lines.push(`- 有效答卷数：${params.totalResponses}`);
  lines.push("");
  lines.push("## 统计摘要（结构化数据）");

  for (const q of params.results.questions) {
    lines.push(`### ${q.sectionTitle ? `${q.sectionTitle} / ` : ""}${q.title}`);
    lines.push(`- 题型：${q.questionType}`);
    lines.push(`- 作答数：${q.answeredCount}`);

    if (q.questionType === "rating") {
      lines.push(`- 平均分：${q.avg ?? "—"}`);
      lines.push("- 分布：");
      for (const d of q.distribution) lines.push(`  - ${d.value}：${d.count}（${d.percent}%）`);
    } else if (q.questionType === "single" || q.questionType === "multi") {
      lines.push("- 选项分布：");
      for (const opt of q.options) lines.push(`  - ${opt.label}：${opt.count}（${opt.percent}%）`);
    } else if (q.questionType === "text") {
      lines.push(`- 文本样本（抽样；已基础脱敏；最多 ${Math.min(30, q.samples.length)} 条）：`);
      for (const s of q.samples.slice(0, 30)) {
        const sanitized = sanitizeTextSampleForAi(s);
        if (!sanitized) continue;
        lines.push(`  - ${sanitized}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function generateSurveyAiSummaryMarkdown(params: {
  actorUserId: string;
  surveyId: string;
  prompt?: string;
}) {
  const ok = await hasPerm(params.actorUserId, "campus:survey:ai_summary");
  if (!ok) throw forbidden();

  const survey = await getConsoleSurveyBase({ actorUserId: params.actorUserId, surveyId: params.surveyId });
  const now = new Date();
  const eff = effectiveStatus({ status: survey.status, endAt: survey.endAt, now });
  if (eff !== "closed") throw badRequest("仅已结束（closed）的问卷允许生成 AI 总结");

  const customPrompt = params.prompt?.trim() ?? "";
  if (customPrompt.length > 2000) throw badRequest("自定义 Prompt 过长（最大 2000 字符）");

  const { flatQuestions } = await getSurveyDefinition({ surveyId: params.surveyId });

  const responseRows = await db
    .select({ id: surveyResponses.id, updatedAt: surveyResponses.updatedAt })
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, params.surveyId))
    .orderBy(desc(surveyResponses.updatedAt));

  const responseIds = responseRows.map((r) => r.id);
  const itemRows =
    responseIds.length === 0
      ? []
      : await db
          .select({ responseId: surveyResponseItems.responseId, questionId: surveyResponseItems.questionId, value: surveyResponseItems.value })
          .from(surveyResponseItems)
          .where(inArray(surveyResponseItems.responseId, responseIds));

  const itemMap = new Map<string, Array<{ questionId: string; value: SurveyAnswerValue }>>();
  for (const row of itemRows) {
    const list = itemMap.get(row.responseId) ?? [];
    list.push({ questionId: row.questionId, value: row.value as SurveyAnswerValue });
    itemMap.set(row.responseId, list);
  }

  const responses: SurveyResponse[] = responseRows.map((r) => ({
    submittedAt: r.updatedAt,
    items: itemMap.get(r.id) ?? [],
  }));

  const results = buildSurveyResults({ questions: flatQuestions, responses, textSampleLimitPerQuestion: 30 });
  const basePrompt = buildAiPrompt({
    title: survey.title,
    startAt: survey.startAt,
    endAt: survey.endAt,
    totalResponses: responses.length,
    results,
  });

  const defaultPrompt =
    "请输出：\n" +
    "1) TL;DR（3-5 条要点）\n" +
    "2) 关键发现（含数据点）\n" +
    "3) 评分题结论（如有）\n" +
    "4) 选择题分布解读（如有）\n" +
    "5) 文本题主题归纳（基于样本；注明“样本抽样”）\n" +
    "6) 建议行动项（可执行、可排序）\n";

  const markdown = await createChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "你是严谨的数据分析助手。根据给定问卷的统计与文本样本，输出一份可直接用于公示/汇报的 Markdown 总结。要求：结构清晰、结论可追溯、避免编造未提供的数据。",
      },
      {
        role: "user",
        content:
          `${basePrompt}\n\n${customPrompt ? customPrompt : defaultPrompt}`,
      },
    ],
    temperature: 0.2,
    maxTokens: 1600,
  });

  return { markdown };
}
