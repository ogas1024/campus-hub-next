"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { VisibilityScopeSelector } from "@/components/console/VisibilityScopeSelector";
import { NoticeEditor } from "@/components/notices/NoticeEditor";
import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SurveyQuestionType, SurveySection } from "@/lib/api/surveys";
import { selectedScopesToInputs, type SelectedScopes, createEmptySelectedScopes } from "@/lib/ui/visibilityScope";
import { cn } from "@/lib/utils";

import { ensureChoiceOptions, normalizeSurveySections } from "./useConsoleSurveyEditor";

type Props = {
  mode: "create" | "edit";
  editableStructure: boolean;
  formDisabled: boolean;

  title: string;
  setTitle: (value: string) => void;
  descriptionMd: string;
  setDescriptionMd: (value: string) => void;

  startAtLocal: string;
  setStartAtLocal: (value: string) => void;
  endAtLocal: string;
  setEndAtLocal: (value: string) => void;

  anonymousResponses: boolean;
  setAnonymousResponses: (value: boolean) => void;

  visibleAll: boolean;
  setVisibleAll: (value: boolean) => void;

  selected: SelectedScopes;
  setSelected: Dispatch<SetStateAction<SelectedScopes>>;
  scopeOptions: Parameters<typeof VisibilityScopeSelector>[0]["options"];
  scopeError?: string | null;

  sections: SurveySection[];
  setSections: Dispatch<SetStateAction<SurveySection[]>>;
  onAddSection: () => void;
  onAddQuestion: (sectionId: string) => void;
};

type DeleteTarget =
  | { kind: "section"; sectionId: string }
  | { kind: "question"; sectionId: string; questionId: string }
  | { kind: "option"; sectionId: string; questionId: string; optionId: string };

export function ConsoleSurveyEditorFormFields(props: Props) {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const scopes = useMemo(() => selectedScopesToInputs(props.selected), [props.selected]);
  const normalizedSections = useMemo(() => normalizeSurveySections(props.sections), [props.sections]);

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "section") {
      props.setSections((prev) => normalizeSurveySections(prev.filter((s) => s.id !== deleteTarget.sectionId)));
    } else if (deleteTarget.kind === "question") {
      props.setSections((prev) =>
        normalizeSurveySections(
          prev.map((s) =>
            s.id !== deleteTarget.sectionId ? s : { ...s, questions: s.questions.filter((q) => q.id !== deleteTarget.questionId) },
          ),
        ),
      );
    } else {
      props.setSections((prev) =>
        normalizeSurveySections(
          prev.map((s) => {
            if (s.id !== deleteTarget.sectionId) return s;
            return {
              ...s,
              questions: s.questions.map((q) =>
                q.id !== deleteTarget.questionId ? q : { ...q, options: (q.options ?? []).filter((o) => o.id !== deleteTarget.optionId) },
              ),
            };
          }),
        ),
      );
    }
    setDeleteTarget(null);
  }

  const deleteTitle = useMemo(() => {
    if (!deleteTarget) return "";
    if (deleteTarget.kind === "section") return "确认删除该分节？";
    if (deleteTarget.kind === "question") return "确认删除该题目？";
    return "确认删除该选项？";
  }, [deleteTarget]);

  const deleteDescription = useMemo(() => {
    if (!deleteTarget) return undefined;
    if (deleteTarget.kind === "section") return "该分节下的题目将一并删除。";
    if (deleteTarget.kind === "question") return "删除后不可恢复（草稿内操作）。";
    return "至少需保留 2 个选项。";
  }, [deleteTarget]);

  const commonFields = (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label>标题</Label>
        <Input uiSize="sm" value={props.title} onChange={(e) => props.setTitle(e.target.value)} maxLength={200} required disabled={props.formDisabled} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>开始时间</Label>
          <Input uiSize="sm" type="datetime-local" value={props.startAtLocal} onChange={(e) => props.setStartAtLocal(e.target.value)} required disabled={props.formDisabled} />
        </div>
        <div className="grid gap-1.5">
          <Label>结束时间</Label>
          <Input uiSize="sm" type="datetime-local" value={props.endAtLocal} onChange={(e) => props.setEndAtLocal(e.target.value)} required disabled={props.formDisabled} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Checkbox id="anonymousResponses" checked={props.anonymousResponses} disabled={props.formDisabled} onCheckedChange={(v) => props.setAnonymousResponses(v === true)} />
        <Label htmlFor="anonymousResponses" className="text-sm font-normal">
          匿名答卷（管理端结果/导出/AI 总结不显示答题人身份）
        </Label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          id="visibleAll"
          checked={props.visibleAll}
          disabled={props.formDisabled}
          onCheckedChange={(v) => {
            const next = v === true;
            props.setVisibleAll(next);
            if (next) props.setSelected(createEmptySelectedScopes());
          }}
        />
        <Label htmlFor="visibleAll" className="text-sm font-normal">
          全员可见
        </Label>
        {!props.visibleAll ? <span className="text-xs text-muted-foreground">（role/department/position 任一命中即可见，OR 逻辑）</span> : null}
      </div>

      {!props.visibleAll ? (
        <div className="space-y-2">
          <VisibilityScopeSelector options={props.scopeOptions} selected={props.selected} setSelected={props.setSelected} disabled={props.formDisabled} />
          {props.scopeError ? <div className="text-sm text-destructive">{props.scopeError}</div> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>说明（Markdown，可选）</Label>
        <div className="rounded-lg border border-input">
          <NoticeEditor value={props.descriptionMd} onChange={props.setDescriptionMd} height="360px" />
        </div>
      </div>

      {!props.visibleAll && scopes.length === 0 ? <div className="text-sm text-destructive">请至少选择 1 个可见范围</div> : null}
    </div>
  );

  if (props.mode === "create") return commonFields;

  return (
    <>
      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">编辑</TabsTrigger>
          <TabsTrigger value="preview">预览</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <div className="grid gap-4">
            {commonFields}

            <div className="space-y-3 rounded-xl border border-border bg-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">分节与题目</div>
                {props.editableStructure ? (
                  <Button size="sm" variant="outline" disabled={props.formDisabled} onClick={() => props.onAddSection()}>
                    新增分节
                  </Button>
                ) : null}
              </div>

              {normalizedSections.length === 0 ? <div className="text-sm text-muted-foreground">暂无分节</div> : null}

              <div className="space-y-3">
                {normalizedSections.map((section, sectionIndex) => (
                  <div key={section.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="grid gap-1.5">
                          <Label>分节标题</Label>
                          <Input
                            value={section.title}
                            disabled={!props.editableStructure || props.formDisabled}
                            onChange={(e) => {
                              const value = e.target.value;
                              props.setSections((prev) => normalizeSurveySections(prev.map((s) => (s.id === section.id ? { ...s, title: value } : s))));
                            }}
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {props.editableStructure ? (
                            <button
                              type="button"
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                              disabled={props.formDisabled}
                              onClick={() => props.onAddQuestion(section.id)}
                            >
                              添加题目
                            </button>
                          ) : null}

                          {props.editableStructure ? (
                            <button
                              type="button"
                              className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "h-8 px-2 text-xs")}
                              disabled={props.formDisabled || normalizedSections.length <= 1}
                              onClick={() => setDeleteTarget({ kind: "section", sectionId: section.id })}
                            >
                              删除分节
                            </button>
                          ) : null}
                        </div>

                        {section.questions.length === 0 ? (
                          <div className="text-sm text-muted-foreground">暂无题目</div>
                        ) : (
                          <div className="space-y-3">
                            {section.questions.map((q, questionIndex) => (
                              <div key={q.id} className="space-y-3 rounded-lg border border-border bg-muted p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="grid gap-1.5">
                                    <Label>题目</Label>
                                    <Input
                                      value={q.title}
                                      disabled={!props.editableStructure || props.formDisabled}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        props.setSections((prev) =>
                                          normalizeSurveySections(
                                            prev.map((s) =>
                                              s.id !== section.id
                                                ? s
                                                : { ...s, questions: s.questions.map((qq) => (qq.id === q.id ? { ...qq, title: value } : qq)) },
                                            ),
                                          ),
                                        );
                                      }}
                                    />
                                  </div>

                                  {props.editableStructure ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                                        disabled={props.formDisabled || questionIndex === 0}
                                        onClick={() =>
                                          props.setSections((prev) =>
                                            normalizeSurveySections(
                                              prev.map((s) => {
                                                if (s.id !== section.id) return s;
                                                const nextQs = s.questions.slice();
                                                [nextQs[questionIndex - 1], nextQs[questionIndex]] = [nextQs[questionIndex], nextQs[questionIndex - 1]];
                                                return { ...s, questions: nextQs };
                                              }),
                                            ),
                                          )
                                        }
                                      >
                                        上移
                                      </button>
                                      <button
                                        type="button"
                                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                                        disabled={props.formDisabled || questionIndex >= section.questions.length - 1}
                                        onClick={() =>
                                          props.setSections((prev) =>
                                            normalizeSurveySections(
                                              prev.map((s) => {
                                                if (s.id !== section.id) return s;
                                                const nextQs = s.questions.slice();
                                                [nextQs[questionIndex], nextQs[questionIndex + 1]] = [nextQs[questionIndex + 1], nextQs[questionIndex]];
                                                return { ...s, questions: nextQs };
                                              }),
                                            ),
                                          )
                                        }
                                      >
                                        下移
                                      </button>
                                      <button
                                        type="button"
                                        className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "h-8 px-2 text-xs")}
                                        disabled={props.formDisabled}
                                        onClick={() => setDeleteTarget({ kind: "question", sectionId: section.id, questionId: q.id })}
                                      >
                                        删除
                                      </button>
                                    </div>
                                  ) : null}
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                  <div className="grid gap-1.5 md:col-span-1">
                                    <Label>题型</Label>
                                    <Select
                                      value={q.questionType}
                                      disabled={!props.editableStructure || props.formDisabled}
                                      onChange={(e) => {
                                        const nextType = e.target.value as SurveyQuestionType;
                                        props.setSections((prev) =>
                                          normalizeSurveySections(
                                            prev.map((s) => {
                                              if (s.id !== section.id) return s;
                                              let nextQs = s.questions.map((qq) => (qq.id === q.id ? { ...qq, questionType: nextType } : qq));
                                              if (nextType === "single" || nextType === "multi") {
                                                nextQs = ensureChoiceOptions({ ...s, questions: nextQs }, q.id);
                                              } else {
                                                nextQs = nextQs.map((qq) => (qq.id === q.id ? { ...qq, options: [] } : qq));
                                              }
                                              return { ...s, questions: nextQs };
                                            }),
                                          ),
                                        );
                                      }}
                                    >
                                      <option value="text">文本</option>
                                      <option value="single">单选</option>
                                      <option value="multi">多选</option>
                                      <option value="rating">评分（1-5）</option>
                                    </Select>
                                  </div>

                                  <div className="flex items-center gap-3 md:col-span-2">
                                    <Checkbox
                                      checked={q.required}
                                      disabled={!props.editableStructure || props.formDisabled}
                                      onCheckedChange={(v) => {
                                        props.setSections((prev) =>
                                          normalizeSurveySections(
                                            prev.map((s) =>
                                              s.id !== section.id
                                                ? s
                                                : { ...s, questions: s.questions.map((qq) => (qq.id === q.id ? { ...qq, required: v === true } : qq)) },
                                            ),
                                          ),
                                        );
                                      }}
                                    />
                                    <span className="text-sm">必填</span>
                                  </div>
                                </div>

                                <div className="grid gap-1.5">
                                  <Label>题目说明（可选）</Label>
                                  <Input
                                    value={q.description ?? ""}
                                    disabled={!props.editableStructure || props.formDisabled}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      props.setSections((prev) =>
                                        normalizeSurveySections(
                                          prev.map((s) =>
                                            s.id !== section.id
                                              ? s
                                              : { ...s, questions: s.questions.map((qq) => (qq.id === q.id ? { ...qq, description: value.trim() ? value : null } : qq)) },
                                          ),
                                        ),
                                      );
                                    }}
                                  />
                                </div>

                                {q.questionType === "single" || q.questionType === "multi" ? (
                                  <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-sm font-medium">选项</div>
                                      {props.editableStructure ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={props.formDisabled}
                                          onClick={() => {
                                            props.setSections((prev) =>
                                              normalizeSurveySections(
                                                prev.map((s) => {
                                                  if (s.id !== section.id) return s;
                                                  return {
                                                    ...s,
                                                    questions: s.questions.map((qq) =>
                                                      qq.id !== q.id
                                                        ? qq
                                                        : {
                                                            ...qq,
                                                            options: (qq.options ?? []).concat({ id: crypto.randomUUID(), label: `选项 ${(qq.options ?? []).length + 1}`, sort: (qq.options ?? []).length }),
                                                          },
                                                    ),
                                                  };
                                                }),
                                              ),
                                            );
                                          }}
                                        >
                                          添加选项
                                        </Button>
                                      ) : null}
                                    </div>

                                    {q.options.length === 0 ? <div className="text-sm text-muted-foreground">暂无选项</div> : null}

                                    <div className="space-y-2">
                                      {q.options.map((opt, optionIndex) => (
                                        <div key={opt.id} className="rounded-lg border border-border bg-muted p-3">
                                          <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1 space-y-1">
                                              <Label className="text-xs">标签</Label>
                                              <Input
                                                value={opt.label}
                                                disabled={!props.editableStructure || props.formDisabled}
                                                onChange={(e) => {
                                                  const value = e.target.value;
                                                  props.setSections((prev) =>
                                                    normalizeSurveySections(
                                                      prev.map((s) => {
                                                        if (s.id !== section.id) return s;
                                                        return {
                                                          ...s,
                                                          questions: s.questions.map((qq) =>
                                                            qq.id !== q.id ? qq : { ...qq, options: (qq.options ?? []).map((oo) => (oo.id === opt.id ? { ...oo, label: value } : oo)) },
                                                          ),
                                                        };
                                                      }),
                                                    ),
                                                  );
                                                }}
                                              />
                                            </div>

                                            {props.editableStructure ? (
                                              <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                  type="button"
                                                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                                                  disabled={props.formDisabled || optionIndex === 0}
                                                  onClick={() => {
                                                    props.setSections((prev) =>
                                                      normalizeSurveySections(
                                                        prev.map((s) => {
                                                          if (s.id !== section.id) return s;
                                                          return {
                                                            ...s,
                                                            questions: s.questions.map((qq) => {
                                                              if (qq.id !== q.id) return qq;
                                                              const next = (qq.options ?? []).slice();
                                                              [next[optionIndex - 1], next[optionIndex]] = [next[optionIndex], next[optionIndex - 1]];
                                                              return { ...qq, options: next };
                                                            }),
                                                          };
                                                        }),
                                                      ),
                                                    );
                                                  }}
                                                >
                                                  上移
                                                </button>
                                                <button
                                                  type="button"
                                                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                                                  disabled={props.formDisabled || optionIndex >= q.options.length - 1}
                                                  onClick={() => {
                                                    props.setSections((prev) =>
                                                      normalizeSurveySections(
                                                        prev.map((s) => {
                                                          if (s.id !== section.id) return s;
                                                          return {
                                                            ...s,
                                                            questions: s.questions.map((qq) => {
                                                              if (qq.id !== q.id) return qq;
                                                              const next = (qq.options ?? []).slice();
                                                              [next[optionIndex], next[optionIndex + 1]] = [next[optionIndex + 1], next[optionIndex]];
                                                              return { ...qq, options: next };
                                                            }),
                                                          };
                                                        }),
                                                      ),
                                                    );
                                                  }}
                                                >
                                                  下移
                                                </button>

                                                <button
                                                  type="button"
                                                  className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "h-8 px-2 text-xs")}
                                                  disabled={props.formDisabled || (q.options?.length ?? 0) <= 2}
                                                  onClick={() => setDeleteTarget({ kind: "option", sectionId: section.id, questionId: q.id, optionId: opt.id })}
                                                >
                                                  删除
                                                </button>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">分节 {sectionIndex + 1} / {normalizedSections.length}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <div className="grid gap-4">
            <div className="space-y-2 rounded-xl border border-border bg-muted p-4">
              <div className="text-sm font-medium">说明（预览）</div>
              {props.descriptionMd.trim() ? <NoticeMarkdown contentMd={props.descriptionMd} /> : <div className="text-sm text-muted-foreground">无说明</div>}
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-muted p-4">
              <div className="text-sm font-medium">分节与题目（预览）</div>
              {normalizedSections.length === 0 ? <div className="text-sm text-muted-foreground">暂无分节</div> : null}
              <div className="space-y-3">
                {normalizedSections.map((section) => (
                  <div key={section.id} className="rounded-lg border border-border bg-background p-4">
                    <div className="text-sm font-semibold">{section.title || "（未命名分节）"}</div>
                    {section.questions.length === 0 ? (
                      <div className="mt-2 text-sm text-muted-foreground">暂无题目</div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {section.questions.map((q) => (
                          <div key={q.id} className="rounded-lg border border-border bg-muted p-4">
                            <div className="text-sm font-medium">
                              {q.title} {q.required ? <span className="text-destructive">*</span> : null}
                            </div>
                            {q.description ? <div className="mt-1 text-xs text-muted-foreground">{q.description}</div> : null}
                            <div className="mt-3 text-sm text-muted-foreground">
                              {q.questionType === "text"
                                ? "文本输入"
                                : q.questionType === "single"
                                  ? "单选"
                                  : q.questionType === "multi"
                                    ? "多选"
                                    : "评分（1-5）"}
                              {q.questionType === "single" || q.questionType === "multi" ? ` · 选项 ${(q.options ?? []).length} 个` : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmAlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteTitle}
        description={deleteDescription}
        confirmText="确认删除"
        onConfirm={confirmDelete}
      />
    </>
  );
}

