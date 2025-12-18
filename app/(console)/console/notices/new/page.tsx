"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { NoticeEditor } from "@/components/notices/NoticeEditor";
import { DepartmentTreeSelector } from "@/components/organization/DepartmentTreeSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApiResponseError } from "@/lib/api/http";
import { createConsoleNotice, fetchNoticeScopeOptions } from "@/lib/api/notices";
import type { NoticeScopeInput, NoticeScopeOptionsResponse, ScopeType } from "@/lib/api/notices";

type ScopeOptions = NoticeScopeOptionsResponse;

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
  const [selected, setSelected] = useState<Record<ScopeType, Set<string>>>({
    role: new Set(),
    department: new Set(),
    position: new Set(),
  });
  const [options, setOptions] = useState<ScopeOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      try {
        const data = await fetchNoticeScopeOptions();
        if (cancelled) return;
        setOptions(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiResponseError ? err.message : "加载可见范围选项失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scopes = useMemo(() => {
    const items: NoticeScopeInput[] = [];
    for (const refId of selected.role) items.push({ scopeType: "role", refId });
    for (const refId of selected.department) items.push({ scopeType: "department", refId });
    for (const refId of selected.position) items.push({ scopeType: "position", refId });
    return items;
  }, [selected]);

  const departmentItems = useMemo(() => {
    if (!options) return [];
    return options.departments.map((d) => ({
      id: d.id,
      name: d.name,
      parentId: d.parentId ?? null,
      sort: 0,
    }));
  }, [options]);

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
            <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
              <div className="text-sm font-medium">可见范围</div>
              {!options ? (
                <div className="text-sm text-muted-foreground">加载中...</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">角色</div>
                    <ScrollArea className="h-56 rounded-md border border-border bg-background">
                      <div className="space-y-1 p-2">
                        {options.roles.map((r) => (
                          <label key={r.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selected.role.has(r.id)}
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
                          setSelected((prev) => ({ ...prev, department: new Set(nextIds) }));
                        }}
                        maxHeight={224}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">岗位</div>
                    {options.positions.length === 0 ? (
                      <div className="text-sm text-muted-foreground">暂无岗位</div>
                    ) : (
                      <ScrollArea className="h-56 rounded-md border border-border bg-background">
                        <div className="space-y-1 p-2">
                          {options.positions.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={selected.position.has(p.id)}
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
