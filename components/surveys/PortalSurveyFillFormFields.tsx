"use client";

import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SurveyAnswerValue, SurveySection } from "@/lib/api/surveys";
import { cn } from "@/lib/utils";

type Props = {
  sections: SurveySection[];
  answers: Map<string, SurveyAnswerValue>;
  readOnly: boolean;
  pending: boolean;
  onAnswerChange: (questionId: string, value: SurveyAnswerValue | null) => void;
  onError: (message: string) => void;
};

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

export function PortalSurveyFillFormFields(props: Props) {
  const allSections = useMemo(() => props.sections.slice().sort((a, b) => a.sort - b.sort), [props.sections]);
  const disabled = props.readOnly || props.pending;

  if (allSections.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无分节</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {allSections.map((section) => (
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
                    const v = props.answers.get(q.id);

                    return (
                      <div key={q.id} className="space-y-2 rounded-lg border border-border bg-background p-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {q.title} {q.required ? <span className="text-destructive">*</span> : null}
                          </div>
                          {q.description ? <div className="text-xs text-muted-foreground">{q.description}</div> : null}
                        </div>

                        {q.questionType === "text" ? (
                          <Textarea
                            value={pickText(v)}
                            onChange={(e) => {
                              const text = e.target.value;
                              props.onAnswerChange(q.id, text === "" ? null : { text });
                            }}
                            placeholder="请输入…"
                            disabled={disabled}
                          />
                        ) : null}

                        {q.questionType === "single" ? (
                          <div className="space-y-2">
                            {q.options
                              .slice()
                              .sort((a, b) => a.sort - b.sort)
                              .map((opt) => {
                                const checked = pickSingle(v) === opt.id;
                                return (
                                  <label key={opt.id} className={cn("flex cursor-pointer items-center gap-2 text-sm", disabled ? "opacity-60" : null)}>
                                    <input
                                      type="radio"
                                      name={q.id}
                                      value={opt.id}
                                      className="h-4 w-4 accent-primary"
                                      disabled={disabled}
                                      checked={checked}
                                      onChange={() => props.onAnswerChange(q.id, { optionId: opt.id })}
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
                                  <label key={opt.id} className={cn("flex items-center gap-2 text-sm", disabled ? "opacity-60" : null)}>
                                    <Checkbox
                                      checked={checked}
                                      disabled={disabled}
                                      onCheckedChange={(next) => {
                                        props.onAnswerChange(q.id, (() => {
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
                                  <Button
                                    key={n}
                                    type="button"
                                    variant={selected ? "default" : "outline"}
                                    size="sm"
                                    className="h-9 w-10 px-0"
                                    disabled={disabled}
                                    onClick={() => props.onAnswerChange(q.id, { value: n })}
                                  >
                                    {n}
                                  </Button>
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
  );
}
