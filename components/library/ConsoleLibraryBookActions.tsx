"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ConsoleFormDialog } from "@/components/console/crud/ConsoleFormDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import {
  approveConsoleLibraryBook,
  hardDeleteConsoleLibraryBook,
  offlineConsoleLibraryBook,
  rejectConsoleLibraryBook,
} from "@/lib/api/console-library";
import type { BookStatus } from "@/lib/api/library";
import { cn } from "@/lib/utils";

type ActionKind = "approve" | "reject" | "offline" | "delete";

type Props = {
  bookId: string;
  status: BookStatus;
  canReview: boolean;
  canOffline: boolean;
  canDelete: boolean;
  afterDeleteHref: string;
  btnSize?: "sm" | "default";
  btnClassName?: string;
};

function labelFor(kind: ActionKind) {
  switch (kind) {
    case "approve":
      return "审核通过";
    case "reject":
      return "审核驳回";
    case "offline":
      return "下架";
    case "delete":
      return "硬删除";
    default:
      return "操作";
  }
}

export function ConsoleLibraryBookActions(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();
  const btnSize = props.btnSize ?? "sm";
  const btnClass = props.btnClassName ?? "";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [kind, setKind] = useState<ActionKind>("approve");
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");

  const {
    canApprove,
    canReject,
    canOfflineAction,
    canDeleteAction,
  }: { canApprove: boolean; canReject: boolean; canOfflineAction: boolean; canDeleteAction: boolean } = useMemo(() => {
    return {
      canApprove: props.canReview && props.status === "pending",
      canReject: props.canReview && props.status === "pending",
      canOfflineAction: props.canOffline && props.status === "published",
      canDeleteAction: props.canDelete,
    };
  }, [props.canDelete, props.canOffline, props.canReview, props.status]);

  function open(next: ActionKind) {
    action.reset();
    setKind(next);
    setComment("");
    setReason("");
    setDialogOpen(true);
  }

  const needsComment = kind === "reject";
  const showComment = kind === "approve" || kind === "reject";
  const confirmText =
    kind === "delete"
      ? "此操作会从数据库物理删除该图书，并尝试清理已上传文件（若存在）。请谨慎。"
      : kind === "offline"
        ? "下架后将对 Portal 隐藏；作者可编辑并重新提交审核。"
        : null;

  async function runAndRefresh(fn: () => Promise<unknown>, fallback: string) {
    const res = await action.run(fn, { fallbackErrorMessage: fallback });
    if (res === null) return;
    setDialogOpen(false);
    if (kind === "delete") {
      router.push(props.afterDeleteHref);
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Link className={cn(buttonVariants({ variant: "outline", size: btnSize }), btnClass)} href={`/console/library/${props.bookId}`}>
          详情
        </Link>

        {canApprove ? (
          <Button size={btnSize} className={btnClass} disabled={action.pending} onClick={() => open("approve")}>
            通过
          </Button>
        ) : null}

        {canReject ? (
          <Button size={btnSize} className={btnClass} variant="outline" disabled={action.pending} onClick={() => open("reject")}>
            驳回
          </Button>
        ) : null}

        {canOfflineAction ? (
          <Button size={btnSize} className={btnClass} variant="outline" disabled={action.pending} onClick={() => open("offline")}>
            下架
          </Button>
        ) : null}

        {canDeleteAction ? (
          <Button size={btnSize} className={btnClass} variant="destructive" disabled={action.pending} onClick={() => open("delete")}>
            删除
          </Button>
        ) : null}
      </div>

      <ConsoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={labelFor(kind)}
        pending={action.pending}
        error={action.error}
        confirmText={kind === "delete" ? "确认删除" : "确认"}
        confirmVariant={kind === "delete" ? "destructive" : "default"}
        confirmDisabled={needsComment && !comment.trim()}
        onConfirm={() => {
          const reasonValue = reason.trim() ? reason.trim() : undefined;
          const commentValue = comment.trim() ? comment.trim() : undefined;

          if (kind === "approve") {
            void runAndRefresh(() => approveConsoleLibraryBook(props.bookId, { comment: commentValue, reason: reasonValue }), "审核通过失败");
          } else if (kind === "reject") {
            void runAndRefresh(() => rejectConsoleLibraryBook(props.bookId, { comment: comment.trim(), reason: reasonValue }), "驳回失败");
          } else if (kind === "offline") {
            void runAndRefresh(() => offlineConsoleLibraryBook(props.bookId, { reason: reasonValue }), "下架失败");
          } else if (kind === "delete") {
            void runAndRefresh(() => hardDeleteConsoleLibraryBook(props.bookId, { reason: reasonValue }), "删除失败");
          }
        }}
      >
        {confirmText ? <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">{confirmText}</div> : null}

        {showComment ? (
          <div className="grid gap-2">
            <Label>{kind === "approve" ? "备注（可选）" : "驳回原因（必填）"}</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="将写入图书记录与审计…" />
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label>原因（可选，将写入审计）</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
        </div>
      </ConsoleFormDialog>
    </div>
  );
}
