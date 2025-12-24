"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PortalSurveyDetail, SurveyAnswerValue } from "@/lib/api/surveys";
import { fetchPortalSurveyDetail, submitSurveyResponse } from "@/lib/api/surveys";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

function buildInitialAnswerMap(items: Array<{ questionId: string; value: SurveyAnswerValue }>) {
  const map = new Map<string, SurveyAnswerValue>();
  for (const item of items) map.set(item.questionId, item.value);
  return map;
}

function normalizeAnswerValue(value: SurveyAnswerValue) {
  if ("text" in value) return { text: value.text };
  if ("optionId" in value) return { optionId: value.optionId };
  if ("optionIds" in value) return { optionIds: value.optionIds.slice().sort() };
  return { value: value.value };
}

function answersKey(answers: Map<string, SurveyAnswerValue>) {
  return JSON.stringify(
    [...answers.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([questionId, value]) => ({ questionId, value: normalizeAnswerValue(value) })),
  );
}

function pickText(v: SurveyAnswerValue | undefined) {
  return v && "text" in v ? v.text : "";
}

function pickSingle(v: SurveyAnswerValue | undefined) {
  return v && "optionId" in v ? v.optionId : null;
}

function pickMulti(v: SurveyAnswerValue | undefined) {
  return v && "optionIds" in v ? v.optionIds : [];
}

function pickRating(v: SurveyAnswerValue | undefined) {
  return v && "value" in v ? v.value : null;
}

export function usePortalSurveyFill(params: { open: boolean; surveyId?: string | null }) {
  const surveyId = params.surveyId?.trim() ?? "";
  const loader = useAsyncAction({ fallbackErrorMessage: "加载失败" });
  const action = useAsyncAction();
  const { run: loadRun } = loader;
  const { reset: actionReset, run: actionRun, setError: actionSetError } = action;

  const [detail, setDetail] = useState<PortalSurveyDetail | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Map<string, SurveyAnswerValue>>(() => new Map());
  const [initialKey, setInitialKey] = useState<string>("");

  useEffect(() => {
    if (!params.open) return;
    if (!surveyId) return;

    let cancelled = false;
    void (async () => {
      actionReset();
      setDetail(null);
      setSubmittedAt(null);
      setAnswers(new Map());
      setInitialKey("");

      const next = await loadRun(() => fetchPortalSurveyDetail(surveyId));
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
  }, [actionReset, loadRun, params.open, surveyId]);

  const readOnly = !detail?.canSubmit;
  const currentKey = useMemo(() => answersKey(answers), [answers]);
  const dirty = !!params.open && !!detail && !readOnly && !!initialKey && currentKey !== initialKey;

  const setAnswer = useCallback((questionId: string, value: SurveyAnswerValue | null) => {
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

    const questions = detail.sections.flatMap((s) => s.questions);
    for (const q of questions) {
      if (!q.required) continue;
      const v = answers.get(q.id);
      if (!v) {
        actionSetError("存在必填题未填写，请检查后再提交。");
        return false;
      }

      if (q.questionType === "text" && pickText(v).trim() === "") {
        actionSetError("存在必填题未填写，请检查后再提交。");
        return false;
      }
      if (q.questionType === "single" && !pickSingle(v)) {
        actionSetError("存在必填题未填写，请检查后再提交。");
        return false;
      }
      if (q.questionType === "multi" && pickMulti(v).length === 0) {
        actionSetError("存在必填题未填写，请检查后再提交。");
        return false;
      }
      if (q.questionType === "rating" && pickRating(v) == null) {
        actionSetError("存在必填题未填写，请检查后再提交。");
        return false;
      }
    }

    const items = [...answers.entries()].map(([questionId, value]) => ({ questionId, value }));
    const res = await actionRun(() => submitSurveyResponse(detail.id, { items }), { fallbackErrorMessage: "提交失败" });
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

