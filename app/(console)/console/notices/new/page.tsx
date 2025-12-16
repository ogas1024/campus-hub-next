"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { NoticeEditor } from "@/components/notices/NoticeEditor";
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">新建公告</h1>
          <p className="text-sm text-zinc-600">编辑为所见即所得；落库为 Markdown（保存时会校验不含内联 HTML）。</p>
        </div>
        <Link className="text-sm text-zinc-600 hover:text-zinc-900" href="/console/notices">
          ← 返回
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">标题</label>
            <input
              className="h-10 w-full rounded-lg border border-zinc-200 px-3 outline-none focus:border-zinc-400"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">有效期（可选）</label>
            <input
              className="h-10 w-full rounded-lg border border-zinc-200 px-3 outline-none focus:border-zinc-400"
              type="datetime-local"
              value={expireAtLocal}
              onChange={(e) => setExpireAtLocal(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="visibleAll"
              type="checkbox"
              checked={visibleAll}
              onChange={(e) => setVisibleAll(e.target.checked)}
            />
            <label htmlFor="visibleAll" className="text-sm">
              全员可见
            </label>
            {!visibleAll ? <span className="text-xs text-zinc-600">（role/department/position 任一命中即可见，OR 逻辑）</span> : null}
          </div>

          {!visibleAll ? (
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-medium">可见范围</div>
              {!options ? (
                <div className="text-sm text-zinc-600">加载中...</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-zinc-600">角色</div>
                    <div className="space-y-1">
                      {options.roles.map((r) => (
                        <label key={r.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selected.role.has(r.id)}
                            onChange={(e) => {
                              setSelected((prev) => {
                                const next = { ...prev, role: new Set(prev.role) };
                                if (e.target.checked) next.role.add(r.id);
                                else next.role.delete(r.id);
                                return next;
                              });
                            }}
                          />
                          <span className="truncate">{r.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-zinc-600">部门</div>
                    <div className="space-y-1">
                      {options.departments.length === 0 ? (
                        <div className="text-sm text-zinc-600">暂无部门</div>
                      ) : (
                        options.departments.map((d) => (
                          <label key={d.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.department.has(d.id)}
                              onChange={(e) => {
                                setSelected((prev) => {
                                  const next = { ...prev, department: new Set(prev.department) };
                                  if (e.target.checked) next.department.add(d.id);
                                  else next.department.delete(d.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="truncate">{d.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-zinc-600">岗位</div>
                    <div className="space-y-1">
                      {options.positions.length === 0 ? (
                        <div className="text-sm text-zinc-600">暂无岗位</div>
                      ) : (
                        options.positions.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.position.has(p.id)}
                              onChange={(e) => {
                                setSelected((prev) => {
                                  const next = { ...prev, position: new Set(prev.position) };
                                  if (e.target.checked) next.position.add(p.id);
                                  else next.position.delete(p.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="truncate">{p.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium">正文</label>
            <div className="rounded-lg border border-zinc-200">
              <NoticeEditor value={contentMd} onChange={setContentMd} />
            </div>
          </div>

          {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          <div className="flex items-center justify-end gap-3">
            <button
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
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
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
