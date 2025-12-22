"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { VisibilityScopeSelector } from "@/components/console/VisibilityScopeSelector";
import { NoticeEditor } from "@/components/notices/NoticeEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiResponseError } from "@/lib/api/http";
import { createConsoleMaterial, fetchMaterialScopeOptions } from "@/lib/api/console-materials";
import type { MaterialItemInput } from "@/lib/api/console-materials";
import { useVisibilityScopeOptions } from "@/lib/hooks/useVisibilityScopeOptions";
import { createEmptySelectedScopes, selectedScopesToInputs } from "@/lib/ui/visibilityScope";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(date: Date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toIsoOrNull(value: string, name: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} 格式无效`);
  return date.toISOString();
}

function newId() {
  return crypto.randomUUID();
}

export default function NewMaterialPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [noticeId, setNoticeId] = useState(() => searchParams.get("noticeId") ?? "");

  const [dueAtLocal, setDueAtLocal] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalInputValue(d);
  });

  const [maxFilesPerSubmission, setMaxFilesPerSubmission] = useState(10);
  const [visibleAll, setVisibleAll] = useState(true);
  const [selected, setSelected] = useState(createEmptySelectedScopes);

  const [items, setItems] = useState<MaterialItemInput[]>(() => [
    { id: newId(), title: "材料 1", description: null, required: true, sort: 0 },
  ]);

  const linkedToNotice = !!noticeId.trim();
  const scopeOptionsQuery = useVisibilityScopeOptions(fetchMaterialScopeOptions, { enabled: !visibleAll && !linkedToNotice });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopes = useMemo(() => {
    return selectedScopesToInputs(selected);
  }, [selected]);

  async function create() {
    setError(null);
    setLoading(true);
    try {
      const normalizedItems = items
        .filter((i) => i.title.trim())
        .map((i, idx) => ({ ...i, title: i.title.trim(), description: i.description?.trim() ? i.description.trim() : null, sort: idx }));

      const res = await createConsoleMaterial({
        title,
        descriptionMd,
        noticeId: linkedToNotice ? noticeId.trim() : null,
        visibleAll: linkedToNotice ? true : visibleAll,
        scopes: linkedToNotice ? [] : scopes,
        maxFilesPerSubmission,
        dueAt: toIsoOrNull(dueAtLocal, "截止时间"),
        items: normalizedItems,
      });

      router.push(`/console/materials/${res.id}/edit`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiResponseError ? err.message : err instanceof Error ? err.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">新建材料收集任务</h1>
          <p className="text-sm text-muted-foreground">草稿可编辑材料项与模板；发布后锁定结构（可改截止）。</p>
        </div>
        <Link className="text-sm text-muted-foreground hover:text-foreground" href="/console/materials">
          ← 返回
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-1.5">
            <Label>标题</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </div>

          <div className="grid gap-1.5">
            <Label>关联公告（可选）</Label>
            <Input
              value={noticeId}
              onChange={(e) => setNoticeId(e.target.value)}
              placeholder="填写公告 ID（UUID），或从公告编辑页进入此页面自动带入"
              disabled={!!searchParams.get("noticeId")}
            />
            {linkedToNotice ? <div className="text-xs text-muted-foreground">已关联公告：可见范围将继承公告设置，任务自身可见范围不生效。</div> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>截止时间（发布必填）</Label>
              <Input type="datetime-local" value={dueAtLocal} onChange={(e) => setDueAtLocal(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label>每次提交最多文件数</Label>
              <Select
                value={String(maxFilesPerSubmission)}
                onChange={(e) => setMaxFilesPerSubmission(Number(e.target.value))}
              >
                {[5, 10, 20, 30, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} 个
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Checkbox id="visibleAll" checked={visibleAll} disabled={linkedToNotice} onCheckedChange={(v) => setVisibleAll(v === true)} />
            <Label htmlFor="visibleAll" className="text-sm font-normal">
              全员可见
            </Label>
            {!visibleAll && !linkedToNotice ? <span className="text-xs text-muted-foreground">（role/department/position 任一命中即可见）</span> : null}
          </div>

          {!visibleAll && !linkedToNotice ? (
            <div className="space-y-2">
              <VisibilityScopeSelector options={scopeOptionsQuery.options} selected={selected} setSelected={setSelected} />
              {scopeOptionsQuery.error ? <div className="text-sm text-destructive">{scopeOptionsQuery.error}</div> : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>说明（可选）</Label>
            <div className="rounded-lg border border-input">
              <NoticeEditor value={descriptionMd} onChange={setDescriptionMd} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium">材料项</div>
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() =>
                  setItems((prev) => [...prev, { id: newId(), title: `材料 ${prev.length + 1}`, description: null, required: false, sort: prev.length }])
                }
              >
                添加材料项
              </Button>
            </div>

            {items.length === 0 ? <div className="text-sm text-muted-foreground">至少需要 1 个材料项（发布前校验）。</div> : null}

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={it.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid gap-1.5">
                        <Label>标题</Label>
                        <Input
                          value={it.title}
                          onChange={(e) =>
                            setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))
                          }
                          maxLength={200}
                          required
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <Label>说明（可选）</Label>
                        <Input
                          value={it.description ?? ""}
                          onChange={(e) =>
                            setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, description: e.target.value } : x)))
                          }
                          maxLength={2000}
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`${it.id}-required`}
                          checked={it.required}
                          onCheckedChange={(v) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, required: v === true } : x)))}
                        />
                        <Label htmlFor={`${it.id}-required`} className="text-sm font-normal">
                          必交
                        </Label>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading || items.length <= 1}
                      onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id).map((x, i) => ({ ...x, sort: i })))}
                    >
                      移除
                    </Button>
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground">排序：{idx + 1}</div>
                </div>
              ))}
            </div>
          </div>

          <InlineError message={error} />

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button size="sm" disabled={loading} onClick={() => void create()}>
              {loading ? "处理中..." : "创建草稿"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
