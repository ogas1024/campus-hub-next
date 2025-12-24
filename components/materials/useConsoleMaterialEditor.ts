"use client";

import { useEffect, useMemo, useState } from "react";

import type { ConsoleMaterialDetail, MaterialItemInput, MaterialScopeInput, MaterialStatus } from "@/lib/api/console-materials";
import {
  archiveConsoleMaterial,
  closeConsoleMaterial,
  createConsoleMaterial,
  deleteConsoleMaterial,
  fetchConsoleMaterialDetail,
  publishConsoleMaterial,
  updateConsoleMaterialDraft,
  updateConsoleMaterialDueAt,
  uploadMaterialItemTemplate,
} from "@/lib/api/console-materials";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { createEmptySelectedScopes, selectedScopesFromInputs, selectedScopesToInputs } from "@/lib/ui/visibilityScope";

type Mode = "create" | "edit";

export type ConsoleMaterialEditorPerms = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canClose: boolean;
  canArchive: boolean;
  canProcess: boolean;
  canManageAll: boolean;
};

type MaterialItemState = ConsoleMaterialDetail["items"][number];

type DraftSnapshot = {
  title: string;
  descriptionMd: string;
  noticeId: string;
  visibleAll: boolean;
  scopes: MaterialScopeInput[];
  maxFilesPerSubmission: number;
  dueAtLocal: string;
  items: Array<{ id: string; title: string; description: string | null; required: boolean; sort: number }>;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(value: string | Date) {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toIso(value: string, name: string) {
  if (!value) throw new Error(`${name} 必填`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} 格式无效`);
  return date.toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function normalizeItems(items: MaterialItemState[]) {
  return items.map((i, idx) => ({
    id: i.id,
    title: i.title.trim(),
    description: i.description?.trim() ? i.description.trim() : null,
    required: i.required,
    sort: idx,
  }));
}

function normalizeSnapshot(snapshot: DraftSnapshot) {
  const scopes = snapshot.scopes
    .slice()
    .sort((a, b) => `${a.scopeType}:${a.refId}`.localeCompare(`${b.scopeType}:${b.refId}`));

  const items = snapshot.items
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((it, idx) => ({ ...it, sort: idx }));

  return {
    title: snapshot.title,
    descriptionMd: snapshot.descriptionMd,
    noticeId: snapshot.noticeId,
    visibleAll: snapshot.visibleAll,
    scopes,
    maxFilesPerSubmission: snapshot.maxFilesPerSubmission,
    dueAtLocal: snapshot.dueAtLocal,
    items,
  };
}

function snapshotKey(snapshot: DraftSnapshot) {
  return JSON.stringify(normalizeSnapshot(snapshot));
}

export function useConsoleMaterialEditor(params: {
  open: boolean;
  mode: Mode;
  materialId?: string;
  createNoticeId?: string;
  createNoticeIdLocked?: boolean;
  currentUserId: string;
  perms: ConsoleMaterialEditorPerms;
}) {
  const action = useAsyncAction();

  const effectiveMaterialId = params.mode === "edit" ? params.materialId ?? null : null;

  const [loading, setLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadedMaterialId, setLoadedMaterialId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [noticeId, setNoticeId] = useState("");
  const [noticeIdLocked, setNoticeIdLocked] = useState(false);
  const [linkedNotice, setLinkedNotice] = useState<ConsoleMaterialDetail["notice"]>(null);

  const [visibleAll, setVisibleAll] = useState(true);
  const [selected, setSelected] = useState(createEmptySelectedScopes);
  const [maxFilesPerSubmission, setMaxFilesPerSubmission] = useState(10);
  const [dueAtLocal, setDueAtLocal] = useState("");
  const [items, setItems] = useState<MaterialItemState[]>([]);

  const [status, setStatus] = useState<MaterialStatus>("draft");
  const [archivedAt, setArchivedAt] = useState<string | null>(null);
  const [createdBy, setCreatedBy] = useState("");

  const scopes = useMemo(() => selectedScopesToInputs(selected), [selected]);
  const linkedToNotice = !!noticeId.trim();

  const canOperate = params.perms.canManageAll || (!!createdBy && createdBy === params.currentUserId);
  const editableStructure = status === "draft" && params.perms.canUpdate && canOperate && !archivedAt;
  const canEdit = params.mode === "create" ? params.perms.canCreate : params.perms.canUpdate && canOperate;

  const formDisabled =
    loading ||
    action.pending ||
    !canEdit ||
    (params.mode === "edit" && !!effectiveMaterialId && loadedMaterialId !== effectiveMaterialId);

  const currentSnapshot = useMemo<DraftSnapshot>(
    () => ({
      title,
      descriptionMd,
      noticeId,
      visibleAll,
      scopes,
      maxFilesPerSubmission,
      dueAtLocal,
      items: normalizeItems(items),
    }),
    [descriptionMd, dueAtLocal, items, maxFilesPerSubmission, noticeId, scopes, title, visibleAll],
  );

  const [initialSnapshot, setInitialSnapshot] = useState<DraftSnapshot | null>(null);

  const dirty = useMemo(() => {
    if (!params.open) return false;
    if (!initialSnapshot) return false;
    return snapshotKey(currentSnapshot) !== snapshotKey(initialSnapshot);
  }, [currentSnapshot, initialSnapshot, params.open]);

  function resetCreate() {
    setLoadedMaterialId(null);
    setDetailError(null);
    setTitle("");
    setDescriptionMd("");
    const initialNoticeId = params.createNoticeId?.trim() ?? "";
    setNoticeId(initialNoticeId);
    setNoticeIdLocked(!!params.createNoticeIdLocked && !!initialNoticeId);
    setLinkedNotice(null);
    setVisibleAll(true);
    setSelected(createEmptySelectedScopes());
    setMaxFilesPerSubmission(10);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const dueLocal = toLocalInputValue(d);
    setDueAtLocal(dueLocal);
    const firstItemId = newId();
    setItems([{ id: firstItemId, title: "材料 1", description: null, required: true, sort: 0, template: null }]);
    setStatus("draft");
    setArchivedAt(null);
    setCreatedBy("");
    action.reset();
    setInitialSnapshot({
      title: "",
      descriptionMd: "",
      noticeId: initialNoticeId,
      visibleAll: true,
      scopes: [],
      maxFilesPerSubmission: 10,
      dueAtLocal: dueLocal,
      items: [{ id: firstItemId, title: "材料 1", description: null, required: true, sort: 0 }],
    });
  }

  function applyDetail(detail: ConsoleMaterialDetail) {
    setTitle(detail.title);
    setDescriptionMd(detail.descriptionMd ?? "");
    setNoticeId(detail.noticeId ?? "");
    setNoticeIdLocked(false);
    setLinkedNotice(detail.notice ?? null);
    setVisibleAll(!!detail.visibleAll);
    setSelected(selectedScopesFromInputs(detail.scopes));
    setMaxFilesPerSubmission(detail.maxFilesPerSubmission);
    setDueAtLocal(detail.dueAt ? toLocalInputValue(detail.dueAt) : "");
    setItems(detail.items);
    setStatus(detail.status);
    setArchivedAt(detail.archivedAt ?? null);
    setCreatedBy(detail.createdBy);
    setInitialSnapshot({
      title: detail.title,
      descriptionMd: detail.descriptionMd ?? "",
      noticeId: detail.noticeId ?? "",
      visibleAll: !!detail.visibleAll,
      scopes: detail.scopes,
      maxFilesPerSubmission: detail.maxFilesPerSubmission,
      dueAtLocal: detail.dueAt ? toLocalInputValue(detail.dueAt) : "",
      items: detail.items.map((it) => ({ id: it.id, title: it.title, description: it.description, required: it.required, sort: it.sort })),
    });
  }

  useEffect(() => {
    if (!params.open) return;
    if (params.mode !== "create") return;
    resetCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.open, params.mode, params.createNoticeId, params.createNoticeIdLocked]);

  useEffect(() => {
    if (!params.open) return;
    if (params.mode !== "edit") return;
    if (!effectiveMaterialId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setDetailError(null);
      try {
        const detail = await fetchConsoleMaterialDetail(effectiveMaterialId);
        if (cancelled) return;
        applyDetail(detail);
        setLoadedMaterialId(detail.id);
      } catch (err) {
        if (cancelled) return;
        setDetailError(getApiErrorMessage(err, "加载失败"));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveMaterialId, params.mode, params.open]);

  function buildMaterialItemsInput(): MaterialItemInput[] {
    return normalizeItems(items).filter((i) => i.title);
  }

  async function createDraft() {
    if (params.mode !== "create") return null;
    if (!params.perms.canCreate) return null;
    action.reset();
    try {
      if (!title.trim()) throw new Error("标题必填");

      const res = await action.run(
        () =>
          createConsoleMaterial({
            title,
            descriptionMd,
            noticeId: linkedToNotice ? noticeId.trim() : null,
            visibleAll: linkedToNotice ? true : visibleAll,
            scopes: linkedToNotice ? [] : scopes,
            maxFilesPerSubmission,
            dueAt: dueAtLocal ? toIso(dueAtLocal, "截止时间") : null,
            items: buildMaterialItemsInput(),
          }),
        { fallbackErrorMessage: "创建失败" },
      );
      if (!res) return null;
      return res.id;
    } catch (err) {
      action.setError(getApiErrorMessage(err, "创建失败"));
      return null;
    }
  }

  async function saveDraft() {
    if (!effectiveMaterialId) return null;
    if (!editableStructure) return null;
    action.reset();
    try {
      const res = await action.run(
        () =>
          updateConsoleMaterialDraft(effectiveMaterialId, {
            title,
            descriptionMd,
            noticeId: linkedToNotice ? noticeId.trim() : null,
            visibleAll: linkedToNotice ? true : visibleAll,
            scopes: linkedToNotice ? [] : scopes,
            maxFilesPerSubmission,
            dueAt: dueAtLocal ? toIso(dueAtLocal, "截止时间") : null,
            items: buildMaterialItemsInput(),
          }),
        { fallbackErrorMessage: "保存失败" },
      );
      if (!res) return null;
      applyDetail(res);
      setLoadedMaterialId(res.id);
      return res;
    } catch (err) {
      action.setError(getApiErrorMessage(err, "保存失败"));
      return null;
    }
  }

  async function publish() {
    if (!effectiveMaterialId) return null;
    const res = await action.run(() => publishConsoleMaterial(effectiveMaterialId), { fallbackErrorMessage: "发布失败" });
    if (!res) return null;
    applyDetail(res);
    setLoadedMaterialId(res.id);
    return res;
  }

  async function closeMaterial() {
    if (!effectiveMaterialId) return null;
    const res = await action.run(() => closeConsoleMaterial(effectiveMaterialId), { fallbackErrorMessage: "关闭失败" });
    if (!res) return null;
    applyDetail(res);
    setLoadedMaterialId(res.id);
    return res;
  }

  async function archive() {
    if (!effectiveMaterialId) return null;
    const res = await action.run(() => archiveConsoleMaterial(effectiveMaterialId), { fallbackErrorMessage: "归档失败" });
    if (!res) return null;
    applyDetail(res);
    setLoadedMaterialId(res.id);
    return res;
  }

  async function updateDueAtOnly() {
    if (!effectiveMaterialId) return null;
    action.reset();
    try {
      const iso = toIso(dueAtLocal, "截止时间");
      const res = await action.run(() => updateConsoleMaterialDueAt(effectiveMaterialId, iso), { fallbackErrorMessage: "更新截止时间失败" });
      if (!res) return null;
      applyDetail(res);
      setLoadedMaterialId(res.id);
      return res;
    } catch (err) {
      action.setError(getApiErrorMessage(err, "更新截止时间失败"));
      return null;
    }
  }

  async function submitDelete(reason?: string) {
    if (!effectiveMaterialId) return null;
    const res = await action.run(() => deleteConsoleMaterial(effectiveMaterialId, { reason }), { fallbackErrorMessage: "删除失败" });
    if (!res) return null;
    return res;
  }

  async function uploadTemplate(itemId: string, file: File) {
    if (!effectiveMaterialId) return null;
    const res = await action.run(() => uploadMaterialItemTemplate(effectiveMaterialId, itemId, file), { fallbackErrorMessage: "上传模板失败" });
    if (!res) return null;
    applyDetail(res);
    setLoadedMaterialId(res.id);
    return res;
  }

  function addItem() {
    setItems((prev) =>
      prev.concat({
        id: newId(),
        title: `材料 ${prev.length + 1}`,
        description: null,
        required: false,
        sort: prev.length,
        template: null,
      }),
    );
  }

  return {
    action,
    loading,
    detailError,
    effectiveMaterialId,

    title,
    setTitle,
    descriptionMd,
    setDescriptionMd,
    noticeId,
    setNoticeId,
    noticeIdLocked,
    linkedNotice,
    visibleAll,
    setVisibleAll,
    selected,
    setSelected,
    scopes,
    linkedToNotice,
    maxFilesPerSubmission,
    setMaxFilesPerSubmission,
    dueAtLocal,
    setDueAtLocal,
    items,
    setItems,

    status,
    archivedAt,
    canOperate,
    editableStructure,
    formDisabled,
    dirty,

    createDraft,
    saveDraft,
    publish,
    closeMaterial,
    archive,
    updateDueAtOnly,
    submitDelete,
    uploadTemplate,
    addItem,
  };
}
