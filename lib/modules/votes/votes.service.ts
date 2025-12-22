import "server-only";

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { hasPerm } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/http/errors";
import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import { buildVisibilityCondition, getAudienceContext, getVisibleIdsForUser } from "@/lib/modules/content-visibility/contentVisibility";
import { getVisibilityScopeOptions } from "@/lib/modules/content-visibility/scopeOptions";
import { buildUserIdDataScopeCondition } from "@/lib/modules/data-permission/dataPermission.where";
import type { SubmitVoteResponseBody, UpdateVoteDraftBody, VoteQuestionType } from "./votes.schemas";
import { buildVoteResults, type VoteAnswerValue, type VoteQuestion, type VoteResponse, type VoteResults } from "./votes.analytics";
import {
  voteQuestionOptions,
  voteQuestions,
  voteResponseItems,
  voteResponses,
  voteScopes,
  votes,
} from "@campus-hub/db";

type VoteDefinitionOption = { id: string; label: string; sort: number };

type VoteDefinitionQuestion = {
  id: string;
  questionType: VoteQuestionType;
  title: string;
  description: string | null;
  required: boolean;
  sort: number;
  maxChoices: number;
  options: VoteDefinitionOption[];
};

function parseIsoDateTime(value: string, name: string) {
  const v = value.trim();
  if (!v) throw badRequest(`${name} 必填`);
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) throw badRequest(`${name} 必须为 ISO 时间字符串`);
  return d;
}

function isVoteEnded(endAt: Date, now: Date) {
  return endAt.getTime() <= now.getTime();
}

function effectiveStatus(params: { status: "draft" | "published" | "closed"; endAt: Date; now: Date }) {
  if (params.status === "draft") return "draft" as const;
  if (params.status === "closed") return "closed" as const;
  return isVoteEnded(params.endAt, params.now) ? ("closed" as const) : ("published" as const);
}

function isBetween(params: { startAt: Date; endAt: Date; now: Date }) {
  return params.now.getTime() >= params.startAt.getTime() && params.now.getTime() < params.endAt.getTime();
}

async function autoUnpinExpiredVotes() {
  await db
    .update(votes)
    .set({ pinned: false, pinnedAt: null })
    .where(
      and(
        eq(votes.pinned, true),
        sql`${votes.endAt} <= now()`,
        isNull(votes.deletedAt),
        sql`${votes.archivedAt} is null`,
      ),
    );
}

export async function getVoteScopeOptions() {
  return getVisibilityScopeOptions();
}

async function getVoteDefinition(params: { voteId: string }) {
  const questionRows = await db
    .select({
      id: voteQuestions.id,
      questionType: voteQuestions.questionType,
      title: voteQuestions.title,
      description: voteQuestions.description,
      required: voteQuestions.required,
      sort: voteQuestions.sort,
      maxChoices: voteQuestions.maxChoices,
    })
    .from(voteQuestions)
    .where(eq(voteQuestions.voteId, params.voteId))
    .orderBy(asc(voteQuestions.sort), asc(voteQuestions.createdAt));

  const questionIds = questionRows.map((q) => q.id);
  const optionRows =
    questionIds.length === 0
      ? []
      : await db
          .select({
            id: voteQuestionOptions.id,
            questionId: voteQuestionOptions.questionId,
            label: voteQuestionOptions.label,
            sort: voteQuestionOptions.sort,
          })
          .from(voteQuestionOptions)
          .where(inArray(voteQuestionOptions.questionId, questionIds))
          .orderBy(asc(voteQuestionOptions.sort), asc(voteQuestionOptions.createdAt));

  const optionMap = new Map<string, VoteDefinitionOption[]>();
  for (const opt of optionRows) {
    const list = optionMap.get(opt.questionId) ?? [];
    list.push({ id: opt.id, label: opt.label, sort: opt.sort });
    optionMap.set(opt.questionId, list);
  }

  const questions: VoteDefinitionQuestion[] = questionRows.map((q) => ({
    id: q.id,
    questionType: q.questionType as VoteQuestionType,
    title: q.title,
    description: q.description?.trim() ? q.description.trim() : null,
    required: q.required,
    sort: q.sort,
    maxChoices: q.maxChoices,
    options: (optionMap.get(q.id) ?? []).slice().sort((a, b) => a.sort - b.sort),
  }));

  questions.sort((a, b) => a.sort - b.sort);
  return { questions };
}

async function getVoteScopes(voteId: string) {
  const rows = await db
    .select({ scopeType: voteScopes.scopeType, refId: voteScopes.refId })
    .from(voteScopes)
    .where(eq(voteScopes.voteId, voteId));
  return rows.map((r) => ({ scopeType: r.scopeType as "role" | "department" | "position", refId: r.refId }));
}

function validateDraftDefinition(params: UpdateVoteDraftBody) {
  const startAt = parseIsoDateTime(params.startAt, "startAt");
  const endAt = parseIsoDateTime(params.endAt, "endAt");
  if (endAt.getTime() <= startAt.getTime()) throw badRequest("endAt 必须晚于 startAt");

  if (!params.visibleAll && params.scopes.length === 0) {
    throw badRequest("visibleAll=false 时必须至少选择一个可见范围（role/department/position）");
  }

  const questionIdSet = new Set<string>();
  const optionIdSet = new Set<string>();

  for (const q of params.questions) {
    if (questionIdSet.has(q.id)) throw badRequest("questions.id 不允许重复");
    questionIdSet.add(q.id);

    if (q.questionType === "single" && q.maxChoices !== 1) throw badRequest("单选题 maxChoices 必须为 1");

    const optionCount = q.options.length;
    if (q.questionType === "multi" && q.maxChoices > optionCount) throw badRequest("多选题 maxChoices 不允许超过候选项数量");

    const localOptIdSet = new Set<string>();
    for (const opt of q.options) {
      if (localOptIdSet.has(opt.id)) throw badRequest("同一题目下 options.id 不允许重复");
      localOptIdSet.add(opt.id);
      if (optionIdSet.has(opt.id)) throw badRequest("options.id 不允许在不同题目间复用");
      optionIdSet.add(opt.id);
    }
  }

  return { startAt, endAt };
}

function validatePublishReady(params: { questions: VoteDefinitionQuestion[] }) {
  if (params.questions.length === 0) throw badRequest("发布前必须至少创建 1 道题目");

  for (const q of params.questions) {
    if (q.options.length < 2) throw badRequest("单选/多选题必须至少包含 2 个候选项");
    if (q.questionType === "single" && q.maxChoices !== 1) throw badRequest("单选题 maxChoices 必须为 1");
    if (q.questionType === "multi" && q.maxChoices > q.options.length) throw badRequest("多选题 maxChoices 不允许超过候选项数量");
  }
}

function buildQuestionIndex(params: { questions: Array<{ id: string; questionType: VoteQuestionType; required: boolean; maxChoices: number; options: Array<{ id: string }> }> }) {
  const questionMap = new Map<string, { questionType: VoteQuestionType; required: boolean; maxChoices: number; optionIdSet: Set<string> }>();

  for (const q of params.questions) {
    const optionIdSet = new Set<string>();
    for (const opt of q.options ?? []) optionIdSet.add(opt.id);
    questionMap.set(q.id, { questionType: q.questionType, required: q.required, maxChoices: q.maxChoices, optionIdSet });
  }

  return questionMap;
}

function normalizeResponseItems(params: {
  questionIndex: Map<string, { questionType: VoteQuestionType; required: boolean; maxChoices: number; optionIdSet: Set<string> }>;
  body: SubmitVoteResponseBody;
}) {
  const itemsByQuestionId = new Map<string, VoteAnswerValue>();

  for (const item of params.body.items) {
    const meta = params.questionIndex.get(item.questionId);
    if (!meta) throw badRequest("存在不属于该投票的 questionId");
    if (itemsByQuestionId.has(item.questionId)) throw badRequest("同一题目不允许重复提交答案");

    const qt = meta.questionType;
    const v = item.value as VoteAnswerValue;

    if (qt === "single") {
      if (!("optionId" in v)) throw badRequest("单选题答案格式错误");
      if (!meta.optionIdSet.has(v.optionId)) throw badRequest("单选题选项不合法");
      itemsByQuestionId.set(item.questionId, { optionId: v.optionId });
      continue;
    }

    if (!("optionIds" in v)) throw badRequest("多选题答案格式错误");
    const unique = [...new Set(v.optionIds)];
    if (unique.length === 0) {
      if (meta.required) throw badRequest("存在必答题未填写");
      continue;
    }
    if (unique.length > meta.maxChoices) throw badRequest("多选题选择数量超过上限");
    for (const id of unique) {
      if (!meta.optionIdSet.has(id)) throw badRequest("多选题选项不合法");
    }
    itemsByQuestionId.set(item.questionId, { optionIds: unique });
  }

  for (const [questionId, meta] of params.questionIndex.entries()) {
    if (!meta.required) continue;
    if (!itemsByQuestionId.has(questionId)) throw badRequest("存在必答题未填写");
  }

  return [...itemsByQuestionId.entries()].map(([questionId, value]) => ({ questionId, value }));
}

export async function listPortalVotes(params: { userId: string; page: number; pageSize: number; q?: string }) {
  const now = new Date();
  await autoUnpinExpiredVotes();

  const ctx = await getAudienceContext(params.userId);
  const visibleIds = await getVisibleIdsForUser({
    ctx,
    scopesTable: voteScopes,
    resourceIdColumn: voteScopes.voteId,
    scopeTypeColumn: voteScopes.scopeType,
    refIdColumn: voteScopes.refId,
  });

  const baseWhere = [
    isNull(votes.deletedAt),
    sql`${votes.archivedAt} is null`,
    or(eq(votes.status, "published"), eq(votes.status, "closed")),
  ];

  baseWhere.push(
    or(
      eq(votes.createdBy, params.userId),
      buildVisibilityCondition({ visibleIds, visibleAllColumn: votes.visibleAll, idColumn: votes.id }),
    )!,
  );

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    baseWhere.push(sql`${votes.title} ilike ${pattern}`);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(votes)
    .where(and(...baseWhere));

  const joinOn = and(eq(voteResponses.voteId, votes.id), eq(voteResponses.userId, params.userId));

  const rows = await db
    .select({
      id: votes.id,
      title: votes.title,
      status: votes.status,
      startAt: votes.startAt,
      endAt: votes.endAt,
      anonymousResponses: votes.anonymousResponses,
      pinned: votes.pinned,
      pinnedAt: votes.pinnedAt,
      responseUpdatedAt: voteResponses.updatedAt,
      updatedAt: votes.updatedAt,
    })
    .from(votes)
    .leftJoin(voteResponses, joinOn)
    .where(and(...baseWhere))
    .orderBy(
      desc(votes.pinned),
      desc(votes.pinnedAt),
      sql`case
        when ${votes.status} = 'closed' or ${votes.endAt} <= now() then 2
        when ${votes.startAt} > now() then 1
        else 0
      end asc`,
      desc(votes.startAt),
      desc(votes.updatedAt),
    )
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => {
      const eff = effectiveStatus({ status: r.status as "draft" | "published" | "closed", endAt: r.endAt, now });
      const started = now.getTime() >= r.startAt.getTime();
      const ended = isVoteEnded(r.endAt, now) || r.status === "closed";
      return {
        id: r.id,
        title: r.title,
        status: r.status as "published" | "closed",
        effectiveStatus: eff === "draft" ? ("published" as const) : eff,
        startAt: r.startAt,
        endAt: r.endAt,
        anonymousResponses: r.anonymousResponses,
        pinned: r.pinned,
        phase: ended ? ("closed" as const) : started ? ("active" as const) : ("upcoming" as const),
        submittedAt: r.responseUpdatedAt,
        updatedAt: r.updatedAt,
      };
    }),
  };
}

export async function listMyVotes(params: { userId: string; page: number; pageSize: number; q?: string }) {
  const now = new Date();
  await autoUnpinExpiredVotes();

  const baseWhere = [isNull(votes.deletedAt), or(eq(votes.status, "published"), eq(votes.status, "closed"))];

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    baseWhere.push(sql`${votes.title} ilike ${pattern}`);
  }

  const joinOn = and(eq(voteResponses.voteId, votes.id), eq(voteResponses.userId, params.userId));
  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(votes)
    .innerJoin(voteResponses, joinOn)
    .where(and(...baseWhere));

  const rows = await db
    .select({
      id: votes.id,
      title: votes.title,
      status: votes.status,
      startAt: votes.startAt,
      endAt: votes.endAt,
      anonymousResponses: votes.anonymousResponses,
      pinned: votes.pinned,
      pinnedAt: votes.pinnedAt,
      archivedAt: votes.archivedAt,
      responseUpdatedAt: voteResponses.updatedAt,
      updatedAt: votes.updatedAt,
    })
    .from(votes)
    .innerJoin(voteResponses, joinOn)
    .where(and(...baseWhere))
    .orderBy(desc(voteResponses.updatedAt))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => {
      const eff = effectiveStatus({ status: r.status as "draft" | "published" | "closed", endAt: r.endAt, now });
      const started = now.getTime() >= r.startAt.getTime();
      const ended = isVoteEnded(r.endAt, now) || r.status === "closed";
      return {
        id: r.id,
        title: r.title,
        status: r.status as "published" | "closed",
        effectiveStatus: eff === "draft" ? ("published" as const) : eff,
        startAt: r.startAt,
        endAt: r.endAt,
        anonymousResponses: r.anonymousResponses,
        pinned: r.pinned,
        archivedAt: r.archivedAt,
        phase: ended ? ("closed" as const) : started ? ("active" as const) : ("upcoming" as const),
        submittedAt: r.responseUpdatedAt,
        updatedAt: r.updatedAt,
      };
    }),
  };
}

export async function getPortalVoteDetail(params: { userId: string; voteId: string }) {
  const now = new Date();
  await autoUnpinExpiredVotes();

  const ctx = await getAudienceContext(params.userId);
  const visibleIds = await getVisibleIdsForUser({
    ctx,
    scopesTable: voteScopes,
    resourceIdColumn: voteScopes.voteId,
    scopeTypeColumn: voteScopes.scopeType,
    refIdColumn: voteScopes.refId,
  });
  const visibility = buildVisibilityCondition({ visibleIds, visibleAllColumn: votes.visibleAll, idColumn: votes.id });

  const joinOn = and(eq(voteResponses.voteId, votes.id), eq(voteResponses.userId, params.userId));

  const rows = await db
    .select({
      id: votes.id,
      title: votes.title,
      descriptionMd: votes.descriptionMd,
      status: votes.status,
      startAt: votes.startAt,
      endAt: votes.endAt,
      anonymousResponses: votes.anonymousResponses,
      visibleAll: votes.visibleAll,
      pinned: votes.pinned,
      archivedAt: votes.archivedAt,
      createdBy: votes.createdBy,
      deletedAt: votes.deletedAt,
      myResponseId: voteResponses.id,
      myResponseUpdatedAt: voteResponses.updatedAt,
    })
    .from(votes)
    .leftJoin(voteResponses, joinOn)
    .where(
      and(
        eq(votes.id, params.voteId),
        isNull(votes.deletedAt),
        or(eq(votes.status, "published"), eq(votes.status, "closed")),
        or(eq(votes.createdBy, params.userId), visibility, sql`${voteResponses.id} is not null`)!,
      ),
    )
    .limit(1);

  const vote = rows[0];
  if (!vote) throw notFound("投票不存在或不可见");

  const { questions } = await getVoteDefinition({ voteId: vote.id });

  const responseId = vote.myResponseId;
  const itemRows =
    !responseId
      ? []
      : await db
          .select({ questionId: voteResponseItems.questionId, value: voteResponseItems.value })
          .from(voteResponseItems)
          .where(eq(voteResponseItems.responseId, responseId));

  if (vote.archivedAt && !responseId && vote.createdBy !== params.userId) {
    throw notFound("投票已归档，仅对已参与用户可见");
  }

  const eff = effectiveStatus({ status: vote.status as "draft" | "published" | "closed", endAt: vote.endAt, now });
  const canSubmit = eff === "published" && !vote.archivedAt && isBetween({ startAt: vote.startAt, endAt: vote.endAt, now });
  const showResults = !!vote.archivedAt || eff === "closed";

  const myItems = itemRows.map((r) => ({ questionId: r.questionId, value: r.value as VoteAnswerValue }));

  const results = showResults ? await getVoteResultsInternal({ voteId: vote.id, questions }) : null;

  return {
    id: vote.id,
    title: vote.title,
    descriptionMd: vote.descriptionMd,
    status: vote.status as "published" | "closed",
    effectiveStatus: eff === "draft" ? ("published" as const) : eff,
    startAt: vote.startAt,
    endAt: vote.endAt,
    anonymousResponses: vote.anonymousResponses,
    visibleAll: vote.visibleAll,
    pinned: vote.pinned,
    archivedAt: vote.archivedAt,
    canSubmit,
    questions,
    myResponse: responseId
      ? {
          submittedAt: vote.myResponseUpdatedAt,
          items: myItems,
        }
      : null,
    results,
  };
}

async function getVoteResultsInternal(params: { voteId: string; questions: VoteDefinitionQuestion[] }): Promise<VoteResults> {
  const questionModels: VoteQuestion[] = params.questions.map((q) => ({
    id: q.id,
    questionType: q.questionType,
    title: q.title,
    required: q.required,
    sort: q.sort,
    maxChoices: q.maxChoices,
    options: q.options.map((o) => ({ id: o.id, label: o.label, sort: o.sort })),
  }));

  const responseRows = await db
    .select({ id: voteResponses.id, updatedAt: voteResponses.updatedAt })
    .from(voteResponses)
    .where(eq(voteResponses.voteId, params.voteId))
    .orderBy(desc(voteResponses.updatedAt));

  const responseIds = responseRows.map((r) => r.id);
  const itemRows =
    responseIds.length === 0
      ? []
      : await db
          .select({ responseId: voteResponseItems.responseId, questionId: voteResponseItems.questionId, value: voteResponseItems.value })
          .from(voteResponseItems)
          .where(inArray(voteResponseItems.responseId, responseIds));

  const itemMap = new Map<string, Array<{ questionId: string; value: VoteAnswerValue }>>();
  for (const row of itemRows) {
    const list = itemMap.get(row.responseId) ?? [];
    list.push({ questionId: row.questionId, value: row.value as VoteAnswerValue });
    itemMap.set(row.responseId, list);
  }

  const responses: VoteResponse[] = responseRows.map((r) => ({
    submittedAt: r.updatedAt,
    items: itemMap.get(r.id) ?? [],
  }));

  return buildVoteResults({ questions: questionModels, responses });
}

export async function submitVoteResponse(params: { userId: string; voteId: string; body: SubmitVoteResponseBody }) {
  const now = new Date();
  const detail = await getPortalVoteDetail({ userId: params.userId, voteId: params.voteId });
  if (!detail.canSubmit) throw badRequest("投票当前不可提交（未开始或已结束/归档）");

  const questionIndex = buildQuestionIndex({
    questions: detail.questions.map((q) => ({
      id: q.id,
      questionType: q.questionType,
      required: q.required,
      maxChoices: q.maxChoices,
      options: q.options ?? [],
    })),
  });

  const normalized = normalizeResponseItems({ questionIndex, body: params.body });

  const responseId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(voteResponses)
      .values({ voteId: params.voteId, userId: params.userId })
      .onConflictDoUpdate({
        target: [voteResponses.voteId, voteResponses.userId],
        set: { updatedAt: sql`now()` },
      })
      .returning({ id: voteResponses.id });

    const id = inserted[0]!.id;

    await tx.delete(voteResponseItems).where(eq(voteResponseItems.responseId, id));
    if (normalized.length > 0) {
      await tx.insert(voteResponseItems).values(normalized.map((i) => ({ responseId: id, questionId: i.questionId, value: i.value })));
    }

    return id;
  });

  return {
    ok: true,
    responseId,
    submittedAt: now,
  };
}

export async function listConsoleVotes(params: {
  actorUserId: string;
  page: number;
  pageSize: number;
  q?: string;
  status?: "draft" | "published" | "closed";
  mine: boolean;
  archived: boolean;
}) {
  const now = new Date();
  await autoUnpinExpiredVotes();

  const { condition: visibilityCondition } = await buildUserIdDataScopeCondition({
    actorUserId: params.actorUserId,
    module: "vote",
    targetUserIdColumn: votes.createdBy,
  });

  const baseWhere = [isNull(votes.deletedAt)];
  if (visibilityCondition) baseWhere.push(visibilityCondition);
  if (params.mine) baseWhere.push(eq(votes.createdBy, params.actorUserId));
  baseWhere.push(params.archived ? sql`${votes.archivedAt} is not null` : sql`${votes.archivedAt} is null`);

  if (params.status === "draft") {
    baseWhere.push(eq(votes.status, "draft"));
  } else if (params.status === "published") {
    baseWhere.push(and(eq(votes.status, "published"), sql`${votes.endAt} > now()`)!);
  } else if (params.status === "closed") {
    baseWhere.push(or(eq(votes.status, "closed"), and(eq(votes.status, "published"), sql`${votes.endAt} <= now()`)!)!);
  }

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    baseWhere.push(sql`${votes.title} ilike ${pattern}`);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(votes)
    .where(and(...baseWhere));

  const rows = await db
    .select({
      id: votes.id,
      title: votes.title,
      status: votes.status,
      startAt: votes.startAt,
      endAt: votes.endAt,
      anonymousResponses: votes.anonymousResponses,
      visibleAll: votes.visibleAll,
      pinned: votes.pinned,
      pinnedAt: votes.pinnedAt,
      archivedAt: votes.archivedAt,
      createdBy: votes.createdBy,
      createdAt: votes.createdAt,
      updatedAt: votes.updatedAt,
    })
    .from(votes)
    .where(and(...baseWhere))
    .orderBy(desc(votes.pinned), desc(votes.pinnedAt), desc(votes.updatedAt))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status as "draft" | "published" | "closed",
      effectiveStatus: effectiveStatus({ status: r.status as "draft" | "published" | "closed", endAt: r.endAt, now }),
      startAt: r.startAt,
      endAt: r.endAt,
      anonymousResponses: r.anonymousResponses,
      visibleAll: r.visibleAll,
      pinned: r.pinned,
      archivedAt: r.archivedAt,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
}

async function getConsoleVoteBase(params: { actorUserId: string; voteId: string }) {
  const { condition: visibilityCondition } = await buildUserIdDataScopeCondition({
    actorUserId: params.actorUserId,
    module: "vote",
    targetUserIdColumn: votes.createdBy,
  });

  const rows = await db
    .select({
      id: votes.id,
      title: votes.title,
      descriptionMd: votes.descriptionMd,
      status: votes.status,
      startAt: votes.startAt,
      endAt: votes.endAt,
      anonymousResponses: votes.anonymousResponses,
      visibleAll: votes.visibleAll,
      pinned: votes.pinned,
      pinnedAt: votes.pinnedAt,
      archivedAt: votes.archivedAt,
      createdBy: votes.createdBy,
      createdAt: votes.createdAt,
      updatedAt: votes.updatedAt,
      deletedAt: votes.deletedAt,
    })
    .from(votes)
    .where(and(eq(votes.id, params.voteId), isNull(votes.deletedAt), visibilityCondition ?? sql`true`))
    .limit(1);

  const vote = rows[0];
  if (!vote) throw notFound("投票不存在或无权限");
  return vote;
}

export async function getConsoleVoteDetail(params: { actorUserId: string; voteId: string }) {
  const now = new Date();
  await autoUnpinExpiredVotes();

  const vote = await getConsoleVoteBase(params);
  const scopes = vote.visibleAll ? [] : await getVoteScopes(vote.id);
  const { questions } = await getVoteDefinition({ voteId: vote.id });

  return {
    id: vote.id,
    title: vote.title,
    descriptionMd: vote.descriptionMd,
    status: vote.status as "draft" | "published" | "closed",
    effectiveStatus: effectiveStatus({ status: vote.status as "draft" | "published" | "closed", endAt: vote.endAt, now }),
    startAt: vote.startAt,
    endAt: vote.endAt,
    anonymousResponses: vote.anonymousResponses,
    visibleAll: vote.visibleAll,
    pinned: vote.pinned,
    pinnedAt: vote.pinnedAt,
    archivedAt: vote.archivedAt,
    scopes,
    questions,
    createdBy: vote.createdBy,
    createdAt: vote.createdAt,
    updatedAt: vote.updatedAt,
  };
}

export async function createVoteDraft(params: {
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
  const ok = await hasPerm(params.actorUserId, "campus:vote:create");
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
        .insert(votes)
        .values({
          title: params.body.title.trim(),
          descriptionMd: params.body.descriptionMd ?? "",
          startAt,
          endAt,
          anonymousResponses: params.body.anonymousResponses,
          visibleAll: params.body.visibleAll,
          status: "draft",
          pinned: false,
          pinnedAt: null,
          createdBy: params.actorUserId,
          updatedBy: params.actorUserId,
        })
        .returning({ id: votes.id });

      const voteId = inserted[0]!.id;

      const qInserted = await tx
        .insert(voteQuestions)
        .values({
          voteId,
          questionType: "single",
          title: "第 1 题",
          description: null,
          required: true,
          sort: 0,
          maxChoices: 1,
        })
        .returning({ id: voteQuestions.id });

      const questionId = qInserted[0]!.id;
      await tx.insert(voteQuestionOptions).values([
        { questionId, label: "选项 1", sort: 0 },
        { questionId, label: "选项 2", sort: 1 },
      ]);

      if (!params.body.visibleAll && params.body.scopes.length > 0) {
        await tx.insert(voteScopes).values(
          params.body.scopes.map((s) => ({
            voteId,
            scopeType: s.scopeType,
            refId: s.refId,
          })),
        );
      }

      return voteId;
    });

    await writeAuditLog({
      actor: params.actor,
      action: "vote.create",
      targetType: "vote",
      targetId: created,
      success: true,
      request: params.request,
      diff: { title: params.body.title.trim() },
    });

    return { id: created };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "vote.create",
      targetType: "vote",
      targetId: "new",
      success: false,
      errorCode: "INTERNAL_ERROR",
      request: params.request,
      diff: { title: params.body.title.trim() },
    }).catch(() => {});
    throw err;
  }
}

export async function updateVoteDraft(params: {
  actorUserId: string;
  voteId: string;
  body: UpdateVoteDraftBody;
  actor: AuditActor;
  request: RequestContext;
}) {
  const ok = await hasPerm(params.actorUserId, "campus:vote:update");
  if (!ok) throw forbidden();

  const vote = await getConsoleVoteBase({ actorUserId: params.actorUserId, voteId: params.voteId });
  if (vote.archivedAt) throw conflict("已归档投票不允许编辑");
  if (vote.status !== "draft") throw badRequest("仅草稿状态允许编辑结构");

  const responseExists = await db
    .select({ id: voteResponses.id })
    .from(voteResponses)
    .where(eq(voteResponses.voteId, params.voteId))
    .limit(1);
  if (responseExists[0]) throw badRequest("该草稿已产生提交，禁止编辑结构（请新建投票）");

  const { startAt, endAt } = validateDraftDefinition(params.body);
  const before = await getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(votes)
        .set({
          title: params.body.title.trim(),
          descriptionMd: params.body.descriptionMd ?? "",
          startAt,
          endAt,
          anonymousResponses: params.body.anonymousResponses,
          visibleAll: params.body.visibleAll,
          pinned: false,
          pinnedAt: null,
          updatedBy: params.actorUserId,
        })
        .where(eq(votes.id, params.voteId));

      await tx.delete(voteScopes).where(eq(voteScopes.voteId, params.voteId));
      if (!params.body.visibleAll && params.body.scopes.length > 0) {
        await tx.insert(voteScopes).values(
          params.body.scopes.map((s) => ({
            voteId: params.voteId,
            scopeType: s.scopeType,
            refId: s.refId,
          })),
        );
      }

      await tx.delete(voteQuestions).where(eq(voteQuestions.voteId, params.voteId));

      if (params.body.questions.length > 0) {
        await tx.insert(voteQuestions).values(
          params.body.questions.map((q) => ({
            id: q.id,
            voteId: params.voteId,
            questionType: q.questionType,
            title: q.title,
            description: q.description?.trim() ? q.description.trim() : null,
            required: q.required,
            sort: q.sort,
            maxChoices: q.maxChoices,
          })),
        );

        const optValues = params.body.questions.flatMap((q) =>
          q.options.map((opt) => ({
            id: opt.id,
            questionId: q.id,
            label: opt.label,
            sort: opt.sort,
          })),
        );
        if (optValues.length > 0) await tx.insert(voteQuestionOptions).values(optValues);
      }
    });

    const after = await getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });

    await writeAuditLog({
      actor: params.actor,
      action: "vote.update",
      targetType: "vote",
      targetId: params.voteId,
      success: true,
      request: params.request,
      diff: { before, after },
    });

    return after;
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "vote.update",
      targetType: "vote",
      targetId: params.voteId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      request: params.request,
      diff: { beforeId: params.voteId },
    }).catch(() => {});
    throw err;
  }
}

export async function publishVote(params: { actorUserId: string; voteId: string; actor: AuditActor; request: RequestContext }) {
  const ok = await hasPerm(params.actorUserId, "campus:vote:publish");
  if (!ok) throw forbidden();

  const vote = await getConsoleVoteBase({ actorUserId: params.actorUserId, voteId: params.voteId });
  if (vote.archivedAt) throw conflict("已归档投票不允许发布");
  if (vote.status !== "draft") return getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });

  const { questions } = await getVoteDefinition({ voteId: params.voteId });
  validatePublishReady({ questions });

  try {
    await db.update(votes).set({ status: "published", updatedBy: params.actorUserId }).where(eq(votes.id, params.voteId));

    await writeAuditLog({
      actor: params.actor,
      action: "vote.publish",
      targetType: "vote",
      targetId: params.voteId,
      success: true,
      request: params.request,
      diff: null,
    });

    return getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "vote.publish",
      targetType: "vote",
      targetId: params.voteId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      request: params.request,
      diff: null,
    }).catch(() => {});
    throw err;
  }
}

export async function closeVote(params: { actorUserId: string; voteId: string; actor: AuditActor; request: RequestContext }) {
  const ok = await hasPerm(params.actorUserId, "campus:vote:close");
  if (!ok) throw forbidden();

  const vote = await getConsoleVoteBase({ actorUserId: params.actorUserId, voteId: params.voteId });
  if (vote.archivedAt) return getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });
  if (vote.status === "draft") throw badRequest("草稿投票不允许关闭（请先发布）");
  if (vote.status === "closed") return getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });

  try {
    await db
      .update(votes)
      .set({ status: "closed", pinned: false, pinnedAt: null, updatedBy: params.actorUserId })
      .where(eq(votes.id, params.voteId));

    await writeAuditLog({
      actor: params.actor,
      action: "vote.close",
      targetType: "vote",
      targetId: params.voteId,
      success: true,
      request: params.request,
      diff: null,
    });

    return getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "vote.close",
      targetType: "vote",
      targetId: params.voteId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      request: params.request,
      diff: null,
    }).catch(() => {});
    throw err;
  }
}

export async function extendVote(params: { actorUserId: string; voteId: string; endAt: string; actor: AuditActor; request: RequestContext }) {
  const ok = await hasPerm(params.actorUserId, "campus:vote:extend");
  if (!ok) throw forbidden();

  const vote = await getConsoleVoteBase({ actorUserId: params.actorUserId, voteId: params.voteId });
  if (vote.archivedAt) throw conflict("已归档投票不允许延期");
  if (vote.status === "draft") throw badRequest("草稿投票不允许延期（请直接编辑 endAt）");

  const before = await getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });

  const now = new Date();
  const endAt = parseIsoDateTime(params.endAt, "endAt");
  if (endAt.getTime() <= vote.endAt.getTime()) throw badRequest("endAt 必须晚于当前结束时间");
  if (endAt.getTime() <= now.getTime()) throw badRequest("endAt 必须晚于当前时间");
  if (endAt.getTime() <= vote.startAt.getTime()) throw badRequest("endAt 必须晚于 startAt");

  const nextStatus = vote.status === "closed" ? "published" : "published";

  try {
    await db
      .update(votes)
      .set({ endAt, status: nextStatus, updatedBy: params.actorUserId })
      .where(eq(votes.id, params.voteId));

    const after = await getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });

    await writeAuditLog({
      actor: params.actor,
      action: "vote.extend",
      targetType: "vote",
      targetId: params.voteId,
      success: true,
      request: params.request,
      diff: { before, after },
    });

    return after;
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "vote.extend",
      targetType: "vote",
      targetId: params.voteId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      request: params.request,
      diff: { beforeId: params.voteId },
    }).catch(() => {});
    throw err;
  }
}

export async function pinVote(params: { actorUserId: string; voteId: string; pinned: boolean; actor: AuditActor; request: RequestContext }) {
  const ok = await hasPerm(params.actorUserId, "campus:vote:pin");
  if (!ok) throw forbidden();

  const before = await getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });
  if (before.archivedAt) throw conflict("已归档投票不允许置顶");

  const now = new Date();
  const eff = effectiveStatus({ status: before.status, endAt: before.endAt, now });

  if (params.pinned) {
    if (before.status !== "published") throw conflict("仅已发布投票允许置顶");
    if (eff === "closed") throw conflict("已结束投票不允许置顶（请先延期）");
    if (before.pinned) return before;
  } else {
    if (!before.pinned) return before;
  }

  try {
    await db
      .update(votes)
      .set({ pinned: params.pinned, pinnedAt: params.pinned ? now : null, updatedBy: params.actorUserId })
      .where(eq(votes.id, params.voteId));

    const after = await getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });

    await writeAuditLog({
      actor: params.actor,
      action: "vote.pin",
      targetType: "vote",
      targetId: params.voteId,
      success: true,
      request: params.request,
      diff: { before, after, pinned: params.pinned },
    });

    return after;
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "vote.pin",
      targetType: "vote",
      targetId: params.voteId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      request: params.request,
      diff: { beforeId: params.voteId, pinned: params.pinned },
    }).catch(() => {});
    throw err;
  }
}

export async function archiveVote(params: { actorUserId: string; voteId: string; actor: AuditActor; request: RequestContext }) {
  const ok = await hasPerm(params.actorUserId, "campus:vote:archive");
  if (!ok) throw forbidden();

  const before = await getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });
  if (before.archivedAt) return before;

  const now = new Date();
  const eff = effectiveStatus({ status: before.status, endAt: before.endAt, now });
  if (eff !== "closed") throw conflict("投票结束后才允许归档");

  try {
    await db
      .update(votes)
      .set({ status: "closed", archivedAt: now, pinned: false, pinnedAt: null, updatedBy: params.actorUserId })
      .where(eq(votes.id, params.voteId));

    const after = await getConsoleVoteDetail({ actorUserId: params.actorUserId, voteId: params.voteId });

    await writeAuditLog({
      actor: params.actor,
      action: "vote.archive",
      targetType: "vote",
      targetId: params.voteId,
      success: true,
      request: params.request,
      diff: { before, after },
    });

    return after;
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "vote.archive",
      targetType: "vote",
      targetId: params.voteId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      request: params.request,
      diff: { beforeId: params.voteId },
    }).catch(() => {});
    throw err;
  }
}

export async function getVoteResults(params: { actorUserId: string; voteId: string }) {
  const ok = await hasPerm(params.actorUserId, "campus:vote:read");
  if (!ok) throw forbidden();

  const vote = await getConsoleVoteBase({ actorUserId: params.actorUserId, voteId: params.voteId });
  const { questions } = await getVoteDefinition({ voteId: vote.id });
  const results = await getVoteResultsInternal({ voteId: vote.id, questions });

  return {
    vote: {
      id: vote.id,
      title: vote.title,
      status: vote.status as "draft" | "published" | "closed",
      startAt: vote.startAt,
      endAt: vote.endAt,
      anonymousResponses: vote.anonymousResponses,
      visibleAll: vote.visibleAll,
      pinned: vote.pinned,
      archivedAt: vote.archivedAt,
    },
    questions,
    results,
  };
}
