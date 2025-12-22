import "server-only";

import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import {
  archiveCollectTask,
  batchProcessCollectSubmissions,
  closeCollectTask,
  countConsolePublishedCollectTasksDueSoon,
  createCollectTaskDraft,
  deleteCollectTask,
  deleteMyCollectFile,
  exportCollectZip,
  findConsoleCollectTaskBySource,
  findPortalCollectTaskBySource,
  getCollectScopeOptions,
  getConsoleCollectSubmissionDetail,
  getConsoleCollectTaskDetail,
  getPortalCollectTaskDetail,
  listConsolePublishedCollectTasksDueSoon,
  listConsoleCollectSubmissions,
  listConsoleCollectTasks,
  listPortalCollectTasks,
  publishCollectTask,
  streamCollectZip,
  submitMyCollect,
  updateCollectTaskDueAt,
  updateCollectTaskDraft,
  uploadCollectItemTemplate,
  uploadMyCollectFile,
  withdrawMyCollect,
} from "@/lib/modules/collect/collect.service";
import type { CollectModuleConfig, CollectScopeInput, CollectSubmissionStatus, CollectTaskStatus } from "@/lib/modules/collect/collect.types";

export type MaterialStatus = CollectTaskStatus;
export type MaterialSubmissionStatus = CollectSubmissionStatus;

const materialConfig: CollectModuleConfig = {
  module: "material",
  templateBucket: "material-templates",
  submissionBucket: "material-submissions",
};

function toMaterialSource(noticeId: string | null | undefined) {
  const id = noticeId?.trim() ?? "";
  return id ? ({ type: "notice", id } as const) : null;
}

export async function findConsoleMaterialByNoticeId(params: { actorUserId: string; noticeId: string }) {
  const source = toMaterialSource(params.noticeId);
  if (!source) return null;

  const task = await findConsoleCollectTaskBySource({ config: materialConfig, actorUserId: params.actorUserId, source });
  if (!task) return null;

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    dueAt: task.dueAt,
    archivedAt: task.archivedAt,
    createdBy: task.createdBy,
    updatedAt: task.updatedAt,
  };
}

export async function findPortalMaterialByNoticeId(params: { userId: string; noticeId: string }) {
  const source = toMaterialSource(params.noticeId);
  if (!source) return null;

  const task = await findPortalCollectTaskBySource({ config: materialConfig, userId: params.userId, source });
  if (!task) return null;

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    dueAt: task.dueAt,
    canSubmit: task.canSubmit,
    updatedAt: task.updatedAt,
  };
}

type CollectConsoleDetail = Awaited<ReturnType<typeof getConsoleCollectTaskDetail>>;

function toConsoleMaterialDetail(data: CollectConsoleDetail) {
  return {
    id: data.id,
    noticeId: data.source?.type === "notice" ? data.source.id : null,
    notice: data.sourceMeta?.type === "notice" ? { id: data.sourceMeta.id, title: data.sourceMeta.title } : null,
    title: data.title,
    descriptionMd: data.descriptionMd,
    status: data.status,
    visibleAll: data.visibleAll,
    scopes: data.scopes,
    maxFilesPerSubmission: data.maxFilesPerSubmission,
    dueAt: data.dueAt,
    archivedAt: data.archivedAt,
    createdBy: data.createdBy,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    items: data.items.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      required: i.required,
      sort: i.sort,
      template: i.template,
    })),
  };
}

export async function getMaterialScopeOptions() {
  return getCollectScopeOptions();
}

export async function listConsoleMaterials(params: {
  actorUserId: string;
  page: number;
  pageSize: number;
  q?: string;
  status?: MaterialStatus;
  mine: boolean;
  archived: boolean;
}) {
  const data = await listConsoleCollectTasks({
    config: materialConfig,
    actorUserId: params.actorUserId,
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    status: params.status,
    mine: params.mine,
    archived: params.archived,
  });

  return {
    ...data,
    items: data.items.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      noticeId: i.source?.type === "notice" ? i.source.id : null,
      visibleAll: i.visibleAll,
      maxFilesPerSubmission: i.maxFilesPerSubmission,
      dueAt: i.dueAt,
      createdBy: i.createdBy,
      archivedAt: i.archivedAt,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    })),
  };
}

export async function countConsolePublishedMaterialsDueSoon(params: { actorUserId: string; withinDays: number }) {
  return countConsolePublishedCollectTasksDueSoon({ config: materialConfig, actorUserId: params.actorUserId, withinDays: params.withinDays });
}

export async function listConsolePublishedMaterialsDueSoon(params: { actorUserId: string; withinDays: number; limit: number }) {
  return listConsolePublishedCollectTasksDueSoon({
    config: materialConfig,
    actorUserId: params.actorUserId,
    withinDays: params.withinDays,
    limit: params.limit,
  });
}

export async function getConsoleMaterialDetail(params: { actorUserId: string; materialId: string }) {
  const data = await getConsoleCollectTaskDetail({ config: materialConfig, actorUserId: params.actorUserId, taskId: params.materialId });
  return toConsoleMaterialDetail(data);
}

export async function createMaterialDraft(params: {
  actorUserId: string;
  body: {
    title: string;
    descriptionMd: string;
    noticeId: string | null;
    visibleAll: boolean;
    scopes: CollectScopeInput[];
    maxFilesPerSubmission: number;
    dueAt: Date | null;
    items: Array<{ id: string; title: string; description: string | null; required: boolean; sort: number }>;
  };
  actor: AuditActor;
  request: RequestContext;
}) {
  return createCollectTaskDraft({
    config: materialConfig,
    actorUserId: params.actorUserId,
    body: {
      title: params.body.title,
      descriptionMd: params.body.descriptionMd,
      source: toMaterialSource(params.body.noticeId),
      visibleAll: params.body.visibleAll,
      scopes: params.body.scopes,
      maxFilesPerSubmission: params.body.maxFilesPerSubmission,
      dueAt: params.body.dueAt ?? null,
      items: params.body.items,
    },
    actor: params.actor,
    request: params.request,
  });
}

export async function updateMaterialDraft(params: {
  actorUserId: string;
  materialId: string;
  body: {
    title: string;
    descriptionMd: string;
    noticeId: string | null;
    visibleAll: boolean;
    scopes: CollectScopeInput[];
    maxFilesPerSubmission: number;
    dueAt: Date | null;
    items: Array<{ id: string; title: string; description: string | null; required: boolean; sort: number }>;
  };
  actor: AuditActor;
  request: RequestContext;
}) {
  const data = await updateCollectTaskDraft({
    config: materialConfig,
    actorUserId: params.actorUserId,
    taskId: params.materialId,
    body: {
      title: params.body.title,
      descriptionMd: params.body.descriptionMd,
      source: toMaterialSource(params.body.noticeId),
      visibleAll: params.body.visibleAll,
      scopes: params.body.scopes,
      maxFilesPerSubmission: params.body.maxFilesPerSubmission,
      dueAt: params.body.dueAt ?? null,
      items: params.body.items,
    },
    actor: params.actor,
    request: params.request,
  });

  return toConsoleMaterialDetail(data);
}

export async function publishMaterial(params: { actorUserId: string; materialId: string; actor: AuditActor; request: RequestContext }) {
  const data = await publishCollectTask({
    config: materialConfig,
    actorUserId: params.actorUserId,
    taskId: params.materialId,
    actor: params.actor,
    request: params.request,
  });
  return toConsoleMaterialDetail(data);
}

export async function closeMaterial(params: { actorUserId: string; materialId: string; actor: AuditActor; request: RequestContext }) {
  const data = await closeCollectTask({
    config: materialConfig,
    actorUserId: params.actorUserId,
    taskId: params.materialId,
    actor: params.actor,
    request: params.request,
  });
  return toConsoleMaterialDetail(data);
}

export async function archiveMaterial(params: { actorUserId: string; materialId: string; actor: AuditActor; request: RequestContext }) {
  const data = await archiveCollectTask({
    config: materialConfig,
    actorUserId: params.actorUserId,
    taskId: params.materialId,
    actor: params.actor,
    request: params.request,
  });
  return toConsoleMaterialDetail(data);
}

export async function deleteMaterial(params: { actorUserId: string; materialId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  return deleteCollectTask({
    config: materialConfig,
    actorUserId: params.actorUserId,
    taskId: params.materialId,
    actor: params.actor,
    request: params.request,
    reason: params.reason,
  });
}

export async function updateMaterialDueAt(params: {
  actorUserId: string;
  materialId: string;
  dueAt: Date;
  actor: AuditActor;
  request: RequestContext;
}) {
  const data = await updateCollectTaskDueAt({
    config: materialConfig,
    actorUserId: params.actorUserId,
    taskId: params.materialId,
    dueAt: params.dueAt,
    actor: params.actor,
    request: params.request,
  });
  return toConsoleMaterialDetail(data);
}

export async function uploadMaterialItemTemplate(params: {
  actorUserId: string;
  materialId: string;
  itemId: string;
  file: File;
  actor: AuditActor;
  request: RequestContext;
}) {
  const data = await uploadCollectItemTemplate({
    config: materialConfig,
    actorUserId: params.actorUserId,
    taskId: params.materialId,
    itemId: params.itemId,
    file: params.file,
    actor: params.actor,
    request: params.request,
  });
  return toConsoleMaterialDetail(data);
}

export async function listPortalMaterials(params: { userId: string; page: number; pageSize: number; q?: string }) {
  const data = await listPortalCollectTasks({ config: materialConfig, userId: params.userId, page: params.page, pageSize: params.pageSize, q: params.q });
  const now = Date.now();
  return {
    ...data,
    items: data.items.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      noticeId: i.source?.type === "notice" ? i.source.id : null,
      dueAt: i.dueAt,
      canSubmit: i.status === "published" && !!i.dueAt && now <= i.dueAt.getTime(),
      updatedAt: i.updatedAt,
    })),
  };
}

export async function getPortalMaterialDetail(params: { userId: string; materialId: string }) {
  const data = await getPortalCollectTaskDetail({ config: materialConfig, userId: params.userId, taskId: params.materialId });
  return {
    id: data.id,
    title: data.title,
    descriptionMd: data.descriptionMd,
    status: data.status,
    maxFilesPerSubmission: data.maxFilesPerSubmission,
    dueAt: data.dueAt,
    canSubmit: data.canSubmit,
    notice: data.sourceMeta?.type === "notice" ? { id: data.sourceMeta.id, title: data.sourceMeta.title } : null,
    items: data.items.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      required: i.required,
      sort: i.sort,
      template: i.template,
    })),
    mySubmission: data.mySubmission
      ? {
          id: data.mySubmission.id,
          submittedAt: data.mySubmission.submittedAt,
          withdrawnAt: data.mySubmission.withdrawnAt,
          status: data.mySubmission.status,
          studentMessage: data.mySubmission.studentMessage,
          missingRequired: data.mySubmission.missingRequired,
          files: data.mySubmission.files,
        }
      : null,
  };
}

export async function uploadMyMaterialFile(params: {
  userId: string;
  materialId: string;
  itemId: string;
  file: File;
  actor: AuditActor;
  request: RequestContext;
}) {
  return uploadMyCollectFile({
    config: materialConfig,
    userId: params.userId,
    taskId: params.materialId,
    itemId: params.itemId,
    file: params.file,
    actor: params.actor,
    request: params.request,
  });
}

export async function deleteMyMaterialFile(params: { userId: string; materialId: string; fileId: string; actor: AuditActor; request: RequestContext }) {
  return deleteMyCollectFile({
    config: materialConfig,
    userId: params.userId,
    taskId: params.materialId,
    fileId: params.fileId,
    actor: params.actor,
    request: params.request,
  });
}

export async function submitMyMaterial(params: { userId: string; materialId: string; actor: AuditActor; request: RequestContext }) {
  return submitMyCollect({ config: materialConfig, userId: params.userId, taskId: params.materialId, actor: params.actor, request: params.request });
}

export async function withdrawMyMaterial(params: { userId: string; materialId: string; actor: AuditActor; request: RequestContext }) {
  return withdrawMyCollect({ config: materialConfig, userId: params.userId, taskId: params.materialId, actor: params.actor, request: params.request });
}

export async function listConsoleMaterialSubmissions(params: {
  actorUserId: string;
  materialId: string;
  page: number;
  pageSize: number;
  q?: string;
  status?: MaterialSubmissionStatus;
  missingRequired?: boolean;
  from?: Date;
  to?: Date;
  departmentId?: string;
}) {
  return listConsoleCollectSubmissions({
    config: materialConfig,
    actorUserId: params.actorUserId,
    taskId: params.materialId,
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    status: params.status,
    missingRequired: params.missingRequired,
    from: params.from,
    to: params.to,
    departmentId: params.departmentId,
  });
}

export async function getConsoleMaterialSubmissionDetail(params: {
  actorUserId: string;
  materialId: string;
  submissionId: string;
  includeDownloadUrls: boolean;
}) {
  return getConsoleCollectSubmissionDetail({
    config: materialConfig,
    actorUserId: params.actorUserId,
    taskId: params.materialId,
    submissionId: params.submissionId,
    includeDownloadUrls: params.includeDownloadUrls,
  });
}

export async function batchProcessMaterialSubmissions(params: {
  actorUserId: string;
  materialId: string;
  body: {
    submissionIds: string[];
    action: "assignToMe" | "unassign" | "setStatus";
    status?: MaterialSubmissionStatus;
    studentMessage?: string | null;
    staffNote?: string | null;
  };
  actor: AuditActor;
  request: RequestContext;
}) {
  return batchProcessCollectSubmissions({
    config: materialConfig,
    actorUserId: params.actorUserId,
    taskId: params.materialId,
    body: params.body,
    actor: params.actor,
    request: params.request,
  });
}

export async function exportMaterialZip(params: {
  actorUserId: string;
  materialId: string;
  filters: {
    q?: string;
    status?: MaterialSubmissionStatus;
    missingRequired?: boolean;
    from?: Date;
    to?: Date;
    departmentId?: string;
    includeUnsubmitted?: boolean;
  };
}) {
  return exportCollectZip({ config: materialConfig, actorUserId: params.actorUserId, taskId: params.materialId, filters: params.filters });
}

export async function streamMaterialZip(params: { fileName: string; manifest: string; entries: Array<{ fileKey: string; path: string; fileName: string }> }) {
  return streamCollectZip({ config: materialConfig, fileName: params.fileName, manifest: params.manifest, entries: params.entries });
}
