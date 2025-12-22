"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { VisibilityScopeSelector } from "@/components/console/VisibilityScopeSelector";
import { NoticeEditor } from "@/components/notices/NoticeEditor";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiResponseError } from "@/lib/api/http";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { useVisibilityScopeOptions } from "@/lib/hooks/useVisibilityScopeOptions";
import { createEmptySelectedScopes, selectedScopesFromInputs, selectedScopesToInputs } from "@/lib/ui/visibilityScope";
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
  NoticeStatus,
} from "@/lib/api/notices";

type Props = {
  noticeId: string;
  currentUserId: string;
  perms: {
    canUpdate: boolean;
    canDelete: boolean;
    canPin: boolean;
    canPublish: boolean;
    canManageAll: boolean;
    canAuditList: boolean;
  };
  materials: {
    canCreate: boolean;
    canRead: boolean;
    canProcess: boolean;
    linked: null | { id: string; title: string; status: "draft" | "published" | "closed"; dueAt: string | null; archivedAt: string | null };
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

function materialStatusLabel(status: "draft" | "published" | "closed") {
  switch (status) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "closed":
      return "已关闭";
    default:
      return status;
  }
}

export default function EditNoticeClient({ noticeId, currentUserId, perms, materials }: Props) {
  const router = useRouter();

  const scopeOptionsQuery = useVisibilityScopeOptions(fetchNoticeScopeOptions, { silent: true });

  const [title, setTitle] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [expireAtLocal, setExpireAtLocal] = useState("");
  const [visibleAll, setVisibleAll] = useState(true);
  const [status, setStatus] = useState<NoticeStatus>("draft");
  const [pinned, setPinned] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [createdBy, setCreatedBy] = useState<string>("");

  const [selected, setSelected] = useState(createEmptySelectedScopes);
  const [attachments, setAttachments] = useState<NoticeAttachmentInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canOperate = perms.canManageAll || (!!createdBy && createdBy === currentUserId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const detail = await fetchConsoleNoticeDetail(noticeId);
        if (cancelled) return;

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

        setSelected(selectedScopesFromInputs(detail.scopes));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiResponseError ? err.message : "加载失败");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [noticeId]);

  const scopes = useMemo(() => {
    return selectedScopesToInputs(selected);
  }, [selected]);

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
        <div className="flex flex-wrap items-center gap-2">
          {perms.canAuditList ? (
            <Link
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={`/console/audit?targetType=notice&targetId=${noticeId}`}
            >
              查看审计
            </Link>
          ) : null}
          <Link className="text-sm text-muted-foreground hover:text-foreground" href="/console/notices">
            ← 返回
          </Link>
        </div>
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
            <VisibilityScopeSelector
              options={scopeOptionsQuery.options}
              selected={selected}
              setSelected={setSelected}
              disabled={!perms.canUpdate || !canOperate}
            />
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

          <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">材料收集</div>
                <div className="text-xs text-muted-foreground">公告最多关联 1 个材料收集任务（学生端可从公告跳转提交）。</div>
              </div>

              {materials.linked ? (
                <div className="text-xs text-muted-foreground">
                  状态：<span className="font-medium text-foreground">{materialStatusLabel(materials.linked.status)}</span>
                </div>
              ) : null}
            </div>

            {!materials.canCreate && !materials.canRead ? (
              <div className="text-sm text-muted-foreground">你没有材料收集模块权限。</div>
            ) : materials.linked ? (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">{materials.linked.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">ID：{materials.linked.id}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  截止：{materials.linked.dueAt ? formatZhDateTime(new Date(materials.linked.dueAt)) : "—"}
                  {materials.linked.archivedAt ? ` · 已归档：${formatZhDateTime(new Date(materials.linked.archivedAt))}` : ""}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/materials/${materials.linked.id}/edit`}>
                    打开任务
                  </Link>
                  {materials.canProcess ? (
                    <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/materials/${materials.linked.id}/submissions`}>
                      提交管理
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">尚未关联材料收集任务。</div>
                {materials.canCreate ? (
                  <Link className={buttonVariants({ size: "sm" })} href={`/console/materials/new?noticeId=${noticeId}`}>
                    创建材料收集任务
                  </Link>
                ) : null}
              </div>
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
