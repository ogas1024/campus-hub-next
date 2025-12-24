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
import type { VoteQuestion } from "@/lib/api/votes";
import { selectedScopesToInputs, type SelectedScopes, createEmptySelectedScopes } from "@/lib/ui/visibilityScope";
import { cn } from "@/lib/utils";

import { normalizeVoteQuestions } from "./useConsoleVoteEditor";

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

  questions: VoteQuestion[];
  setQuestions: Dispatch<SetStateAction<VoteQuestion[]>>;
  onAddQuestion: () => void;
};

type DeleteTarget =
  | { kind: "question"; questionId: string }
  | { kind: "option"; questionId: string; optionId: string };

export function ConsoleVoteEditorFormFields(props: Props) {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const scopes = useMemo(() => selectedScopesToInputs(props.selected), [props.selected]);

  const normalizedQuestions = useMemo(() => normalizeVoteQuestions(props.questions), [props.questions]);
  const questionIndexById = useMemo(() => new Map(normalizedQuestions.map((q, idx) => [q.id, idx])), [normalizedQuestions]);

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "question") {
      props.setQuestions((prev) => normalizeVoteQuestions(prev.filter((q) => q.id !== deleteTarget.questionId)));
    } else {
      props.setQuestions((prev) =>
        normalizeVoteQuestions(
          prev.map((q) => {
            if (q.id !== deleteTarget.questionId) return q;
            const nextOptions = q.options
              .filter((o) => o.id !== deleteTarget.optionId)
              .map((o, idx) => ({ ...o, sort: idx }));
            const maxChoices = q.questionType === "single" ? 1 : Math.min(q.maxChoices, nextOptions.length);
            return { ...q, options: nextOptions, maxChoices };
          }),
        ),
      );
    }
    setDeleteTarget(null);
  }

  const deleteTitle = useMemo(() => {
    if (!deleteTarget) return "";
    if (deleteTarget.kind === "question") return "确认删除该题目？";
    return "确认删除该候选项？";
  }, [deleteTarget]);

  const deleteDescription = useMemo(() => {
    if (!deleteTarget) return undefined;
    if (deleteTarget.kind === "question") {
      const idx = questionIndexById.get(deleteTarget.questionId);
      return idx == null ? undefined : `将删除第 ${idx + 1} 题及其所有候选项。`;
    }
    return "至少需保留 2 个候选项。";
  }, [deleteTarget, questionIndexById]);

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
          匿名投票（MVP 不提供实名名单；后续导出/公示可隐藏身份）
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

      <div className="grid gap-2">
        <Label>投票说明（Markdown，可选）</Label>
        <NoticeEditor value={props.descriptionMd} onChange={props.setDescriptionMd} placeholder="可选：说明投票背景、规则与注意事项…" />
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
                <div className="text-sm font-medium">题目与候选项</div>
                {props.editableStructure ? (
                  <Button size="sm" variant="outline" disabled={props.formDisabled} onClick={() => props.onAddQuestion()}>
                    新增题目
                  </Button>
                ) : null}
              </div>

              {normalizedQuestions.length === 0 ? <div className="text-sm text-muted-foreground">暂无题目</div> : null}

              <div className="space-y-3">
                {normalizedQuestions.map((q, idx) => (
                  <div key={q.id} className="space-y-3 rounded-xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">第 {idx + 1} 题</div>
                      {props.editableStructure ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                            disabled={props.formDisabled || idx === 0}
                            onClick={() =>
                              props.setQuestions((prev) => {
                                const next = prev.slice();
                                const a = next[idx - 1]!;
                                next[idx - 1] = next[idx]!;
                                next[idx] = a;
                                return normalizeVoteQuestions(next);
                              })
                            }
                          >
                            上移
                          </button>
                          <button
                            type="button"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                            disabled={props.formDisabled || idx === normalizedQuestions.length - 1}
                            onClick={() =>
                              props.setQuestions((prev) => {
                                const next = prev.slice();
                                const a = next[idx + 1]!;
                                next[idx + 1] = next[idx]!;
                                next[idx] = a;
                                return normalizeVoteQuestions(next);
                              })
                            }
                          >
                            下移
                          </button>
                          <button
                            type="button"
                            className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "h-8 px-2 text-xs")}
                            disabled={props.formDisabled || normalizedQuestions.length <= 1}
                            onClick={() => setDeleteTarget({ kind: "question", questionId: q.id })}
                          >
                            删除
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-12">
                      <div className="md:col-span-8">
                        <Label className="text-xs">题目标题</Label>
                        <Input
                          value={q.title}
                          disabled={!props.editableStructure || props.formDisabled}
                          onChange={(e) => {
                            const value = e.target.value;
                            props.setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, title: value } : x)));
                          }}
                          maxLength={200}
                        />
                      </div>

                      <div className="md:col-span-4">
                        <Label className="text-xs">题型</Label>
                        <Select
                          value={q.questionType}
                          disabled={!props.editableStructure || props.formDisabled}
                          onChange={(e) => {
                            const nextType = e.target.value === "multi" ? "multi" : "single";
                            props.setQuestions((prev) =>
                              prev.map((x) => {
                                if (x.id !== q.id) return x;
                                const optionCount = x.options.length;
                                const maxChoices = nextType === "single" ? 1 : Math.min(Math.max(1, x.maxChoices), optionCount);
                                return { ...x, questionType: nextType, maxChoices };
                              }),
                            );
                          }}
                        >
                          <option value="single">单选</option>
                          <option value="multi">多选</option>
                        </Select>
                      </div>

                      <div className="md:col-span-8">
                        <Label className="text-xs">题目描述（可选）</Label>
                        <Input
                          value={q.description ?? ""}
                          disabled={!props.editableStructure || props.formDisabled}
                          onChange={(e) => {
                            const value = e.target.value;
                            props.setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, description: value.trim() ? value : null } : x)));
                          }}
                          maxLength={2000}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label className="text-xs">必答</Label>
                        <div className="mt-2 flex items-center gap-2">
                          <Checkbox
                            checked={q.required}
                            disabled={!props.editableStructure || props.formDisabled}
                            onCheckedChange={(v) => props.setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, required: v === true } : x)))}
                          />
                          <span className="text-xs text-muted-foreground">必答</span>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <Label className="text-xs">最多选择</Label>
                        {q.questionType === "single" ? (
                          <div className="mt-2 text-sm text-muted-foreground">1</div>
                        ) : (
                          <Input
                            type="number"
                            min={1}
                            max={q.options.length}
                            value={String(q.maxChoices)}
                            disabled={!props.editableStructure || props.formDisabled}
                            onChange={(e) => {
                              const value = Math.trunc(Number(e.target.value));
                              props.setQuestions((prev) =>
                                prev.map((x) => {
                                  if (x.id !== q.id) return x;
                                  const safe = Number.isFinite(value) ? Math.max(1, Math.min(x.options.length, value)) : 1;
                                  return { ...x, maxChoices: safe };
                                }),
                              );
                            }}
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">候选项</div>
                        {props.editableStructure ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={props.formDisabled}
                            onClick={() => {
                              props.setQuestions((prev) =>
                                prev.map((x) => {
                                  if (x.id !== q.id) return x;
                                  const nextOptions = normalizeVoteQuestions([x])[0]!.options.concat({
                                    id: crypto.randomUUID(),
                                    label: `选项 ${x.options.length + 1}`,
                                    sort: x.options.length,
                                  });
                                  const optionCount = nextOptions.length;
                                  const maxChoices = x.questionType === "single" ? 1 : Math.min(x.maxChoices, optionCount);
                                  return { ...x, options: nextOptions, maxChoices };
                                }),
                              );
                            }}
                          >
                            新增选项
                          </Button>
                        ) : null}
                      </div>

                      {q.options.length === 0 ? <div className="text-sm text-muted-foreground">暂无候选项</div> : null}

                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <div key={opt.id} className="rounded-lg border border-border bg-muted p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1 space-y-1">
                                <Label className="text-xs">标签</Label>
                                <Input
                                  value={opt.label}
                                  disabled={!props.editableStructure || props.formDisabled}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    props.setQuestions((prev) =>
                                      prev.map((x) => {
                                        if (x.id !== q.id) return x;
                                        return {
                                          ...x,
                                          options: x.options.map((o) => (o.id === opt.id ? { ...o, label: value } : o)),
                                        };
                                      }),
                                    );
                                  }}
                                  maxLength={200}
                                />
                              </div>

                              {props.editableStructure ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                                    disabled={props.formDisabled || oi === 0}
                                    onClick={() => {
                                      props.setQuestions((prev) =>
                                        prev.map((x) => {
                                          if (x.id !== q.id) return x;
                                          const next = x.options.slice();
                                          const t = next[oi - 1]!;
                                          next[oi - 1] = next[oi]!;
                                          next[oi] = t;
                                          return { ...x, options: next.map((o, idx2) => ({ ...o, sort: idx2 })) };
                                        }),
                                      );
                                    }}
                                  >
                                    上移
                                  </button>
                                  <button
                                    type="button"
                                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                                    disabled={props.formDisabled || oi === q.options.length - 1}
                                    onClick={() => {
                                      props.setQuestions((prev) =>
                                        prev.map((x) => {
                                          if (x.id !== q.id) return x;
                                          const next = x.options.slice();
                                          const t = next[oi + 1]!;
                                          next[oi + 1] = next[oi]!;
                                          next[oi] = t;
                                          return { ...x, options: next.map((o, idx2) => ({ ...o, sort: idx2 })) };
                                        }),
                                      );
                                    }}
                                  >
                                    下移
                                  </button>
                                  <button
                                    type="button"
                                    className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "h-8 px-2 text-xs")}
                                    disabled={props.formDisabled || q.options.length <= 2}
                                    onClick={() => setDeleteTarget({ kind: "option", questionId: q.id, optionId: opt.id })}
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
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                提示：发布后将锁定题目与候选项结构；如需修改结构请新建投票或在草稿阶段完成编辑。
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <div className="grid gap-4">
            <div className="space-y-2 rounded-xl border border-border bg-muted p-4">
              <div className="text-sm font-medium">投票说明（预览）</div>
              {props.descriptionMd.trim() ? <NoticeMarkdown contentMd={props.descriptionMd} /> : <div className="text-sm text-muted-foreground">无说明</div>}
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-muted p-4">
              <div className="text-sm font-medium">题目预览</div>
              {normalizedQuestions.length === 0 ? <div className="text-sm text-muted-foreground">暂无题目</div> : null}
              {normalizedQuestions.map((q, idx) => (
                <div key={q.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="text-sm font-medium">
                    {idx + 1}. {q.title} {q.required ? <span className="text-destructive">*</span> : null}
                  </div>
                  {q.description?.trim() ? <div className="mt-1 text-sm text-muted-foreground">{q.description}</div> : null}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {q.questionType === "single" ? "单选" : `多选（最多 ${q.maxChoices}）`} · 候选项 {q.options.length} 个
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    {q.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-foreground/30" />
                        <span>{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
