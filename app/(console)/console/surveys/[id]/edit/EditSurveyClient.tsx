"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { NoticeEditor } from "@/components/notices/NoticeEditor";
import { DepartmentTreeSelector } from "@/components/organization/DepartmentTreeSelector";
import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiResponseError } from "@/lib/api/http";
import {
  closeConsoleSurvey,
  fetchConsoleSurveyDetail,
  fetchSurveyScopeOptions,
  publishConsoleSurvey,
  updateConsoleSurveyDraft,
} from "@/lib/api/console-surveys";
import type { ScopeType, SurveyQuestionType, SurveyScopeInput, SurveySection } from "@/lib/api/surveys";
import { cn } from "@/lib/utils";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  surveyId: string;
  perms: {
    canUpdate: boolean;
    canPublish: boolean;
    canClose: boolean;
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

function ensureChoiceOptions(section: SurveySection, questionId: string) {
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

function normalizeSorts(sections: SurveySection[]) {
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

export default function EditSurveyClient(props: Props) {
  const id = props.surveyId;
  const router = useRouter();
  const action = useAsyncAction();

  const [loading, setLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [startAtLocal, setStartAtLocal] = useState("");
  const [endAtLocal, setEndAtLocal] = useState("");
  const [anonymousResponses, setAnonymousResponses] = useState(false);
  const [visibleAll, setVisibleAll] = useState(true);
  const [selected, setSelected] = useState<Record<ScopeType, Set<string>>>({
    role: new Set(),
    department: new Set(),
    position: new Set(),
  });
  const [sections, setSections] = useState<SurveySection[]>([]);
  const [status, setStatus] = useState<"draft" | "published" | "closed">("draft");
  const [effectiveStatus, setEffectiveStatus] = useState<"draft" | "published" | "closed">("draft");
  const [scopeOptions, setScopeOptions] = useState<Awaited<ReturnType<typeof fetchSurveyScopeOptions>> | null>(null);

  const editable = status === "draft" && props.perms.canUpdate;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setDetailError(null);
      try {
        const [detail, options] = await Promise.all([
          fetchConsoleSurveyDetail(id),
          fetchSurveyScopeOptions().catch(() => null),
        ]);
        if (cancelled) return;

        setTitle(detail.title);
        setDescriptionMd(detail.descriptionMd ?? "");
        setStartAtLocal(toLocalInputValue(detail.startAt));
        setEndAtLocal(toLocalInputValue(detail.endAt));
        setAnonymousResponses(detail.anonymousResponses);
        setVisibleAll(detail.visibleAll);
        setStatus(detail.status);
        setEffectiveStatus(detail.effectiveStatus);
        setSections(normalizeSorts(detail.sections));

        const nextSelected: Record<ScopeType, Set<string>> = {
          role: new Set(),
          department: new Set(),
          position: new Set(),
        };
        for (const s of detail.scopes) nextSelected[s.scopeType].add(s.refId);
        setSelected(nextSelected);

        if (options) setScopeOptions(options);
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
    const items: SurveyScopeInput[] = [];
    for (const refId of selected.role) items.push({ scopeType: "role", refId });
    for (const refId of selected.department) items.push({ scopeType: "department", refId });
    for (const refId of selected.position) items.push({ scopeType: "position", refId });
    return items;
  }, [selected]);

  const departmentItems = useMemo(() => {
    if (!scopeOptions) return [];
    return scopeOptions.departments.map((d) => ({
      id: d.id,
      name: d.name,
      parentId: d.parentId ?? null,
      sort: 0,
    }));
  }, [scopeOptions]);

  async function saveDraft() {
    action.reset();
    try {
      const body = {
        title,
        descriptionMd,
        startAt: toIso(startAtLocal, "开始时间"),
        endAt: toIso(endAtLocal, "结束时间"),
        anonymousResponses,
        visibleAll,
        scopes,
        sections: normalizeSorts(sections),
      };

      const res = await action.run(() => updateConsoleSurveyDraft(id, body), { fallbackErrorMessage: "保存失败" });
      if (!res) return;
      setStatus(res.status);
      setEffectiveStatus(res.effectiveStatus);
      setSections(normalizeSorts(res.sections));
      router.refresh();
    } catch (err) {
      action.setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function doPublish() {
    const res = await action.run(() => publishConsoleSurvey(id), { fallbackErrorMessage: "发布失败" });
    if (!res) return;
    setStatus(res.status);
    setEffectiveStatus(res.effectiveStatus);
    router.refresh();
  }

  async function doClose() {
    const res = await action.run(() => closeConsoleSurvey(id), { fallbackErrorMessage: "关闭失败" });
    if (!res) return;
    setStatus(res.status);
    setEffectiveStatus(res.effectiveStatus);
    router.refresh();
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载中...</div>;
  }
  if (detailError) {
    return (
      <div className="space-y-3">
        <InlineError message={detailError} />
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/surveys">
          返回列表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">编辑问卷</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={status === "draft" ? "secondary" : "outline"}>状态：{status === "draft" ? "草稿" : status === "published" ? "已发布" : "已结束"}</Badge>
            {effectiveStatus !== status ? <Badge variant="outline">有效状态：{effectiveStatus === "closed" ? "已结束" : effectiveStatus}</Badge> : null}
            {!editable ? <Badge variant="secondary">结构只读</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/surveys">
            ← 返回列表
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/surveys/${id}/results`}>
            查看结果
          </Link>

          {effectiveStatus === "published" && props.perms.canClose ? (
            <Button size="sm" variant="outline" disabled={action.pending} onClick={() => void doClose()}>
              关闭
            </Button>
          ) : null}
          {status === "draft" && props.perms.canPublish ? (
            <Button size="sm" disabled={action.pending} onClick={() => void doPublish()}>
              发布
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
                    匿名答卷（管理端结果/导出/AI 总结不显示答题人身份）
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
                      if (next) {
                        setSelected({ role: new Set(), department: new Set(), position: new Set() });
                      }
                    }}
                  />
                  <Label htmlFor="visibleAll" className="text-sm font-normal">
                    全员可见
                  </Label>
                  {!visibleAll ? <span className="text-xs text-muted-foreground">（role/department/position 任一命中即可见，OR 逻辑）</span> : null}
                </div>

                {!visibleAll ? (
                  <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
                    <div className="text-sm font-medium">可见范围</div>
                    {!scopeOptions ? (
                      <div className="text-sm text-muted-foreground">加载中...</div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">角色</div>
                          <ScrollArea className="h-56 rounded-md border border-border bg-background">
                            <div className="space-y-1 p-2">
                              {scopeOptions.roles.map((r) => (
                                <label key={r.id} className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={selected.role.has(r.id)}
                                    disabled={!editable}
                                    onCheckedChange={(v) => {
                                      setSelected((prev) => {
                                        const next = { ...prev, role: new Set(prev.role) };
                                        if (v === true) next.role.add(r.id);
                                        else next.role.delete(r.id);
                                        return next;
                                      });
                                    }}
                                  />
                                  <span className="truncate">{r.name}</span>
                                </label>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">部门</div>
                          {departmentItems.length === 0 ? (
                            <div className="text-sm text-muted-foreground">暂无部门</div>
                          ) : (
                            <DepartmentTreeSelector
                              departments={departmentItems}
                              value={[...selected.department]}
                              onChange={(nextIds) => {
                                if (!editable) return;
                                setSelected((prev) => ({ ...prev, department: new Set(nextIds) }));
                              }}
                              maxHeight={224}
                            />
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">岗位</div>
                          {scopeOptions.positions.length === 0 ? (
                            <div className="text-sm text-muted-foreground">暂无岗位</div>
                          ) : (
                            <ScrollArea className="h-56 rounded-md border border-border bg-background">
                              <div className="space-y-1 p-2">
                                {scopeOptions.positions.map((p) => (
                                  <label key={p.id} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={selected.position.has(p.id)}
                                      disabled={!editable}
                                      onCheckedChange={(v) => {
                                        setSelected((prev) => {
                                          const next = { ...prev, position: new Set(prev.position) };
                                          if (v === true) next.position.add(p.id);
                                          else next.position.delete(p.id);
                                          return next;
                                        });
                                      }}
                                    />
                                    <span className="truncate">{p.name}</span>
                                  </label>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label>说明（Markdown，可选）</Label>
                  <div className="rounded-lg border border-input">
                    <NoticeEditor value={descriptionMd} onChange={setDescriptionMd} height="360px" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <Button disabled={!editable || action.pending} onClick={() => void saveDraft()}>
                    {action.pending ? "保存中..." : "保存草稿"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-base font-semibold">分节与题目</div>
                    <div className="text-sm text-muted-foreground">支持上下移动排序；发布后锁定结构。</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!editable}
                    onClick={() => {
                      setSections((prev) =>
                        normalizeSorts([
                          ...prev,
                          { id: newId(), title: `第 ${prev.length + 1} 部分`, sort: prev.length, questions: [] },
                        ]),
                      );
                    }}
                  >
                    添加分节
                  </Button>
                </div>

                <div className="space-y-4">
                  {sections.map((section, sectionIndex) => (
                    <div key={section.id} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="grid gap-1.5">
                          <Label>分节标题</Label>
                          <Input
                            value={section.title}
                            disabled={!editable}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSections((prev) =>
                                prev.map((s) => (s.id === section.id ? { ...s, title: value } : s)),
                              );
                            }}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                            disabled={!editable || sectionIndex === 0}
                            onClick={() => {
                              setSections((prev) => {
                                const next = prev.slice();
                                [next[sectionIndex - 1], next[sectionIndex]] = [next[sectionIndex], next[sectionIndex - 1]];
                                return normalizeSorts(next);
                              });
                            }}
                          >
                            上移
                          </button>
                          <button
                            type="button"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                            disabled={!editable || sectionIndex >= sections.length - 1}
                            onClick={() => {
                              setSections((prev) => {
                                const next = prev.slice();
                                [next[sectionIndex], next[sectionIndex + 1]] = [next[sectionIndex + 1], next[sectionIndex]];
                                return normalizeSorts(next);
                              });
                            }}
                          >
                            下移
                          </button>

                          <button
                            type="button"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                            disabled={!editable}
                            onClick={() => {
                              setSections((prev) =>
                                normalizeSorts(
                                  prev.map((s) =>
                                    s.id !== section.id
                                      ? s
                                      : {
                                          ...s,
                                          questions: normalizeSorts([
                                            {
                                              id: s.id,
                                              title: s.title,
                                              sort: s.sort,
                                              questions: [
                                                ...s.questions,
                                                {
                                                  id: newId(),
                                                  sectionId: s.id,
                                                  questionType: "text",
                                                  title: "未命名问题",
                                                  description: null,
                                                  required: false,
                                                  sort: s.questions.length,
                                                  options: [],
                                                },
                                              ],
                                            },
                                          ])[0]!.questions,
                                        },
                                  ),
                                ),
                              );
                            }}
                          >
                            添加题目
                          </button>

                          <button
                            type="button"
                            className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "h-8 px-2 text-xs")}
                            disabled={!editable || sections.length <= 1}
                            onClick={() => {
                              if (!confirm("确认删除该分节？该分节下的题目将一并删除。")) return;
                              setSections((prev) => normalizeSorts(prev.filter((s) => s.id !== section.id)));
                            }}
                          >
                            删除分节
                          </button>
                        </div>
                      </div>

                      {section.questions.length === 0 ? (
                        <div className="mt-4 text-sm text-muted-foreground">暂无题目</div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {section.questions.map((q, questionIndex) => (
                            <div key={q.id} className="space-y-3 rounded-lg border border-border bg-muted p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="grid gap-1.5">
                                  <Label>题目</Label>
                                  <Input
                                    value={q.title}
                                    disabled={!editable}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setSections((prev) =>
                                        normalizeSorts(
                                          prev.map((s) =>
                                            s.id !== section.id
                                              ? s
                                              : {
                                                  ...s,
                                                  questions: s.questions.map((qq) => (qq.id === q.id ? { ...qq, title: value } : qq)),
                                                },
                                          ),
                                        ),
                                      );
                                    }}
                                  />
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                                    disabled={!editable || questionIndex === 0}
                                    onClick={() => {
                                      setSections((prev) =>
                                        normalizeSorts(
                                          prev.map((s) => {
                                            if (s.id !== section.id) return s;
                                            const nextQs = s.questions.slice();
                                            [nextQs[questionIndex - 1], nextQs[questionIndex]] = [nextQs[questionIndex], nextQs[questionIndex - 1]];
                                            return { ...s, questions: nextQs };
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
                                    disabled={!editable || questionIndex >= section.questions.length - 1}
                                    onClick={() => {
                                      setSections((prev) =>
                                        normalizeSorts(
                                          prev.map((s) => {
                                            if (s.id !== section.id) return s;
                                            const nextQs = s.questions.slice();
                                            [nextQs[questionIndex], nextQs[questionIndex + 1]] = [nextQs[questionIndex + 1], nextQs[questionIndex]];
                                            return { ...s, questions: nextQs };
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
                                    disabled={!editable}
                                    onClick={() => {
                                      if (!confirm("确认删除该题目？")) return;
                                      setSections((prev) =>
                                        normalizeSorts(
                                          prev.map((s) =>
                                            s.id !== section.id ? s : { ...s, questions: s.questions.filter((qq) => qq.id !== q.id) },
                                          ),
                                        ),
                                      );
                                    }}
                                  >
                                    删除
                                  </button>
                                </div>
                              </div>

                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="grid gap-1.5 md:col-span-1">
                                  <Label>题型</Label>
                                  <Select
                                    value={q.questionType}
                                    disabled={!editable}
                                    onChange={(e) => {
                                      const nextType = e.target.value as SurveyQuestionType;
                                      setSections((prev) =>
                                        normalizeSorts(
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
                                    disabled={!editable}
                                    onCheckedChange={(v) => {
                                      setSections((prev) =>
                                        normalizeSorts(
                                          prev.map((s) =>
                                            s.id !== section.id
                                              ? s
                                              : {
                                                  ...s,
                                                  questions: s.questions.map((qq) => (qq.id === q.id ? { ...qq, required: v === true } : qq)),
                                                },
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
                                  disabled={!editable}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setSections((prev) =>
                                      normalizeSorts(
                                        prev.map((s) =>
                                          s.id !== section.id
                                            ? s
                                            : {
                                                ...s,
                                                questions: s.questions.map((qq) => (qq.id === q.id ? { ...qq, description: value } : qq)),
                                              },
                                        ),
                                      ),
                                    );
                                  }}
                                  placeholder="（可选）用于提示填写规则"
                                />
                              </div>

                              {q.questionType === "single" || q.questionType === "multi" ? (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <Label>选项</Label>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!editable}
                                      onClick={() => {
                                        setSections((prev) =>
                                          normalizeSorts(
                                            prev.map((s) => {
                                              if (s.id !== section.id) return s;
                                              return {
                                                ...s,
                                                questions: s.questions.map((qq) =>
                                                  qq.id !== q.id
                                                    ? qq
                                                    : {
                                                        ...qq,
                                                        options: [...(qq.options ?? []), { id: newId(), label: `选项 ${(qq.options?.length ?? 0) + 1}`, sort: qq.options?.length ?? 0 }],
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
                                  </div>

                                  <div className="space-y-2">
                                    {(q.options ?? []).map((opt, optIndex) => (
                                      <div key={opt.id} className="flex flex-wrap items-center gap-2">
                                        <Input
                                          value={opt.label}
                                          disabled={!editable}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setSections((prev) =>
                                              normalizeSorts(
                                                prev.map((s) => {
                                                  if (s.id !== section.id) return s;
                                                  return {
                                                    ...s,
                                                    questions: s.questions.map((qq) =>
                                                      qq.id !== q.id
                                                        ? qq
                                                        : {
                                                            ...qq,
                                                            options: (qq.options ?? []).map((oo) => (oo.id === opt.id ? { ...oo, label: value } : oo)),
                                                          },
                                                    ),
                                                  };
                                                }),
                                              ),
                                            );
                                          }}
                                          className="flex-1"
                                        />

                                        <button
                                          type="button"
                                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                                          disabled={!editable || optIndex === 0}
                                          onClick={() => {
                                            setSections((prev) =>
                                              normalizeSorts(
                                                prev.map((s) => {
                                                  if (s.id !== section.id) return s;
                                                  return {
                                                    ...s,
                                                    questions: s.questions.map((qq) => {
                                                      if (qq.id !== q.id) return qq;
                                                      const next = (qq.options ?? []).slice();
                                                      [next[optIndex - 1], next[optIndex]] = [next[optIndex], next[optIndex - 1]];
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
                                          disabled={!editable || optIndex >= (q.options?.length ?? 0) - 1}
                                          onClick={() => {
                                            setSections((prev) =>
                                              normalizeSorts(
                                                prev.map((s) => {
                                                  if (s.id !== section.id) return s;
                                                  return {
                                                    ...s,
                                                    questions: s.questions.map((qq) => {
                                                      if (qq.id !== q.id) return qq;
                                                      const next = (qq.options ?? []).slice();
                                                      [next[optIndex], next[optIndex + 1]] = [next[optIndex + 1], next[optIndex]];
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
                                          disabled={!editable || (q.options?.length ?? 0) <= 2}
                                          onClick={() => {
                                            if (!confirm("确认删除该选项？")) return;
                                            setSections((prev) =>
                                              normalizeSorts(
                                                prev.map((s) => {
                                                  if (s.id !== section.id) return s;
                                                  return {
                                                    ...s,
                                                    questions: s.questions.map((qq) =>
                                                      qq.id !== q.id ? qq : { ...qq, options: (qq.options ?? []).filter((oo) => oo.id !== opt.id) },
                                                    ),
                                                  };
                                                }),
                                              ),
                                            );
                                          }}
                                        >
                                          删除
                                        </button>
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
                  ))}
                </div>

                <div className="flex items-center justify-end gap-3">
                  <Button disabled={!editable || action.pending} onClick={() => void saveDraft()}>
                    {action.pending ? "保存中..." : "保存草稿"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="space-y-1">
                <div className="text-base font-semibold">预览（只读）</div>
                <div className="text-sm text-muted-foreground">展示口径接近 Portal，实际以发布后效果为准。</div>
              </div>

              <div className="space-y-3">
                {normalizeSorts(sections).map((section) => (
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
                              {q.questionType === "text" ? "文本输入" : q.questionType === "single" ? "单选" : q.questionType === "multi" ? "多选" : "评分（1-5）"}
                              {q.questionType === "single" || q.questionType === "multi" ? ` · 选项 ${q.options.length} 个` : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
