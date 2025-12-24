"use client";

import { useEffect, useMemo, useState } from "react";

import type { ConsoleSurveyDetail } from "@/lib/api/console-surveys";
import {
  closeConsoleSurvey,
  createConsoleSurvey,
  deleteConsoleSurvey,
  fetchConsoleSurveyDetail,
  publishConsoleSurvey,
  updateConsoleSurveyDraft,
} from "@/lib/api/console-surveys";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import type { SurveySection, SurveyStatus } from "@/lib/api/surveys";
import { createEmptySelectedScopes, selectedScopesFromInputs, selectedScopesToInputs } from "@/lib/ui/visibilityScope";

type Mode = "create" | "edit";

export type ConsoleSurveyEditorPerms = {
  canCreate: boolean;
  canUpdate: boolean;
  canPublish: boolean;
  canClose: boolean;
  canDelete: boolean;
  canManageAll: boolean;
};

type DraftSnapshot = {
  title: string;
  descriptionMd: string;
  startAtLocal: string;
  endAtLocal: string;
  anonymousResponses: boolean;
  visibleAll: boolean;
  scopes: Array<{ scopeType: string; refId: string }>;
  sections: SurveySection[];
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

export function ensureChoiceOptions(section: SurveySection, questionId: string) {
  return section.questions.map((q) => {
    if (q.id !== questionId) return q;
    if (q.options && q.options.length >= 2) return q;
    return {
      ...q,
      options: [
        { id: newId(), label: "选项 1", sort: 0 },
        { id: newId(), label: "选项 2", sort: 1 },
      ],
    };
  });
}

export function normalizeSurveySections(sections: SurveySection[]) {
  return sections.map((s, si) => ({
    ...s,
    sort: si,
    questions: s.questions
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((q, qi) => ({
        ...q,
        sectionId: s.id,
        sort: qi,
        options: (q.options ?? [])
          .slice()
          .sort((a, b) => a.sort - b.sort)
          .map((o, oi) => ({ ...o, sort: oi })),
      })),
  }));
}

function normalizeSnapshot(snapshot: DraftSnapshot) {
  const scopes = snapshot.scopes
    .slice()
    .sort((a, b) => `${a.scopeType}:${a.refId}`.localeCompare(`${b.scopeType}:${b.refId}`));

  const sections = normalizeSurveySections(snapshot.sections).map((s) => ({
    ...s,
    questions: s.questions.map((q) => ({
      ...q,
      options: (q.options ?? []).slice().sort((a, b) => a.sort - b.sort),
    })),
  }));

  return {
    title: snapshot.title,
    descriptionMd: snapshot.descriptionMd,
    startAtLocal: snapshot.startAtLocal,
    endAtLocal: snapshot.endAtLocal,
    anonymousResponses: snapshot.anonymousResponses,
    visibleAll: snapshot.visibleAll,
    scopes,
    sections,
  };
}

function snapshotKey(snapshot: DraftSnapshot) {
  return JSON.stringify(normalizeSnapshot(snapshot));
}

export function useConsoleSurveyEditor(params: {
  open: boolean;
  mode: Mode;
  surveyId?: string;
  currentUserId: string;
  perms: ConsoleSurveyEditorPerms;
}) {
  const action = useAsyncAction();

  const effectiveSurveyId = params.mode === "edit" ? params.surveyId ?? null : null;

  const [loading, setLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadedSurveyId, setLoadedSurveyId] = useState<string | null>(null);

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
  const [sections, setSections] = useState<SurveySection[]>([]);

  const [status, setStatus] = useState<SurveyStatus>("draft");
  const [effectiveStatus, setEffectiveStatus] = useState<SurveyStatus>("draft");
  const [createdBy, setCreatedBy] = useState("");

  const scopes = useMemo(() => selectedScopesToInputs(selected), [selected]);

  const canOperate = params.perms.canManageAll || (!!createdBy && createdBy === params.currentUserId);
  const editableStructure = status === "draft" && params.perms.canUpdate && canOperate;
  const canEdit = params.mode === "create" ? params.perms.canCreate : params.perms.canUpdate && canOperate;

  const formDisabled =
    loading ||
    action.pending ||
    !canEdit ||
    (params.mode === "edit" && !!effectiveSurveyId && loadedSurveyId !== effectiveSurveyId);

  const currentSnapshot = useMemo<DraftSnapshot>(
    () => ({
      title,
      descriptionMd,
      startAtLocal,
      endAtLocal,
      anonymousResponses,
      visibleAll,
      scopes,
      sections,
    }),
    [anonymousResponses, descriptionMd, endAtLocal, scopes, sections, startAtLocal, title, visibleAll],
  );

  const [initialSnapshot, setInitialSnapshot] = useState<DraftSnapshot | null>(null);

  const dirty = useMemo(() => {
    if (!params.open) return false;
    if (!initialSnapshot) return false;
    return snapshotKey(currentSnapshot) !== snapshotKey(initialSnapshot);
  }, [currentSnapshot, initialSnapshot, params.open]);

  function resetCreate() {
    setLoadedSurveyId(null);
    setDetailError(null);
    setTitle("");
    setDescriptionMd("");
    const startLocal = toLocalInputValue(new Date());
    setStartAtLocal(startLocal);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const endLocal = toLocalInputValue(d);
    setEndAtLocal(endLocal);
    setAnonymousResponses(false);
    setVisibleAll(true);
    setSelected(createEmptySelectedScopes());
    setSections([]);
    setStatus("draft");
    setEffectiveStatus("draft");
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
      sections: [],
    });
  }

  function applyDetail(detail: ConsoleSurveyDetail) {
    setTitle(detail.title);
    setDescriptionMd(detail.descriptionMd ?? "");
    setStartAtLocal(toLocalInputValue(detail.startAt));
    setEndAtLocal(toLocalInputValue(detail.endAt));
    setAnonymousResponses(detail.anonymousResponses);
    setVisibleAll(detail.visibleAll);
    setStatus(detail.status);
    setEffectiveStatus(detail.effectiveStatus);
    setCreatedBy(detail.createdBy);
    setSections(normalizeSurveySections(detail.sections));
    setSelected(selectedScopesFromInputs(detail.scopes));
    setInitialSnapshot({
      title: detail.title,
      descriptionMd: detail.descriptionMd ?? "",
      startAtLocal: toLocalInputValue(detail.startAt),
      endAtLocal: toLocalInputValue(detail.endAt),
      anonymousResponses: detail.anonymousResponses,
      visibleAll: detail.visibleAll,
      scopes: detail.scopes,
      sections: detail.sections,
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
    if (!effectiveSurveyId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setDetailError(null);
      try {
        const detail = await fetchConsoleSurveyDetail(effectiveSurveyId);
        if (cancelled) return;
        applyDetail(detail);
        setLoadedSurveyId(detail.id);
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
  }, [effectiveSurveyId, params.mode, params.open]);

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
          createConsoleSurvey({
            title: title.trim(),
            descriptionMd,
            startAt: toIso(startAtLocal, "开始时间"),
            endAt: toIso(endAtLocal, "结束时间"),
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
    if (!effectiveSurveyId) return null;
    if (!editableStructure) return null;
    action.reset();
    try {
      const res = await action.run(
        () =>
          updateConsoleSurveyDraft(effectiveSurveyId, {
            title,
            descriptionMd,
            startAt: toIso(startAtLocal, "开始时间"),
            endAt: toIso(endAtLocal, "结束时间"),
            anonymousResponses,
            visibleAll,
            scopes,
            sections: normalizeSurveySections(sections),
          }),
        { fallbackErrorMessage: "保存失败" },
      );
      if (!res) return null;
      applyDetail(res);
      setLoadedSurveyId(res.id);
      return res;
    } catch (err) {
      action.setError(getApiErrorMessage(err, "保存失败"));
      return null;
    }
  }

  async function publish() {
    if (!effectiveSurveyId) return null;
    const res = await action.run(() => publishConsoleSurvey(effectiveSurveyId), { fallbackErrorMessage: "发布失败" });
    if (!res) return null;
    applyDetail(res);
    setLoadedSurveyId(res.id);
    return res;
  }

  async function closeSurvey() {
    if (!effectiveSurveyId) return null;
    const res = await action.run(() => closeConsoleSurvey(effectiveSurveyId), { fallbackErrorMessage: "关闭失败" });
    if (!res) return null;
    applyDetail(res);
    setLoadedSurveyId(res.id);
    return res;
  }

  async function deleteSurvey() {
    if (!effectiveSurveyId) return null;
    const res = await action.run(() => deleteConsoleSurvey(effectiveSurveyId), { fallbackErrorMessage: "删除失败" });
    if (!res) return null;
    return res;
  }

  function addSection() {
    setSections((prev) =>
      normalizeSurveySections(
        prev.concat({
          id: newId(),
          title: `分节 ${prev.length + 1}`,
          sort: prev.length,
          questions: [],
        }),
      ),
    );
  }

  function addQuestion(sectionId: string) {
    setSections((prev) =>
      normalizeSurveySections(
        prev.map((s) =>
          s.id !== sectionId
            ? s
            : {
                ...s,
                questions: s.questions.concat({
                  id: newId(),
                  sectionId: s.id,
                  questionType: "text",
                  title: `问题 ${s.questions.length + 1}`,
                  description: null,
                  required: false,
                  sort: s.questions.length,
                  options: [],
                }),
              },
        ),
      ),
    );
  }

  return {
    action,
    loading,
    detailError,
    loadedSurveyId,
    effectiveSurveyId,

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
    sections,
    setSections,

    status,
    effectiveStatus,
    createdBy,
    canOperate,
    editableStructure,
    formDisabled,
    dirty,

    createDraft,
    saveDraft,
    publish,
    closeSurvey,
    deleteSurvey,
    addSection,
    addQuestion,
  };
}

