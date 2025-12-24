"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PortalVoteDetail, VoteAnswerValue } from "@/lib/api/votes";
import { fetchPortalVoteDetail, submitVoteResponse } from "@/lib/api/votes";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

function buildInitialAnswerMap(items: Array<{ questionId: string; value: VoteAnswerValue }>) {
  const map = new Map<string, VoteAnswerValue>();
  for (const item of items) map.set(item.questionId, item.value);
  return map;
}

function normalizeAnswerValue(value: VoteAnswerValue) {
  if ("optionId" in value) return { optionId: value.optionId };
  return { optionIds: value.optionIds.slice().sort() };
}

function answersKey(answers: Map<string, VoteAnswerValue>) {
  return JSON.stringify(
    [...answers.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([questionId, value]) => ({ questionId, value: normalizeAnswerValue(value) })),
  );
}

export function usePortalVoteFill(params: { open: boolean; voteId?: string | null }) {
  const voteId = params.voteId?.trim() ?? "";
  const loader = useAsyncAction({ fallbackErrorMessage: "加载失败" });
  const action = useAsyncAction();
  const { run: loadRun } = loader;
  const { reset: actionReset, run: actionRun, setError: actionSetError } = action;

  const [detail, setDetail] = useState<PortalVoteDetail | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Map<string, VoteAnswerValue>>(() => new Map());
  const [initialKey, setInitialKey] = useState<string>("");

  useEffect(() => {
    if (!params.open) return;
    if (!voteId) return;

    let cancelled = false;
    void (async () => {
      actionReset();
      setDetail(null);
      setSubmittedAt(null);
      setAnswers(new Map());
      setInitialKey("");

      const next = await loadRun(() => fetchPortalVoteDetail(voteId));
      if (cancelled) return;
      if (!next) return;

      const map = buildInitialAnswerMap(next.myResponse?.items ?? []);
      setDetail(next);
      setSubmittedAt(next.myResponse?.submittedAt ?? null);
      setAnswers(map);
      setInitialKey(answersKey(map));
    })();

    return () => {
      cancelled = true;
    };
  }, [actionReset, loadRun, params.open, voteId]);

  const readOnly = !detail?.canSubmit;
  const currentKey = useMemo(() => answersKey(answers), [answers]);
  const dirty = !!params.open && !!detail && !readOnly && !!initialKey && currentKey !== initialKey;

  const setAnswer = useCallback((questionId: string, value: VoteAnswerValue | null) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      if (value) next.set(questionId, value);
      else next.delete(questionId);
      return next;
    });
  }, []);

  const submit = useCallback(async () => {
    if (!detail) return false;
    if (!detail.canSubmit) return false;

    for (const q of detail.questions) {
      if (!q.required) continue;
      const v = answers.get(q.id);
      if (!v) {
        actionSetError("存在必答题未填写，请检查后再提交。");
        return false;
      }
      if (q.questionType === "single" && ("optionId" in v ? !v.optionId : false)) {
        actionSetError("存在必答题未填写，请检查后再提交。");
        return false;
      }
      if (q.questionType === "multi") {
        const ids = "optionIds" in v ? v.optionIds : [];
        if (ids.length === 0) {
          actionSetError("存在必答题未填写，请检查后再提交。");
          return false;
        }
        if (ids.length > q.maxChoices) {
          actionSetError("存在多选题超过可选上限，请调整后再提交。");
          return false;
        }
      }
    }

    const items = [...answers.entries()].map(([questionId, value]) => ({ questionId, value }));
    const res = await actionRun(() => submitVoteResponse(detail.id, { items }), { fallbackErrorMessage: "提交失败" });
    if (!res) return false;

    setSubmittedAt(res.submittedAt);
    setInitialKey(answersKey(answers));
    return true;
  }, [actionRun, actionSetError, answers, detail]);

  return {
    detail,
    loading: loader.pending,
    pending: loader.pending || action.pending,
    error: action.error ?? loader.error ?? null,
    readOnly,
    dirty,
    submittedAt,
    answers,
    setAnswer,
    setError: actionSetError,
    submit,
  };
}

