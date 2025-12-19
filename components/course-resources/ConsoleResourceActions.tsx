"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import {
  approveConsoleResource,
  bestConsoleResource,
  hardDeleteConsoleResource,
  offlineConsoleResource,
  rejectConsoleResource,
  unbestConsoleResource,
} from "@/lib/api/console-course-resources";
import type { ResourceStatus } from "@/lib/api/console-course-resources";
import { cn } from "@/lib/utils";

type ActionKind = "approve" | "reject" | "offline" | "best" | "unbest" | "delete";

type Props = {
  resourceId: string;
  status: ResourceStatus;
  isBest: boolean;
  canReview: boolean;
  canOffline: boolean;
  canBest: boolean;
  canDelete: boolean;
  compact?: boolean;
  afterDeleteHref?: string;
};

function labelFor(kind: ActionKind) {
  switch (kind) {
    case "approve":
      return "审核通过";
    case "reject":
      return "审核驳回";
    case "offline":
      return "下架";
    case "best":
      return "设为最佳";
    case "unbest":
      return "取消最佳";
    case "delete":
      return "硬删除";
    default:
      return kind;
  }
}

export function ConsoleResourceActions(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [kind, setKind] = useState<ActionKind>("approve");
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");

  const needsComment = kind === "reject";
  const showComment = kind === "approve" || kind === "reject";

  const canApprove = props.canReview && props.status === "pending";
  const canReject = props.canReview && props.status === "pending";
  const canOffline = props.canOffline && props.status === "published";
  const canBest = props.canBest && props.status === "published" && !props.isBest;
  const canUnbest = props.canBest && props.isBest;
  const canDelete = props.canDelete;

  const confirmText = useMemo(() => {
    if (kind === "delete") return "此操作不可恢复，仅删除数据库记录（不删除存储对象）。";
    return null;
  }, [kind]);

  async function runAndRefresh(runAction: () => Promise<unknown>, fallback: string) {
    const res = await action.run(runAction, { fallbackErrorMessage: fallback });
    if (res === null) return;
    setDialogOpen(false);
    if (kind === "delete") {
      if (props.afterDeleteHref) router.push(props.afterDeleteHref);
    }
    router.refresh();
  }

  function open(k: ActionKind) {
    action.reset();
    setKind(k);
    setComment("");
    setReason("");
    setDialogOpen(true);
  }

  const btnSize = props.compact ? "sm" : "sm";
  const btnClass = props.compact ? "h-8 px-2 text-xs" : "";

  return (
    <div className="space-y-2">
      <div className={cn("flex flex-wrap justify-end gap-2", props.compact ? "" : "justify-start")}>
        <Link
          className={cn(buttonVariants({ variant: "outline", size: btnSize }), btnClass)}
          href={`/console/resources/${props.resourceId}`}
        >
          详情
        </Link>

        {canApprove ? (
          <Button
            size={btnSize}
            className={btnClass}
            disabled={action.pending}
            onClick={() => open("approve")}
          >
            通过
          </Button>
        ) : null}

        {canReject ? (
          <Button
            size={btnSize}
            className={btnClass}
            variant="outline"
            disabled={action.pending}
            onClick={() => open("reject")}
          >
            驳回
          </Button>
        ) : null}

        {canOffline ? (
          <Button
            size={btnSize}
            className={btnClass}
            variant="outline"
            disabled={action.pending}
            onClick={() => open("offline")}
          >
            下架
          </Button>
        ) : null}

        {canBest ? (
          <Button
            size={btnSize}
            className={btnClass}
            variant="outline"
            disabled={action.pending}
            onClick={() => open("best")}
          >
            设为最佳
          </Button>
        ) : null}

        {canUnbest ? (
          <Button
            size={btnSize}
            className={btnClass}
            variant="outline"
            disabled={action.pending}
            onClick={() => open("unbest")}
          >
            取消最佳
          </Button>
        ) : null}

        {canDelete ? (
          <Button
            size={btnSize}
            className={btnClass}
            variant="destructive"
            disabled={action.pending}
            onClick={() => open("delete")}
          >
            删除
          </Button>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labelFor(kind)}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            {confirmText ? <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">{confirmText}</div> : null}

            {showComment ? (
              <div className="grid gap-2">
                <Label>{kind === "approve" ? "备注（可选）" : "驳回原因（必填）"}</Label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="将作为审核意见写入资源记录与审计…" />
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label>原因（可选，将写入审计）</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
            </div>

            <InlineError message={action.error} />
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={action.pending} onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant={kind === "delete" ? "destructive" : "default"}
              disabled={action.pending || (needsComment && !comment.trim())}
              onClick={() => {
                const reasonValue = reason.trim() ? reason.trim() : undefined;
                const commentValue = comment.trim() ? comment.trim() : undefined;

                if (kind === "approve") {
                  void runAndRefresh(() => approveConsoleResource(props.resourceId, { comment: commentValue, reason: reasonValue }), "审核通过失败");
                } else if (kind === "reject") {
                  void runAndRefresh(() => rejectConsoleResource(props.resourceId, { comment: comment.trim(), reason: reasonValue }), "驳回失败");
                } else if (kind === "offline") {
                  void runAndRefresh(() => offlineConsoleResource(props.resourceId, { reason: reasonValue }), "下架失败");
                } else if (kind === "best") {
                  void runAndRefresh(() => bestConsoleResource(props.resourceId, { reason: reasonValue }), "设置最佳失败");
                } else if (kind === "unbest") {
                  void runAndRefresh(() => unbestConsoleResource(props.resourceId, { reason: reasonValue }), "取消最佳失败");
                } else if (kind === "delete") {
                  void runAndRefresh(() => hardDeleteConsoleResource(props.resourceId, { reason: reasonValue }), "删除失败");
                }
              }}
            >
              {action.pending ? "处理中..." : kind === "delete" ? "确认删除" : "确认"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
