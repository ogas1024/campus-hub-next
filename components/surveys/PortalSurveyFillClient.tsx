"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { submitSurveyResponse, type SurveyAnswerValue, type SurveySection } from "@/lib/api/surveys";

type Props = {
  surveyId: string;
  canSubmit: boolean;
  sections: SurveySection[];
  initialItems: Array<{ questionId: string; value: SurveyAnswerValue }>;
  initialSubmittedAt: string | null;
};

function buildInitialAnswerMap(items: Array<{ questionId: string; value: SurveyAnswerValue }>) {
  const map = new Map<string, SurveyAnswerValue>();
  for (const item of items) map.set(item.questionId, item.value);
  return map;
}

export function PortalSurveyFillClient(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const [submittedAt, setSubmittedAt] = useState<string | null>(props.initialSubmittedAt);
  const [answers, setAnswers] = useState(() => buildInitialAnswerMap(props.initialItems));

  const allQuestions = useMemo(() => props.sections.flatMap((s) => s.questions.map((q) => ({ section: s, q }))), [props.sections]);
  const readOnly = !props.canSubmit;

  function setAnswer(questionId: string, value: SurveyAnswerValue | null) {
    setAnswers((prev) => {
      const next = new Map(prev);
      if (value) next.set(questionId, value);
      else next.delete(questionId);
      return next;
    });
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

  function validateRequired() {
    for (const { q } of allQuestions) {
      if (!q.required) continue;
      const v = answers.get(q.id);
      if (!v) return { ok: false as const, message: "存在必填题未填写，请检查后再提交。", questionId: q.id };

      if (q.questionType === "text" && pickText(v).trim() === "") {
        return { ok: false as const, message: "存在必填题未填写，请检查后再提交。", questionId: q.id };
      }
      if (q.questionType === "multi" && pickMulti(v).length === 0) {
        return { ok: false as const, message: "存在必填题未填写，请检查后再提交。", questionId: q.id };
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

    const hadSubmitted = !!submittedAt;
    const items = [...answers.entries()].map(([questionId, value]) => ({ questionId, value }));
    const res = await action.run(() => submitSurveyResponse(props.surveyId, { items }), { fallbackErrorMessage: "提交失败" });
    if (!res) return;
    toast.success(hadSubmitted ? "已保存修改" : "已提交");
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
        {props.sections.map((section) => (
          <Card key={section.id}>
            <CardContent className="space-y-4 p-6">
              <div className="space-y-1">
                <div className="text-base font-semibold">{section.title || "（未命名分节）"}</div>
              </div>

              {section.questions.length === 0 ? (
                <div className="text-sm text-muted-foreground">本分节暂无题目</div>
              ) : (
                <div className="space-y-4">
                  {section.questions
                    .slice()
                    .sort((a, b) => a.sort - b.sort)
                    .map((q) => {
                      const v = answers.get(q.id);
                      const required = q.required;

                      return (
                        <div key={q.id} className="space-y-2 rounded-lg border border-border bg-background p-4">
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {q.title} {required ? <span className="text-destructive">*</span> : null}
                            </div>
                            {q.description ? <div className="text-xs text-muted-foreground">{q.description}</div> : null}
                          </div>

                          {q.questionType === "text" ? (
                            <div className="space-y-1">
                              <Textarea
                                value={pickText(v)}
                                onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                                placeholder="请输入…"
                                disabled={readOnly}
                              />
                            </div>
                          ) : null}

                          {q.questionType === "single" ? (
                            <div className="space-y-2">
                              {q.options
                                .slice()
                                .sort((a, b) => a.sort - b.sort)
                                .map((opt) => {
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
                                })}
                            </div>
                          ) : null}

                          {q.questionType === "multi" ? (
                            <div className="space-y-2">
                              {q.options
                                .slice()
                                .sort((a, b) => a.sort - b.sort)
                                .map((opt) => {
                                  const selected = pickMulti(v);
                                  const checked = selected.includes(opt.id);
                                  return (
                                    <label key={opt.id} className="flex items-center gap-2 text-sm">
                                      <Checkbox
                                        checked={checked}
                                        disabled={readOnly}
                                        onCheckedChange={(next) => {
                                          setAnswer(q.id, (() => {
                                            const prevIds = selected;
                                            const nextIds = new Set(prevIds);
                                            if (next === true) nextIds.add(opt.id);
                                            else nextIds.delete(opt.id);
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
                          ) : null}

                          {q.questionType === "rating" ? (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">评分（1-5）</Label>
                              <div className="flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5].map((n) => {
                                  const selected = pickRating(v) === n;
                                  return (
                                    <button
                                      key={n}
                                      type="button"
                                      className={cn(
                                        buttonVariants({ variant: selected ? "default" : "outline", size: "sm" }),
                                        "h-9 w-10 px-0",
                                      )}
                                      disabled={readOnly}
                                      onClick={() => setAnswer(q.id, { value: n })}
                                    >
                                      {n}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button disabled={readOnly || action.pending} onClick={() => void doSubmit()}>
          {action.pending ? "提交中..." : submittedAt ? "保存修改（覆盖提交）" : "提交"}
        </Button>
      </div>
    </div>
  );
}
