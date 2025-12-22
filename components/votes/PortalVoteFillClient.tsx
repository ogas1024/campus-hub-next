"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { submitVoteResponse, type VoteAnswerValue, type VoteQuestion } from "@/lib/api/votes";

type Props = {
  voteId: string;
  canSubmit: boolean;
  questions: VoteQuestion[];
  initialItems: Array<{ questionId: string; value: VoteAnswerValue }>;
  initialSubmittedAt: string | null;
};

function buildInitialAnswerMap(items: Array<{ questionId: string; value: VoteAnswerValue }>) {
  const map = new Map<string, VoteAnswerValue>();
  for (const item of items) map.set(item.questionId, item.value);
  return map;
}

export function PortalVoteFillClient(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const [submittedAt, setSubmittedAt] = useState<string | null>(props.initialSubmittedAt);
  const [answers, setAnswers] = useState(() => buildInitialAnswerMap(props.initialItems));

  const allQuestions = useMemo(() => props.questions.slice().sort((a, b) => a.sort - b.sort), [props.questions]);
  const readOnly = !props.canSubmit;

  function setAnswer(questionId: string, value: VoteAnswerValue | null) {
    setAnswers((prev) => {
      const next = new Map(prev);
      if (value) next.set(questionId, value);
      else next.delete(questionId);
      return next;
    });
  }

  function pickSingle(v: VoteAnswerValue | undefined) {
    return v && "optionId" in v ? v.optionId : null;
  }

  function pickMulti(v: VoteAnswerValue | undefined) {
    return v && "optionIds" in v ? v.optionIds : [];
  }

  function validateRequired() {
    for (const q of allQuestions) {
      if (!q.required) continue;
      const v = answers.get(q.id);
      if (!v) return { ok: false as const, message: "存在必答题未填写，请检查后再提交。", questionId: q.id };

      if (q.questionType === "single" && !pickSingle(v)) {
        return { ok: false as const, message: "存在必答题未填写，请检查后再提交。", questionId: q.id };
      }
      if (q.questionType === "multi") {
        const ids = pickMulti(v);
        if (ids.length === 0) return { ok: false as const, message: "存在必答题未填写，请检查后再提交。", questionId: q.id };
        if (ids.length > q.maxChoices) return { ok: false as const, message: "存在多选题超过可选上限，请调整后再提交。", questionId: q.id };
      }
    }
    return { ok: true as const };
  }

  async function doSubmit() {
    const validated = validateRequired();
    if (!validated.ok) {
      action.setError(validated.message);
      return;
    }

    const items = [...answers.entries()].map(([questionId, value]) => ({ questionId, value }));
    const res = await action.run(() => submitVoteResponse(props.voteId, { items }), { fallbackErrorMessage: "提交失败" });
    if (!res) return;
    setSubmittedAt(res.submittedAt);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {submittedAt ? <Badge variant="outline">已提交：{new Date(submittedAt).toLocaleString("zh-CN")}</Badge> : <Badge variant="secondary">未提交</Badge>}
        {readOnly ? <Badge variant="secondary">只读</Badge> : <Badge>可提交</Badge>}
      </div>

      {action.error ? <InlineError message={action.error} /> : null}

      <div className="space-y-3">
        {allQuestions.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无题目</CardContent>
          </Card>
        ) : null}

        {allQuestions.map((q) => {
          const v = answers.get(q.id);
          const selectedMulti = pickMulti(v);
          const selectedCount = q.questionType === "multi" ? selectedMulti.length : 0;
          const maxReached = q.questionType === "multi" ? selectedCount >= q.maxChoices : false;

          return (
            <Card key={q.id}>
              <CardContent className="space-y-3 p-6">
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    {q.title}
                    {q.required ? <span className="ml-1 text-destructive">*</span> : null}
                  </div>
                  {q.description?.trim() ? <div className="text-sm text-muted-foreground">{q.description}</div> : null}
                  <div className="text-xs text-muted-foreground">
                    {q.questionType === "single" ? "单选" : `多选（最多 ${q.maxChoices}）`}
                    {q.questionType === "multi" ? ` · 已选 ${selectedCount}/${q.maxChoices}` : ""}
                  </div>
                </div>

                <div className="space-y-2">
                  {q.options
                    .slice()
                    .sort((a, b) => a.sort - b.sort)
                    .map((opt) => {
                      if (q.questionType === "single") {
                        const checked = pickSingle(v) === opt.id;
                        return (
                          <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={q.id}
                              value={opt.id}
                              className="h-4 w-4 accent-primary"
                              disabled={readOnly}
                              checked={checked}
                              onChange={() => setAnswer(q.id, { optionId: opt.id })}
                            />
                            <span className="leading-6">{opt.label}</span>
                          </label>
                        );
                      }

                      const checked = selectedMulti.includes(opt.id);
                      const disabled = readOnly || (!checked && maxReached);

                      return (
                        <label key={opt.id} className={cn("flex items-center gap-2 text-sm", disabled ? "opacity-60" : null)}>
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(next) => {
                              setAnswer(q.id, (() => {
                                const prevIds = selectedMulti;
                                const nextIds = new Set(prevIds);
                                if (next === true) {
                                  if (!nextIds.has(opt.id) && nextIds.size >= q.maxChoices) {
                                    action.setError(`本题最多选择 ${q.maxChoices} 项`);
                                    return { optionIds: prevIds };
                                  }
                                  nextIds.add(opt.id);
                                } else {
                                  nextIds.delete(opt.id);
                                }
                                const out = [...nextIds];
                                if (out.length === 0) return null;
                                return { optionIds: out };
                              })());
                            }}
                          />
                          <span className="leading-6">{opt.label}</span>
                        </label>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button disabled={readOnly || action.pending || allQuestions.length === 0} onClick={() => void doSubmit()}>
          {action.pending ? "提交中..." : submittedAt ? "保存修改（覆盖提交）" : "提交"}
        </Button>
      </div>
    </div>
  );
}

