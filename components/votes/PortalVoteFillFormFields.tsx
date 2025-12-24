"use client";

import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { VoteAnswerValue, VoteQuestion } from "@/lib/api/votes";
import { cn } from "@/lib/utils";

type Props = {
  questions: VoteQuestion[];
  answers: Map<string, VoteAnswerValue>;
  readOnly: boolean;
  pending: boolean;
  onAnswerChange: (questionId: string, value: VoteAnswerValue | null) => void;
  onError: (message: string) => void;
};

function pickSingle(v: VoteAnswerValue | undefined) {
  return v && "optionId" in v ? v.optionId : null;
}

function pickMulti(v: VoteAnswerValue | undefined) {
  return v && "optionIds" in v ? v.optionIds : [];
}

export function PortalVoteFillFormFields(props: Props) {
  const allQuestions = useMemo(() => props.questions.slice().sort((a, b) => a.sort - b.sort), [props.questions]);

  if (allQuestions.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无题目</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {allQuestions.map((q) => {
        const v = props.answers.get(q.id);
        const selectedMulti = pickMulti(v);
        const selectedCount = q.questionType === "multi" ? selectedMulti.length : 0;
        const maxReached = q.questionType === "multi" ? selectedCount >= q.maxChoices : false;

        return (
          <Card key={q.id} id={`vote-question-${q.id}`}>
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
                        <label key={opt.id} className={cn("flex cursor-pointer items-center gap-2 text-sm", props.readOnly || props.pending ? "opacity-60" : null)}>
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.id}
                            className="h-4 w-4 accent-primary"
                            disabled={props.readOnly || props.pending}
                            checked={checked}
                            onChange={() => props.onAnswerChange(q.id, { optionId: opt.id })}
                          />
                          <span className="leading-6">{opt.label}</span>
                        </label>
                      );
                    }

                    const checked = selectedMulti.includes(opt.id);
                    const disabled = props.readOnly || props.pending || (!checked && maxReached);

                    return (
                      <label key={opt.id} className={cn("flex items-center gap-2 text-sm", disabled ? "opacity-60" : null)}>
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(next) => {
                            props.onAnswerChange(q.id, (() => {
                              const prevIds = selectedMulti;
                              const nextIds = new Set(prevIds);
                              if (next === true) {
                                if (!nextIds.has(opt.id) && nextIds.size >= q.maxChoices) {
                                  props.onError(`本题最多选择 ${q.maxChoices} 项`);
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
  );
}

