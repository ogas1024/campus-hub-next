"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PortalMaterialDetail } from "@/lib/api/materials";
import {
  deleteMyMaterialFile,
  fetchPortalMaterialDetail,
  submitMyMaterial,
  uploadMyMaterialFile,
  withdrawMyMaterial,
} from "@/lib/api/materials";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

function computeMissingRequiredItemIds(detail: PortalMaterialDetail) {
  const provided = new Set((detail.mySubmission?.files ?? []).map((f) => f.itemId));
  return detail.items.filter((i) => i.required && !provided.has(i.id)).map((i) => i.id);
}

export function usePortalMaterialSubmit(params: { open: boolean; materialId?: string | null }) {
  const materialId = params.materialId?.trim() ?? "";
  const loader = useAsyncAction({ fallbackErrorMessage: "加载失败" });
  const action = useAsyncAction();
  const { run: loadRun } = loader;
  const { reset: actionReset, run: actionRun, setError: actionSetError } = action;

  const [detail, setDetail] = useState<PortalMaterialDetail | null>(null);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const [missingItemIds, setMissingItemIds] = useState<Set<string>>(() => new Set());

  const readOnly = !detail?.canSubmit;
  const my = detail?.mySubmission ?? null;
  const files = useMemo(() => my?.files ?? [], [my?.files]);
  const fileCount = files.length;
  const maxFiles = detail?.maxFilesPerSubmission ?? 0;
  const remainingSlots = Math.max(0, maxFiles - fileCount);

  const refresh = useCallback(async () => {
    if (!materialId) return null;
    const next = await loadRun(() => fetchPortalMaterialDetail(materialId));
    if (!next) return null;
    setDetail(next);
    setMissingItemIds((prev) => (prev.size > 0 ? new Set(computeMissingRequiredItemIds(next)) : prev));
    return next;
  }, [loadRun, materialId]);

  useEffect(() => {
    if (!params.open) return;
    if (!materialId) return;
    let cancelled = false;
    void (async () => {
      const next = await loadRun(() => fetchPortalMaterialDetail(materialId));
      if (cancelled) return;
      if (!next) return;
      setDetail(next);
      setUploadHint(null);
      setMissingItemIds(new Set());
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRun, materialId, params.open]);

  const upload = useCallback(
    async (itemId: string, list: FileList | null) => {
      if (!detail) return false;
      if (!list || list.length === 0) return false;
      if (!materialId) return false;

      actionReset();
      setUploadHint(null);

      if (remainingSlots <= 0) {
        actionSetError(`最多上传 ${detail.maxFilesPerSubmission} 个文件`);
        return false;
      }

      const selectedFiles = Array.from(list);
      const toUpload = selectedFiles.slice(0, remainingSlots);
      if (selectedFiles.length > remainingSlots) {
        setUploadHint(`本次仅会上传前 ${remainingSlots} 个文件，已忽略 ${selectedFiles.length - remainingSlots} 个。`);
      }

      for (const file of toUpload) {
        const res = await actionRun(() => uploadMyMaterialFile(materialId, itemId, file), { fallbackErrorMessage: "上传失败" });
        if (!res) break;
      }

      await refresh();
      return true;
    },
    [actionReset, actionRun, actionSetError, detail, materialId, refresh, remainingSlots],
  );

  const deleteFile = useCallback(
    async (fileId: string) => {
      if (!materialId) return false;
      const res = await actionRun(() => deleteMyMaterialFile(materialId, fileId), { fallbackErrorMessage: "删除失败" });
      if (!res) return false;
      await refresh();
      return true;
    },
    [actionRun, materialId, refresh],
  );

  const submit = useCallback(async () => {
    if (!detail) return false;
    if (!materialId) return false;
    setUploadHint(null);

    const missing = computeMissingRequiredItemIds(detail);
    if (missing.length > 0) {
      setMissingItemIds(new Set(missing));
      actionSetError("缺少必交材料，请先上传标星项。");
      const first = missing[0];
      const el = first ? document.getElementById(`material-item-${first}`) : null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }

    setMissingItemIds(new Set());
    const res = await actionRun(() => submitMyMaterial(materialId), { fallbackErrorMessage: "提交失败" });
    if (!res) return false;
    await refresh();
    return true;
  }, [actionRun, actionSetError, detail, materialId, refresh]);

  const withdraw = useCallback(async () => {
    if (!materialId) return false;
    const res = await actionRun(() => withdrawMyMaterial(materialId), { fallbackErrorMessage: "撤回失败" });
    if (!res) return false;
    setMissingItemIds(new Set());
    await refresh();
    return true;
  }, [actionRun, materialId, refresh]);

  return {
    detail,
    loading: loader.pending,
    pending: loader.pending || action.pending,
    error: action.error ?? loader.error ?? null,
    readOnly,
    missingItemIds,
    uploadHint,
    fileCount,
    remainingSlots,
    refresh,
    upload,
    deleteFile,
    submit,
    withdraw,
  };
}
