"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { VisibilityScopeSelector } from "@/components/console/VisibilityScopeSelector";
import { NoticeEditor } from "@/components/notices/NoticeEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiResponseError } from "@/lib/api/http";
import { createConsoleSurvey, fetchSurveyScopeOptions } from "@/lib/api/console-surveys";
import { useVisibilityScopeOptions } from "@/lib/hooks/useVisibilityScopeOptions";
import { createEmptySelectedScopes, selectedScopesToInputs } from "@/lib/ui/visibilityScope";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(date: Date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toIso(value: string, name: string) {
  if (!value) throw new Error(`${name} 必填`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} 格式无效`);
  return date.toISOString();
}

export default function NewSurveyPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");

  const [startAtLocal, setStartAtLocal] = useState(() => toLocalInputValue(new Date()));
  const [endAtLocal, setEndAtLocal] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalInputValue(d);
  });

  const [anonymousResponses, setAnonymousResponses] = useState(false);
  const [visibleAll, setVisibleAll] = useState(true);
  const [selected, setSelected] = useState(createEmptySelectedScopes);

  const scopeOptionsQuery = useVisibilityScopeOptions(fetchSurveyScopeOptions, { enabled: !visibleAll });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopes = useMemo(() => {
    return selectedScopesToInputs(selected);
  }, [selected]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">新建问卷</h1>
          <p className="text-sm text-muted-foreground">草稿阶段可编辑分节/题目；发布后锁定结构。</p>
        </div>
        <Link className="text-sm text-muted-foreground hover:text-foreground" href="/console/surveys">
          ← 返回
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-1.5">
            <Label>标题</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>开始时间</Label>
              <Input type="datetime-local" value={startAtLocal} onChange={(e) => setStartAtLocal(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label>结束时间</Label>
              <Input type="datetime-local" value={endAtLocal} onChange={(e) => setEndAtLocal(e.target.value)} required />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Checkbox
              id="anonymousResponses"
              checked={anonymousResponses}
              onCheckedChange={(v) => setAnonymousResponses(v === true)}
            />
            <Label htmlFor="anonymousResponses" className="text-sm font-normal">
              匿名答卷（管理端结果/导出/AI 总结不显示答题人身份）
            </Label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Checkbox
              id="visibleAll"
              checked={visibleAll}
              onCheckedChange={(v) => setVisibleAll(v === true)}
            />
            <Label htmlFor="visibleAll" className="text-sm font-normal">
              全员可见
            </Label>
            {!visibleAll ? <span className="text-xs text-muted-foreground">（role/department/position 任一命中即可见，OR 逻辑）</span> : null}
          </div>

          {!visibleAll ? (
            <div className="space-y-2">
              <VisibilityScopeSelector options={scopeOptionsQuery.options} selected={selected} setSelected={setSelected} />
              {scopeOptionsQuery.error ? <div className="text-sm text-destructive">{scopeOptionsQuery.error}</div> : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>说明（Markdown，可选）</Label>
            <div className="rounded-lg border border-input">
              <NoticeEditor value={descriptionMd} onChange={setDescriptionMd} height="360px" />
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <Button
              disabled={loading}
              onClick={async () => {
                setError(null);
                setLoading(true);

                try {
                  const created = await createConsoleSurvey({
                    title,
                    descriptionMd,
                    startAt: toIso(startAtLocal, "开始时间"),
                    endAt: toIso(endAtLocal, "结束时间"),
                    anonymousResponses,
                    visibleAll,
                    scopes,
                  });
                  router.push(`/console/surveys/${created.id}/edit`);
                } catch (err) {
                  setError(err instanceof ApiResponseError ? err.message : "创建失败");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "创建中..." : "创建并进入编辑"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
