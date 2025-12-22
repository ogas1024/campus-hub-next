"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ConsoleFormDialog } from "@/components/console/crud/ConsoleFormDialog";
import { VisibilityScopeSelector } from "@/components/console/VisibilityScopeSelector";
import { InlineError } from "@/components/common/InlineError";
import { NoticeEditor } from "@/components/notices/NoticeEditor";
import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiResponseError } from "@/lib/api/http";
import {
  archiveConsoleVote,
  closeConsoleVote,
  extendConsoleVote,
  fetchConsoleVoteDetail,
  fetchVoteScopeOptions,
  pinConsoleVote,
  publishConsoleVote,
  updateConsoleVoteDraft,
} from "@/lib/api/console-votes";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { useVisibilityScopeOptions } from "@/lib/hooks/useVisibilityScopeOptions";
import type { VoteQuestion } from "@/lib/api/votes";
import { createEmptySelectedScopes, selectedScopesFromInputs, selectedScopesToInputs } from "@/lib/ui/visibilityScope";
import { cn } from "@/lib/utils";

type Props = {
  voteId: string;
  perms: {
    canUpdate: boolean;
    canPublish: boolean;
    canClose: boolean;
    canExtend: boolean;
    canPin: boolean;
    canArchive: boolean;
  };
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
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

function normalizeSorts(questions: VoteQuestion[]) {
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

export default function EditVoteClient(props: Props) {
  const id = props.voteId;
  const router = useRouter();
  const action = useAsyncAction();

  const scopeOptionsQuery = useVisibilityScopeOptions(fetchVoteScopeOptions, { silent: true });

  const [loading, setLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [startAtLocal, setStartAtLocal] = useState("");
  const [endAtLocal, setEndAtLocal] = useState("");
  const [anonymousResponses, setAnonymousResponses] = useState(false);
  const [visibleAll, setVisibleAll] = useState(true);
  const [selected, setSelected] = useState(createEmptySelectedScopes);
  const [questions, setQuestions] = useState<VoteQuestion[]>([]);

  const [status, setStatus] = useState<"draft" | "published" | "closed">("draft");
  const [effectiveStatus, setEffectiveStatus] = useState<"draft" | "published" | "closed">("draft");
  const [pinned, setPinned] = useState(false);
  const [archivedAt, setArchivedAt] = useState<string | null>(null);

  const [extendOpen, setExtendOpen] = useState(false);
  const [extendEndAtLocal, setExtendEndAtLocal] = useState("");

  const editable = status === "draft" && props.perms.canUpdate && !archivedAt;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setDetailError(null);
      try {
        const detail = await fetchConsoleVoteDetail(id);
        if (cancelled) return;

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
        setQuestions(normalizeSorts(detail.questions));

        setSelected(selectedScopesFromInputs(detail.scopes));
      } catch (err) {
        if (cancelled) return;
        setDetailError(err instanceof ApiResponseError ? err.message : "加载失败");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const scopes = useMemo(() => {
    return selectedScopesToInputs(selected);
  }, [selected]);

  function canSaveDraft() {
    if (!editable) return false;
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

  async function doSave() {
    if (!editable) return;
    try {
      const res = await action.run(
        () =>
          updateConsoleVoteDraft(id, {
            title: title.trim(),
            descriptionMd,
            startAt: toIso(startAtLocal, "startAt"),
            endAt: toIso(endAtLocal, "endAt"),
            anonymousResponses,
            visibleAll,
            scopes,
            questions: normalizeSorts(questions).map((q) => ({
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
      if (!res) return;
      setTitle(res.title);
      setDescriptionMd(res.descriptionMd ?? "");
      setStartAtLocal(toLocalInputValue(res.startAt));
      setEndAtLocal(toLocalInputValue(res.endAt));
      setAnonymousResponses(res.anonymousResponses);
      setVisibleAll(res.visibleAll);
      setStatus(res.status);
      setEffectiveStatus(res.effectiveStatus);
      setPinned(res.pinned);
      setArchivedAt(res.archivedAt);
      setQuestions(normalizeSorts(res.questions));
      setSelected(selectedScopesFromInputs(res.scopes));

      router.refresh();
    } catch (err) {
      action.setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function doPublish() {
    const res = await action.run(() => publishConsoleVote(id), { fallbackErrorMessage: "发布失败" });
    if (!res) return;
    setStatus(res.status);
    setEffectiveStatus(res.effectiveStatus);
    setPinned(res.pinned);
    setArchivedAt(res.archivedAt);
    router.refresh();
  }

  async function doClose() {
    const res = await action.run(() => closeConsoleVote(id), { fallbackErrorMessage: "关闭失败" });
    if (!res) return;
    setStatus(res.status);
    setEffectiveStatus(res.effectiveStatus);
    setPinned(res.pinned);
    setArchivedAt(res.archivedAt);
    router.refresh();
  }

  async function doExtend() {
    try {
      const endAt = toIso(extendEndAtLocal, "endAt");
      const res = await action.run(() => extendConsoleVote(id, { endAt }), { fallbackErrorMessage: "延期失败" });
      if (!res) return;
      setEndAtLocal(toLocalInputValue(res.endAt));
      setExtendOpen(false);
      setStatus(res.status);
      setEffectiveStatus(res.effectiveStatus);
      setPinned(res.pinned);
      setArchivedAt(res.archivedAt);
      router.refresh();
    } catch (err) {
      action.setError(err instanceof Error ? err.message : "延期失败");
    }
  }

  async function doPin(nextPinned: boolean) {
    const res = await action.run(() => pinConsoleVote(id, { pinned: nextPinned }), { fallbackErrorMessage: "置顶失败" });
    if (!res) return;
    setPinned(res.pinned);
    setStatus(res.status);
    setEffectiveStatus(res.effectiveStatus);
    router.refresh();
  }

  async function doArchive() {
    if (!confirm("确认归档该投票？归档后将从学生端公共列表隐藏，但已参与用户仍可在“我的投票”中查看。")) return;
    const res = await action.run(() => archiveConsoleVote(id), { fallbackErrorMessage: "归档失败" });
    if (!res) return;
    setArchivedAt(res.archivedAt);
    setPinned(res.pinned);
    setStatus(res.status);
    setEffectiveStatus(res.effectiveStatus);
    router.refresh();
  }

  if (loading) return <div className="text-sm text-muted-foreground">加载中...</div>;
  if (detailError) return <InlineError message={detailError} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">投票编辑</h1>
          <div className="text-sm text-muted-foreground">{title || id}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{status === "draft" ? "草稿" : status === "published" ? "已发布" : "已结束"}</Badge>
            {effectiveStatus !== status ? <Badge variant="outline">有效状态：{effectiveStatus === "closed" ? "已结束" : effectiveStatus}</Badge> : null}
            {archivedAt ? <Badge variant="secondary">已归档</Badge> : null}
            {pinned ? <Badge>置顶</Badge> : null}
            {!editable ? <Badge variant="secondary">结构只读</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/votes">
            ← 返回列表
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/votes/${id}/results`}>
            查看结果
          </Link>

          {effectiveStatus === "published" && props.perms.canClose && !archivedAt ? (
            <Button size="sm" variant="outline" disabled={action.pending} onClick={() => void doClose()}>
              关闭
            </Button>
          ) : null}
          {status !== "draft" && props.perms.canExtend && !archivedAt ? (
            <Button
              size="sm"
              variant="outline"
              disabled={action.pending}
              onClick={() => {
                action.reset();
                setExtendOpen(true);
              }}
            >
              延期
            </Button>
          ) : null}
          {status === "published" && effectiveStatus === "published" && props.perms.canPin && !archivedAt ? (
            <Button size="sm" variant={pinned ? "outline" : "default"} disabled={action.pending} onClick={() => void doPin(!pinned)}>
              {pinned ? "取消置顶" : "置顶"}
            </Button>
          ) : null}
          {effectiveStatus === "closed" && props.perms.canArchive && !archivedAt ? (
            <Button size="sm" variant="outline" disabled={action.pending} onClick={() => void doArchive()}>
              归档
            </Button>
          ) : null}
          {status === "draft" && props.perms.canPublish && !archivedAt ? (
            <Button size="sm" disabled={action.pending} onClick={() => void doPublish()}>
              发布
            </Button>
          ) : null}
          {editable ? (
            <Button size="sm" variant="outline" disabled={action.pending || !canSaveDraft()} onClick={() => void doSave()}>
              {action.pending ? "保存中..." : "保存草稿"}
            </Button>
          ) : null}
        </div>
      </div>

      <InlineError message={action.error} />

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">编辑</TabsTrigger>
          <TabsTrigger value="preview">预览</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="grid gap-1.5">
                  <Label>标题</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required disabled={!editable} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>开始时间</Label>
                    <Input type="datetime-local" value={startAtLocal} onChange={(e) => setStartAtLocal(e.target.value)} required disabled={!editable} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>结束时间</Label>
                    <Input type="datetime-local" value={endAtLocal} onChange={(e) => setEndAtLocal(e.target.value)} required disabled={!editable} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox id="anonymousResponses" checked={anonymousResponses} disabled={!editable} onCheckedChange={(v) => setAnonymousResponses(v === true)} />
                  <Label htmlFor="anonymousResponses" className="text-sm font-normal">
                    匿名投票（MVP 不提供实名名单；后续导出/公示可隐藏身份）
                  </Label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox
                    id="visibleAll"
                    checked={visibleAll}
                    disabled={!editable}
                    onCheckedChange={(v) => {
                      const next = v === true;
                      setVisibleAll(next);
                      if (next) setSelected(createEmptySelectedScopes());
                    }}
                  />
                  <Label htmlFor="visibleAll" className="text-sm font-normal">
                    全员可见
                  </Label>
                  {!visibleAll ? <span className="text-xs text-muted-foreground">（role/department/position 任一命中即可见，OR 逻辑）</span> : null}
                </div>

                {!visibleAll ? <VisibilityScopeSelector options={scopeOptionsQuery.options} selected={selected} setSelected={setSelected} disabled={!editable} /> : null}

                <div className="grid gap-2">
                  <Label>投票说明（Markdown，可选）</Label>
                  <NoticeEditor value={descriptionMd} onChange={setDescriptionMd} placeholder="可选：说明投票背景、规则与注意事项…" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="text-base font-semibold">题目与候选项</div>
                    <div className="text-sm text-muted-foreground">支持多题；单选/多选；多选支持 maxChoices。</div>
                  </div>
                  {editable ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setQuestions((prev) =>
                          normalizeSorts([
                            ...prev,
                            {
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
                            },
                          ]),
                        );
                      }}
                    >
                      新增题目
                    </Button>
                  ) : null}
                </div>

                {questions.length === 0 ? <div className="text-sm text-muted-foreground">暂无题目</div> : null}

                <div className="space-y-3">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="space-y-3 rounded-xl border border-border bg-muted p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">第 {idx + 1} 题</div>
                        {editable ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                              disabled={idx === 0}
                              onClick={() => {
                                setQuestions((prev) => {
                                  const next = prev.slice();
                                  const t = next[idx - 1]!;
                                  next[idx - 1] = next[idx]!;
                                  next[idx] = t;
                                  return normalizeSorts(next);
                                });
                              }}
                            >
                              上移
                            </button>
                            <button
                              type="button"
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                              disabled={idx === questions.length - 1}
                              onClick={() => {
                                setQuestions((prev) => {
                                  const next = prev.slice();
                                  const t = next[idx + 1]!;
                                  next[idx + 1] = next[idx]!;
                                  next[idx] = t;
                                  return normalizeSorts(next);
                                });
                              }}
                            >
                              下移
                            </button>
                            <button
                              type="button"
                              className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "h-8 px-2 text-xs")}
                              disabled={questions.length <= 1}
                              onClick={() => {
                                if (!confirm("确认删除该题目？")) return;
                                setQuestions((prev) => normalizeSorts(prev.filter((x) => x.id !== q.id)));
                              }}
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
                            disabled={!editable}
                            onChange={(e) => {
                              const value = e.target.value;
                              setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, title: value } : x)));
                            }}
                            maxLength={200}
                          />
                        </div>

                        <div className="md:col-span-4">
                          <Label className="text-xs">题型</Label>
                          <Select
                            value={q.questionType}
                            disabled={!editable}
                            onChange={(e) => {
                              const nextType = e.target.value === "multi" ? "multi" : "single";
                              setQuestions((prev) =>
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
                            disabled={!editable}
                            onChange={(e) => {
                              const value = e.target.value;
                              setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, description: value.trim() ? value : null } : x)));
                            }}
                            maxLength={2000}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Label className="text-xs">必答</Label>
                          <div className="mt-2 flex items-center gap-2">
                            <Checkbox
                              checked={q.required}
                              disabled={!editable}
                              onCheckedChange={(v) => setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, required: v === true } : x)))}
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
                              disabled={!editable}
                              onChange={(e) => {
                                const value = Math.trunc(Number(e.target.value));
                                setQuestions((prev) =>
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
                          {editable ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setQuestions((prev) =>
                                  prev.map((x) => {
                                    if (x.id !== q.id) return x;
                                    const next = {
                                      ...x,
                                      options: normalizeSorts([x])[0]!.options.concat({ id: newId(), label: `选项 ${x.options.length + 1}`, sort: x.options.length }),
                                    };
                                    const optionCount = next.options.length;
                                    const maxChoices = next.questionType === "single" ? 1 : Math.min(next.maxChoices, optionCount);
                                    return { ...next, maxChoices };
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
                            <div key={opt.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3">
                              <div className="min-w-0 flex-1">
                                <Input
                                  value={opt.label}
                                  disabled={!editable}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setQuestions((prev) =>
                                      prev.map((x) => {
                                        if (x.id !== q.id) return x;
                                        return { ...x, options: x.options.map((o) => (o.id === opt.id ? { ...o, label: value } : o)) };
                                      }),
                                    );
                                  }}
                                  maxLength={200}
                                />
                              </div>

                              {editable ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                                    disabled={oi === 0}
                                    onClick={() => {
                                      setQuestions((prev) =>
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
                                    disabled={oi === q.options.length - 1}
                                    onClick={() => {
                                      setQuestions((prev) =>
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
                                    disabled={q.options.length <= 2}
                                    onClick={() => {
                                      if (!confirm("确认删除该候选项？")) return;
                                      setQuestions((prev) =>
                                        prev.map((x) => {
                                          if (x.id !== q.id) return x;
                                          const nextOptions = x.options.filter((o) => o.id !== opt.id).map((o, idx2) => ({ ...o, sort: idx2 }));
                                          const maxChoices = x.questionType === "single" ? 1 : Math.min(x.maxChoices, nextOptions.length);
                                          return { ...x, options: nextOptions, maxChoices };
                                        }),
                                      );
                                    }}
                                  >
                                    删除
                                  </button>
                                </div>
                              ) : null}
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-base font-semibold">投票说明（预览）</div>
                {descriptionMd.trim() ? (
                  <div className="mt-3">
                    <NoticeMarkdown contentMd={descriptionMd} />
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted-foreground">无说明</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-6">
                <div className="text-base font-semibold">题目预览</div>
                {normalizeSorts(questions).map((q, idx) => (
                  <div key={q.id} className="rounded-lg border border-border bg-muted p-4">
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ConsoleFormDialog
        open={extendOpen}
        onOpenChange={(open) => {
          if (open) action.reset();
          setExtendOpen(open);
        }}
        title="延期投票"
        description="允许到期后延期；endAt 必须晚于当前结束时间且晚于当前时间。"
        pending={action.pending}
        error={action.error}
        confirmText="确认延期"
        onConfirm={() => void doExtend()}
      >
        <div className="grid gap-1.5">
          <label className="text-sm font-medium">新的结束时间</label>
          <Input type="datetime-local" value={extendEndAtLocal} onChange={(e) => setExtendEndAtLocal(e.target.value)} required />
        </div>
      </ConsoleFormDialog>
    </div>
  );
}
