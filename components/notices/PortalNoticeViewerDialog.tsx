"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DialogLoadingSkeleton } from "@/components/common/DialogLoadingSkeleton";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { NoticeMarkdown } from "@/components/notices/NoticeMarkdown";
import { NoticeReadMarker } from "@/components/notices/NoticeReadMarker";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PortalNoticeDetail, PortalNoticeMaterialResponse } from "@/lib/api/notices";
import { fetchPortalNoticeDetail, fetchPortalNoticeMaterial } from "@/lib/api/notices";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  noticeId: string;
  onRequestClose: () => void;
};

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function PortalNoticeViewerDialog(props: Props) {
  const loader = useAsyncAction({ fallbackErrorMessage: "加载失败" });
  const { run: loadRun } = loader;

  const [notice, setNotice] = useState<PortalNoticeDetail | null>(null);
  const [material, setMaterial] = useState<PortalNoticeMaterialResponse | undefined>(undefined);

  const activeNoticeId = props.noticeId.trim();
  const effectiveNotice = notice && activeNoticeId && notice.id === activeNoticeId ? notice : null;
  const optimisticLoading = props.open && !!activeNoticeId && !effectiveNotice && !loader.error;
  const loading = loader.pending || optimisticLoading;

  useEffect(() => {
    if (!props.open) return;
    if (!activeNoticeId) return;

    let cancelled = false;
    void (async () => {
      setNotice(null);
      setMaterial(undefined);

      const detail = await loadRun(() => fetchPortalNoticeDetail(activeNoticeId));
      if (cancelled) return;
      if (!detail) return;
      setNotice(detail);

      try {
        const res = await fetchPortalNoticeMaterial(activeNoticeId);
        if (cancelled) return;
        setMaterial(res);
      } catch {
        if (cancelled) return;
        setMaterial(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeNoticeId, loadRun, props.open]);

  const publishAt = useMemo(() => safeDate(effectiveNotice?.publishAt), [effectiveNotice?.publishAt]);
  const expireAt = useMemo(() => safeDate(effectiveNotice?.expireAt), [effectiveNotice?.expireAt]);

  const headerTitle = effectiveNotice ? (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{effectiveNotice.title}</span>
      {effectiveNotice.pinned ? <Badge variant="outline">置顶</Badge> : null}
      {effectiveNotice.isExpired ? (
        <Badge variant="outline" className="text-muted-foreground">
          已过期
        </Badge>
      ) : null}
      {effectiveNotice.read ? <Badge variant="secondary">已读</Badge> : <Badge>未读</Badge>}
    </span>
  ) : (
    "公告详情"
  );

  const headerDescription = effectiveNotice ? (
    <>
      <span>发布：{formatZhDateTime(publishAt)}</span>
      <span className="mx-1">·</span>
      <span>阅读数：{effectiveNotice.readCount}</span>
      {expireAt ? (
        <>
          <span className="mx-1">·</span>
          <span>有效至：{formatZhDateTime(expireAt)}</span>
        </>
      ) : null}
    </>
  ) : (
    props.noticeId
  );

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Button variant="outline" disabled={loader.pending} onClick={() => props.onRequestClose()}>
        关闭
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {effectiveNotice && material && material.id ? (
          <Link
            className={buttonVariants({ size: "sm" })}
            href={`/materials?dialog=material-submit&id=${encodeURIComponent(material.id)}`}
          >
            前往材料提交
          </Link>
        ) : null}
      </div>
    </div>
  );

  const body = loading ? (
    <DialogLoadingSkeleton variant="content" />
  ) : !effectiveNotice ? (
    <div className="text-sm text-muted-foreground">公告不存在或不可见</div>
  ) : (
    <>
      <Card>
        <CardContent className="p-5">
          <NoticeMarkdown contentMd={effectiveNotice.contentMd} />
        </CardContent>
      </Card>

      {material ? (
        <Link
          className="block rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          href={`/materials?dialog=material-submit&id=${encodeURIComponent(material.id)}`}
        >
          <Card className="transition-colors hover:bg-accent">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">材料提交</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {material.canSubmit ? <Badge>可提交</Badge> : <Badge variant="secondary">不可提交</Badge>}
                  {material.dueAt ? <Badge variant="outline">截止：{formatZhDateTime(safeDate(material.dueAt))}</Badge> : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-muted-foreground">本公告已关联材料收集任务：{material.title}</div>
              <div className="text-sm text-muted-foreground">点击卡片打开 →</div>
            </CardContent>
          </Card>
        </Link>
      ) : null}

      {effectiveNotice.attachments.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">附件</CardTitle>
              <div className="text-sm text-muted-foreground">{effectiveNotice.attachments.length} 个</div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {effectiveNotice.attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">{a.fileName}</div>
                    <div className="text-xs text-muted-foreground">{Math.ceil(a.size / 1024)} KB</div>
                  </div>
                  {a.downloadUrl ? (
                    <a className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={a.downloadUrl} target="_blank" rel="noreferrer">
                      下载
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">不可用</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );

  return (
    <>
      {props.open && props.noticeId ? <NoticeReadMarker noticeId={props.noticeId} /> : null}

      <StickyFormDialog
        open={props.open}
        onOpenChange={(open) => {
          if (open) return;
          props.onRequestClose();
        }}
        title={headerTitle}
        description={headerDescription}
        error={loader.error}
        footer={footer}
        contentClassName="max-w-4xl"
      >
        {body}
      </StickyFormDialog>
    </>
  );
}
