"use client";

import { useEffect, useMemo, useState } from "react";

import type { ConsoleVoteDetail } from "@/lib/api/console-votes";
import {
  archiveConsoleVote,
  closeConsoleVote,
  createConsoleVote,
  extendConsoleVote,
  fetchConsoleVoteDetail,
  pinConsoleVote,
  publishConsoleVote,
  updateConsoleVoteDraft,
} from "@/lib/api/console-votes";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import type { VoteQuestion, VoteScopeInput, VoteStatus } from "@/lib/api/votes";
import { createEmptySelectedScopes, selectedScopesFromInputs, selectedScopesToInputs } from "@/lib/ui/visibilityScope";

type Mode = "create" | "edit";

export type ConsoleVoteEditorPerms = {
  canCreate: boolean;
  canUpdate: boolean;
  canPublish: boolean;
  canClose: boolean;
  canExtend: boolean;
  canPin: boolean;
  canArchive: boolean;
  canManageAll: boolean;
};

type DraftSnapshot = {
  title: string;
  descriptionMd: string;
  startAtLocal: string;
  endAtLocal: string;
  anonymousResponses: boolean;
  visibleAll: boolean;
  scopes: VoteScopeInput[];
  questions: VoteQuestion[];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(value: string | Date) {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toIso(local: string, name: string) {
  if (!local) throw new Error(`${name} 必填`);
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} 格式无效`);
  return date.toISOString();
}

function newId() {
  return crypto.randomUUID();
}

export function normalizeVoteQuestions(questions: VoteQuestion[]) {
  return questions
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((q, qi) => ({
      ...q,
      sort: qi,
      maxChoices: q.questionType === "single" ? 1 : q.maxChoices,
      options: q.options
        .slice()
        .sort((a, b) => a.sort - b.sort)
        .map((o, oi) => ({ ...o, sort: oi })),
    }));
}

function normalizeSnapshot(snapshot: DraftSnapshot) {
  const scopes = snapshot.scopes
    .slice()
    .sort((a, b) => `${a.scopeType}:${a.refId}`.localeCompare(`${b.scopeType}:${b.refId}`));

  const questions = normalizeVoteQuestions(snapshot.questions).map((q) => ({
    ...q,
    options: q.options.slice().sort((a, b) => a.sort - b.sort),
  }));

  return {
    title: snapshot.title,
    descriptionMd: snapshot.descriptionMd,
    startAtLocal: snapshot.startAtLocal,
    endAtLocal: snapshot.endAtLocal,
    anonymousResponses: snapshot.anonymousResponses,
    visibleAll: snapshot.visibleAll,
    scopes,
    questions,
  };
}

function snapshotKey(snapshot: DraftSnapshot) {
  return JSON.stringify(normalizeSnapshot(snapshot));
}

export function useConsoleVoteEditor(params: {
  open: boolean;
  mode: Mode;
  voteId?: string;
  currentUserId: string;
  perms: ConsoleVoteEditorPerms;
}) {
  const action = useAsyncAction();

  const effectiveVoteId = params.mode === "edit" ? params.voteId ?? null : null;

  const [loading, setLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadedVoteId, setLoadedVoteId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [startAtLocal, setStartAtLocal] = useState(() => toLocalInputValue(new Date()));
  const [endAtLocal, setEndAtLocal] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalInputValue(d);
  });
  const [anonymousResponses, setAnonymousResponses] = useState(false);
  const [visibleAll, setVisibleAll] = useState(true);
  const [selected, setSelected] = useState(createEmptySelectedScopes);
  const [questions, setQuestions] = useState<VoteQuestion[]>([]);

  const [status, setStatus] = useState<VoteStatus>("draft");
  const [effectiveStatus, setEffectiveStatus] = useState<VoteStatus>("draft");
  const [pinned, setPinned] = useState(false);
  const [archivedAt, setArchivedAt] = useState<string | null>(null);
  const [createdBy, setCreatedBy] = useState("");

  const [extendEndAtLocal, setExtendEndAtLocal] = useState("");

  const scopes = useMemo(() => selectedScopesToInputs(selected), [selected]);

  const canOperate = params.perms.canManageAll || (!!createdBy && createdBy === params.currentUserId);
  const editableStructure = status === "draft" && params.perms.canUpdate && canOperate && !archivedAt;
  const canEdit = params.mode === "create" ? params.perms.canCreate : params.perms.canUpdate && canOperate;

  const formDisabled =
    loading ||
    action.pending ||
    !canEdit ||
    (params.mode === "edit" && !!effectiveVoteId && loadedVoteId !== effectiveVoteId);

  const currentSnapshot = useMemo<DraftSnapshot>(
    () => ({
      title,
      descriptionMd,
      startAtLocal,
      endAtLocal,
      anonymousResponses,
      visibleAll,
      scopes,
      questions,
    }),
    [anonymousResponses, descriptionMd, endAtLocal, questions, scopes, startAtLocal, title, visibleAll],
  );

  const [initialSnapshot, setInitialSnapshot] = useState<DraftSnapshot | null>(null);

  const dirty = useMemo(() => {
    if (!params.open) return false;
    if (!initialSnapshot) return false;
    return snapshotKey(currentSnapshot) !== snapshotKey(initialSnapshot);
  }, [currentSnapshot, initialSnapshot, params.open]);

  function resetCreate() {
    setLoadedVoteId(null);
    setDetailError(null);
    setTitle("");
    setDescriptionMd("");
    const startLocal = toLocalInputValue(new Date());
    setStartAtLocal(startLocal);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const endLocal = toLocalInputValue(d);
    setEndAtLocal(endLocal);
    setExtendEndAtLocal(endLocal);
    setAnonymousResponses(false);
    setVisibleAll(true);
    setSelected(createEmptySelectedScopes());
    setQuestions([]);
    setStatus("draft");
    setEffectiveStatus("draft");
    setPinned(false);
    setArchivedAt(null);
    setCreatedBy("");
    action.reset();
    setInitialSnapshot({
      title: "",
      descriptionMd: "",
      startAtLocal: startLocal,
      endAtLocal: endLocal,
      anonymousResponses: false,
      visibleAll: true,
      scopes: [],
      questions: [],
    });
  }

  function applyDetail(detail: ConsoleVoteDetail) {
    setTitle(detail.title);
    setDescriptionMd(detail.descriptionMd ?? "");
    setStartAtLocal(toLocalInputValue(detail.startAt));
    setEndAtLocal(toLocalInputValue(detail.endAt));
    setExtendEndAtLocal(toLocalInputValue(detail.endAt));
    setAnonymousResponses(detail.anonymousResponses);
    setVisibleAll(detail.visibleAll);
    setStatus(detail.status);
    setEffectiveStatus(detail.effectiveStatus);
    setPinned(detail.pinned);
    setArchivedAt(detail.archivedAt);
    setCreatedBy(detail.createdBy);
    setQuestions(normalizeVoteQuestions(detail.questions));
    setSelected(selectedScopesFromInputs(detail.scopes));
    setInitialSnapshot({
      title: detail.title,
      descriptionMd: detail.descriptionMd ?? "",
      startAtLocal: toLocalInputValue(detail.startAt),
      endAtLocal: toLocalInputValue(detail.endAt),
      anonymousResponses: detail.anonymousResponses,
      visibleAll: detail.visibleAll,
      scopes: detail.scopes,
      questions: detail.questions,
    });
  }

  useEffect(() => {
    if (!params.open) return;
    if (params.mode !== "create") return;
    resetCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.open, params.mode]);

  useEffect(() => {
    if (!params.open) return;
    if (params.mode !== "edit") return;
    if (!effectiveVoteId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setDetailError(null);
      try {
        const detail = await fetchConsoleVoteDetail(effectiveVoteId);
        if (cancelled) return;
        applyDetail(detail);
        setLoadedVoteId(detail.id);
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
  }, [effectiveVoteId, params.mode, params.open]);

  function canSaveDraft() {
    if (!editableStructure) return false;
    if (!title.trim()) return false;
    if (!startAtLocal || !endAtLocal) return false;
    if (!visibleAll && scopes.length === 0) return false;
    if (questions.length === 0) return false;
    for (const q of questions) {
      if (!q.title.trim()) return false;
      if (q.options.length < 2) return false;
      if (q.questionType === "multi") {
        if (!Number.isFinite(q.maxChoices) || q.maxChoices < 1 || q.maxChoices > q.options.length) return false;
      }
      for (const opt of q.options) {
        if (!opt.label.trim()) return false;
      }
    }
    return true;
  }

  async function createDraft() {
    if (params.mode !== "create") return null;
    if (!params.perms.canCreate) return null;
    action.reset();
    try {
      if (!title.trim()) throw new Error("标题必填");
      if (!startAtLocal || !endAtLocal) throw new Error("开始/结束时间必填");
      if (!visibleAll && scopes.length === 0) throw new Error("请选择可见范围");

      const res = await action.run(
        () =>
          createConsoleVote({
            title: title.trim(),
            descriptionMd,
            startAt: toIso(startAtLocal, "startAt"),
            endAt: toIso(endAtLocal, "endAt"),
            anonymousResponses,
            visibleAll,
            scopes,
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
    if (!effectiveVoteId) return null;
    if (!editableStructure) return null;
    action.reset();
    try {
      const res = await action.run(
        () =>
          updateConsoleVoteDraft(effectiveVoteId, {
            title: title.trim(),
            descriptionMd,
            startAt: toIso(startAtLocal, "startAt"),
            endAt: toIso(endAtLocal, "endAt"),
            anonymousResponses,
            visibleAll,
            scopes,
            questions: normalizeVoteQuestions(questions).map((q) => ({
              id: q.id,
              questionType: q.questionType,
              title: q.title,
              description: q.description ?? null,
              required: q.required,
              sort: q.sort,
              maxChoices: q.questionType === "single" ? 1 : q.maxChoices,
              options: q.options.map((o) => ({ id: o.id, label: o.label, sort: o.sort })),
            })),
          }),
        { fallbackErrorMessage: "保存失败" },
      );
      if (!res) return null;
      applyDetail(res);
      setLoadedVoteId(res.id);
      return res;
    } catch (err) {
      action.setError(getApiErrorMessage(err, "保存失败"));
      return null;
    }
  }

  async function publish() {
    if (!effectiveVoteId) return null;
    const res = await action.run(() => publishConsoleVote(effectiveVoteId), { fallbackErrorMessage: "发布失败" });
    if (!res) return null;
    applyDetail(res);
    setLoadedVoteId(res.id);
    return res;
  }

  async function closeVote() {
    if (!effectiveVoteId) return null;
    const res = await action.run(() => closeConsoleVote(effectiveVoteId), { fallbackErrorMessage: "关闭失败" });
    if (!res) return null;
    applyDetail(res);
    setLoadedVoteId(res.id);
    return res;
  }

  async function extend() {
    if (!effectiveVoteId) return null;
    action.reset();
    try {
      const endAt = toIso(extendEndAtLocal, "endAt");
      const res = await action.run(() => extendConsoleVote(effectiveVoteId, { endAt }), { fallbackErrorMessage: "延期失败" });
      if (!res) return null;
      applyDetail(res);
      setLoadedVoteId(res.id);
      return res;
    } catch (err) {
      action.setError(getApiErrorMessage(err, "延期失败"));
      return null;
    }
  }

  async function pin(nextPinned: boolean) {
    if (!effectiveVoteId) return null;
    const res = await action.run(() => pinConsoleVote(effectiveVoteId, { pinned: nextPinned }), { fallbackErrorMessage: "置顶失败" });
    if (!res) return null;
    applyDetail(res);
    setLoadedVoteId(res.id);
    return res;
  }

  async function archive() {
    if (!effectiveVoteId) return null;
    const res = await action.run(() => archiveConsoleVote(effectiveVoteId), { fallbackErrorMessage: "归档失败" });
    if (!res) return null;
    applyDetail(res);
    setLoadedVoteId(res.id);
    return res;
  }

  function addQuestion() {
    setQuestions((prev) =>
      prev.concat({
        id: newId(),
        questionType: "single",
        title: `题目 ${prev.length + 1}`,
        description: null,
        required: false,
        sort: prev.length,
        maxChoices: 1,
        options: [
          { id: newId(), label: "选项 1", sort: 0 },
          { id: newId(), label: "选项 2", sort: 1 },
        ],
      }),
    );
  }

  return {
    action,
    loading,
    detailError,
    loadedVoteId,
    effectiveVoteId,

    title,
    setTitle,
    descriptionMd,
    setDescriptionMd,
    startAtLocal,
    setStartAtLocal,
    endAtLocal,
    setEndAtLocal,
    anonymousResponses,
    setAnonymousResponses,
    visibleAll,
    setVisibleAll,
    selected,
    setSelected,
    scopes,
    questions,
    setQuestions,

    status,
    effectiveStatus,
    pinned,
    archivedAt,
    createdBy,
    canOperate,
    editableStructure,
    formDisabled,
    dirty,

    extendEndAtLocal,
    setExtendEndAtLocal,

    canSaveDraft,
    createDraft,
    saveDraft,
    publish,
    closeVote,
    extend,
    pin,
    archive,

    addQuestion,
  };
}
