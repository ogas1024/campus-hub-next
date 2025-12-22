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
import { createConsoleNotice, fetchNoticeScopeOptions } from "@/lib/api/notices";
import { useVisibilityScopeOptions } from "@/lib/hooks/useVisibilityScopeOptions";
import { createEmptySelectedScopes, selectedScopesToInputs } from "@/lib/ui/visibilityScope";

function toIsoOrUndefined(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export default function NewNoticePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [expireAtLocal, setExpireAtLocal] = useState("");
  const [visibleAll, setVisibleAll] = useState(true);
  const [selected, setSelected] = useState(createEmptySelectedScopes);
  const scopeOptionsQuery = useVisibilityScopeOptions(fetchNoticeScopeOptions, { enabled: !visibleAll });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopes = useMemo(() => {
    return selectedScopesToInputs(selected);
  }, [selected]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">新建公告</h1>
          <p className="text-sm text-muted-foreground">编辑为所见即所得；落库为 Markdown（保存时会校验不含内联 HTML）。</p>
        </div>
        <Link className="text-sm text-muted-foreground hover:text-foreground" href="/console/notices">
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
            <Label>有效期（可选）</Label>
            <Input type="datetime-local" value={expireAtLocal} onChange={(e) => setExpireAtLocal(e.target.value)} />
          </div>

          <div className="flex items-center gap-3">
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
            <Label>正文</Label>
            <div className="rounded-lg border border-input">
              <NoticeEditor value={contentMd} onChange={setContentMd} />
            </div>
          </div>

          {error ? <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

          <div className="flex items-center justify-end gap-3">
            <Button
              disabled={loading}
              onClick={async () => {
                setError(null);
                setLoading(true);

                try {
                  const created = await createConsoleNotice({
                    title,
                    contentMd,
                    expireAt: toIsoOrUndefined(expireAtLocal),
                    visibleAll,
                    scopes,
                    attachments: [],
                  });
                  router.push(`/console/notices/${created.id}/edit`);
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
