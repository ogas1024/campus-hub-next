"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { NoticeEditor } from "@/components/notices/NoticeEditor";

type ScopeType = "role" | "department" | "position";
type ScopeOption = { id: string; name: string; parentId?: string | null; code?: string };

type ScopeOptions = {
  roles: ScopeOption[];
  departments: ScopeOption[];
  positions: ScopeOption[];
};

type Attachment = {
  fileKey: string;
  fileName: string;
  contentType: string;
  size: number;
  sort: number;
};

type NoticeDetailResponse = {
  title: string;
  contentMd: string;
  status: string;
  pinned: boolean;
  visibleAll: boolean;
  expireAt: string | null;
  isExpired: boolean;
  createdBy: string;
  scopes: { scopeType: ScopeType; refId: string }[];
  attachments: { fileKey: string; fileName: string; contentType: string; size: number; sort?: number }[];
};

type Props = {
  noticeId: string;
  currentUserId: string;
  perms: {
    canUpdate: boolean;
    canDelete: boolean;
    canPin: boolean;
    canPublish: boolean;
    canManageAll: boolean;
  };
};

function toIsoOrUndefined(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function statusLabel(status: string) {
  switch (status) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "retracted":
      return "已撤回";
    default:
      return status;
  }
}

export default function EditNoticeClient({ noticeId, currentUserId, perms }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [expireAtLocal, setExpireAtLocal] = useState("");
  const [visibleAll, setVisibleAll] = useState(true);
  const [status, setStatus] = useState<string>("draft");
  const [pinned, setPinned] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [createdBy, setCreatedBy] = useState<string>("");

  const [selected, setSelected] = useState<Record<ScopeType, Set<string>>>({
    role: new Set(),
    department: new Set(),
    position: new Set(),
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [options, setOptions] = useState<ScopeOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canOperate = perms.canManageAll || (!!createdBy && createdBy === currentUserId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [detailRes, optionsRes] = await Promise.all([
        fetch(`/api/console/notices/${noticeId}`),
        fetch("/api/console/notices/scope-options"),
      ]);

      const detailJson = await detailRes.json();
      const optionsJson = await optionsRes.json();
      if (cancelled) return;

      if (!detailRes.ok) {
        setError(detailJson?.error?.message ?? "加载失败");
        return;
      }

      const detail = detailJson as NoticeDetailResponse;

      setTitle(detail.title);
      setContentMd(detail.contentMd);
      setStatus(detail.status);
      setPinned(!!detail.pinned);
      setVisibleAll(!!detail.visibleAll);
      setIsExpired(!!detail.isExpired);
      setCreatedBy(detail.createdBy);
      setExpireAtLocal(detail.expireAt ? new Date(detail.expireAt).toISOString().slice(0, 16) : "");
      setAttachments(
        (detail.attachments ?? []).map((a) => ({
          fileKey: a.fileKey,
          fileName: a.fileName,
          contentType: a.contentType,
          size: a.size,
          sort: a.sort ?? 0,
        })),
      );

      const nextSelected: Record<ScopeType, Set<string>> = {
        role: new Set(),
        department: new Set(),
        position: new Set(),
      };
      for (const s of detail.scopes ?? []) {
        if (s.scopeType === "role") nextSelected.role.add(s.refId);
        if (s.scopeType === "department") nextSelected.department.add(s.refId);
        if (s.scopeType === "position") nextSelected.position.add(s.refId);
      }
      setSelected(nextSelected);

      if (optionsRes.ok) setOptions(optionsJson as ScopeOptions);
    })();

    return () => {
      cancelled = true;
    };
  }, [noticeId]);

  const scopes = useMemo(() => {
    const items: { scopeType: ScopeType; refId: string }[] = [];
    for (const refId of selected.role) items.push({ scopeType: "role", refId });
    for (const refId of selected.department) items.push({ scopeType: "department", refId });
    for (const refId of selected.position) items.push({ scopeType: "position", refId });
    return items;
  }, [selected]);

  async function save() {
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/console/notices/${noticeId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        contentMd,
        expireAt: toIsoOrUndefined(expireAtLocal),
        visibleAll,
        scopes,
        attachments,
      }),
    });

    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "保存失败");
      return;
    }

    setStatus(json.status);
    setPinned(!!json.pinned);
    setIsExpired(!!json.isExpired);
    router.refresh();
  }

  async function callAction(path: string, body?: unknown) {
    setError(null);
    setLoading(true);

    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "操作失败");
      return;
    }
    setStatus(json.status);
    setPinned(!!json.pinned);
    setIsExpired(!!json.isExpired);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">公告详情</h1>
          <p className="text-sm text-zinc-600">
            状态：<span className="font-medium text-zinc-900">{statusLabel(status)}</span> · 置顶：{pinned ? "是" : "否"}
          </p>
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
              className="h-10 w-full rounded-lg border border-zinc-200 px-3 outline-none focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              disabled={!perms.canUpdate || !canOperate}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">有效期（可选）</label>
            <input
              className="h-10 w-full rounded-lg border border-zinc-200 px-3 outline-none focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"
              type="datetime-local"
              value={expireAtLocal}
              onChange={(e) => setExpireAtLocal(e.target.value)}
              disabled={!perms.canUpdate || !canOperate}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="visibleAll"
              type="checkbox"
              checked={visibleAll}
              onChange={(e) => setVisibleAll(e.target.checked)}
              disabled={!perms.canUpdate || !canOperate}
            />
            <label htmlFor="visibleAll" className="text-sm">
              全员可见
            </label>
            {!visibleAll ? <span className="text-xs text-zinc-600">（role/department/position 任一命中即可见）</span> : null}
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
                            disabled={!perms.canUpdate || !canOperate}
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
                            disabled={!perms.canUpdate || !canOperate}
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
                            disabled={!perms.canUpdate || !canOperate}
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

          <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm font-medium">附件</div>
            <input
              type="file"
              disabled={!perms.canUpdate || !canOperate}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setError(null);
                setLoading(true);
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch(`/api/console/notices/${noticeId}/attachments`, { method: "POST", body: formData });
                const json = await res.json();
                setLoading(false);

                if (!res.ok) {
                  setError(json?.error?.message ?? "上传失败");
                  return;
                }

                setAttachments((prev) => [
                  ...prev,
                  {
                    fileKey: json.fileKey,
                    fileName: json.fileName,
                    contentType: json.contentType,
                    size: json.size,
                    sort: prev.length,
                  },
                ]);
                e.target.value = "";
              }}
            />

            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((a, idx) => (
                  <div key={`${a.fileKey}-${idx}`} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{a.fileName}</div>
                      <div className="text-xs text-zinc-500">{Math.ceil(a.size / 1024)} KB</div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-60"
                      disabled={!perms.canUpdate || !canOperate}
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-600">暂无附件（上传后记得点击“保存”以写入数据库记录）</div>
            )}
          </div>

          {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {status === "published" && perms.canPin && canOperate ? (
              <button
                type="button"
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
                disabled={loading || isExpired}
                onClick={() => void callAction(`/api/console/notices/${noticeId}/pin`, { pinned: !pinned })}
              >
                {pinned ? "取消置顶" : "置顶"}
              </button>
            ) : null}

            {status === "published" && perms.canPublish && canOperate ? (
              <button
                type="button"
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
                disabled={loading}
                onClick={() => void callAction(`/api/console/notices/${noticeId}/retract`)}
              >
                撤回
              </button>
            ) : null}

            {status !== "published" && perms.canPublish && canOperate ? (
              <button
                type="button"
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
                disabled={loading}
                onClick={() => void callAction(`/api/console/notices/${noticeId}/publish`)}
              >
                发布
              </button>
            ) : null}

            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              disabled={loading || !perms.canUpdate || !canOperate}
              onClick={() => void save()}
            >
              {loading ? "处理中..." : "保存"}
            </button>

            {perms.canDelete && canOperate ? (
              <button
                type="button"
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                disabled={loading}
                onClick={async () => {
                  if (!confirm("确认删除该公告（软删）？")) return;
                  setError(null);
                  setLoading(true);

                  const res = await fetch(`/api/console/notices/${noticeId}`, { method: "DELETE" });
                  const json = await res.json();
                  setLoading(false);

                  if (!res.ok) {
                    setError(json?.error?.message ?? "删除失败");
                    return;
                  }

                  router.push("/console/notices");
                  router.refresh();
                }}
              >
                删除
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
