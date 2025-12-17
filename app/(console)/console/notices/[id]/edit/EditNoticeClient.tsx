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
import {
  deleteConsoleNotice,
  fetchConsoleNoticeDetail,
  fetchNoticeScopeOptions,
  publishConsoleNotice,
  retractConsoleNotice,
  setConsoleNoticePinned,
  updateConsoleNotice,
  uploadConsoleNoticeAttachment,
} from "@/lib/api/notices";
import type {
  ConsoleNoticeDetail,
  NoticeAttachmentInput,
  NoticeScopeInput,
  NoticeScopeOptionsResponse,
  NoticeStatus,
  ScopeType,
} from "@/lib/api/notices";

type ScopeOptions = NoticeScopeOptionsResponse;

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
  const [status, setStatus] = useState<NoticeStatus>("draft");
  const [pinned, setPinned] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [createdBy, setCreatedBy] = useState<string>("");

  const [selected, setSelected] = useState<Record<ScopeType, Set<string>>>({
    role: new Set(),
    department: new Set(),
    position: new Set(),
  });
  const [attachments, setAttachments] = useState<NoticeAttachmentInput[]>([]);
  const [options, setOptions] = useState<ScopeOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canOperate = perms.canManageAll || (!!createdBy && createdBy === currentUserId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [detailResult, optionsResult] = await Promise.allSettled([
        fetchConsoleNoticeDetail(noticeId),
        fetchNoticeScopeOptions(),
      ]);
      if (cancelled) return;

      if (detailResult.status !== "fulfilled") {
        const message = detailResult.reason instanceof ApiResponseError ? detailResult.reason.message : "加载失败";
        setError(message);
        return;
      }

      const detail: ConsoleNoticeDetail = detailResult.value;

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

      if (optionsResult.status === "fulfilled") setOptions(optionsResult.value);
    })();

    return () => {
      cancelled = true;
    };
  }, [noticeId]);

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

  async function save() {
    setError(null);
    setLoading(true);
    try {
      const updated = await updateConsoleNotice(noticeId, {
        title,
        contentMd,
        expireAt: toIsoOrUndefined(expireAtLocal),
        visibleAll,
        scopes,
        attachments,
      });

      setStatus(updated.status);
      setPinned(!!updated.pinned);
      setIsExpired(!!updated.isExpired);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiResponseError ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: () => Promise<ConsoleNoticeDetail>, fallbackMessage: string) {
    setError(null);
    setLoading(true);
    try {
      const updated = await action();
      setStatus(updated.status);
      setPinned(!!updated.pinned);
      setIsExpired(!!updated.isExpired);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiResponseError ? err.message : fallbackMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">公告详情</h1>
          <p className="text-sm text-muted-foreground">
            状态：<span className="font-medium text-foreground">{statusLabel(status)}</span> · 置顶：{pinned ? "是" : "否"}
          </p>
        </div>
        <Link className="text-sm text-muted-foreground hover:text-foreground" href="/console/notices">
          ← 返回
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-1.5">
            <Label>标题</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              disabled={!perms.canUpdate || !canOperate}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>有效期（可选）</Label>
            <Input
              type="datetime-local"
              value={expireAtLocal}
              onChange={(e) => setExpireAtLocal(e.target.value)}
              disabled={!perms.canUpdate || !canOperate}
            />
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="visibleAll"
              checked={visibleAll}
              disabled={!perms.canUpdate || !canOperate}
              onCheckedChange={(v) => setVisibleAll(v === true)}
            />
            <Label htmlFor="visibleAll" className="text-sm font-normal">
              全员可见
            </Label>
            {!visibleAll ? <span className="text-xs text-muted-foreground">（role/department/position 任一命中即可见）</span> : null}
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
                              disabled={!perms.canUpdate || !canOperate}
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
                        disabled={!perms.canUpdate || !canOperate}
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
                                disabled={!perms.canUpdate || !canOperate}
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

          <div className="space-y-2 rounded-lg border border-border bg-muted p-4">
            <div className="text-sm font-medium">附件</div>
            <Input
              type="file"
              disabled={!perms.canUpdate || !canOperate}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setError(null);
                setLoading(true);
                try {
                  const uploaded = await uploadConsoleNoticeAttachment(noticeId, file);
                  setAttachments((prev) => [
                    ...prev,
                    {
                      fileKey: uploaded.fileKey,
                      fileName: uploaded.fileName,
                      contentType: uploaded.contentType,
                      size: uploaded.size,
                      sort: prev.length,
                    },
                  ]);
                  e.target.value = "";
                } catch (err) {
                  setError(err instanceof ApiResponseError ? err.message : "上传失败");
                } finally {
                  setLoading(false);
                }
              }}
            />

            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((a, idx) => (
                  <div
                    key={`${a.fileKey}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm">{a.fileName}</div>
                      <div className="text-xs text-muted-foreground">{Math.ceil(a.size / 1024)} KB</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!perms.canUpdate || !canOperate}
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      移除
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">暂无附件（上传后记得点击“保存”以写入数据库记录）</div>
            )}
          </div>

          {error ? <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {status === "published" && perms.canPin && canOperate ? (
              <Button
                variant="outline"
                size="sm"
                disabled={loading || isExpired}
                onClick={() => void runAction(() => setConsoleNoticePinned(noticeId, !pinned), "置顶操作失败")}
              >
                {pinned ? "取消置顶" : "置顶"}
              </Button>
            ) : null}

            {status === "published" && perms.canPublish && canOperate ? (
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void runAction(() => retractConsoleNotice(noticeId), "撤回失败")}
              >
                撤回
              </Button>
            ) : null}

            {status !== "published" && perms.canPublish && canOperate ? (
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void runAction(() => publishConsoleNotice(noticeId), "发布失败")}
              >
                发布
              </Button>
            ) : null}

            <Button
              size="sm"
              disabled={loading || !perms.canUpdate || !canOperate}
              onClick={() => void save()}
            >
              {loading ? "处理中..." : "保存"}
            </Button>

            {perms.canDelete && canOperate ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={loading}
                onClick={async () => {
                  if (!confirm("确认删除该公告（软删）？")) return;
                  setError(null);
                  setLoading(true);

                  try {
                    await deleteConsoleNotice(noticeId);
                  } catch (err) {
                    setError(err instanceof ApiResponseError ? err.message : "删除失败");
                    return;
                  } finally {
                    setLoading(false);
                  }

                  router.push("/console/notices");
                  router.refresh();
                }}
              >
                删除
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
