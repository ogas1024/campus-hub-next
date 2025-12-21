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
  approveConsoleLostfound,
  deleteConsoleLostfound,
  offlineConsoleLostfound,
  rejectConsoleLostfound,
  restoreConsoleLostfound,
} from "@/lib/api/console-lostfound";
import { cn } from "@/lib/utils";

type ActionKind = "approve" | "reject" | "offline" | "restore" | "delete";

type Props = {
  itemId: string;
  status: "pending" | "published" | "rejected" | "offline";
  canReview: boolean;
  canOffline: boolean;
  canRestore: boolean;
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
    case "restore":
      return "恢复为待审";
    case "delete":
      return "软删清理";
    default:
      return kind;
  }
}

export function ConsoleLostfoundActions(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [kind, setKind] = useState<ActionKind>("approve");
  const [reason, setReason] = useState("");

  const needsReason = kind === "reject" || kind === "offline";

  const canApprove = props.canReview && props.status === "pending";
  const canReject = props.canReview && props.status === "pending";
  const canOffline = props.canOffline && props.status === "published";
  const canRestore = props.canRestore && (props.status === "rejected" || props.status === "offline");
  const canDelete = props.canDelete;

  const confirmText = useMemo(() => {
    if (kind === "delete") return "此操作为软删清理：条目对所有人不可见，但数据库记录仍保留 deletedAt。";
    if (kind === "restore") return "恢复后将进入待审核（publishAt 会被清空）。";
    return null;
  }, [kind]);

  function open(k: ActionKind) {
    action.reset();
    setKind(k);
    setReason("");
    setDialogOpen(true);
  }

  async function runAndRefresh(runAction: () => Promise<unknown>, fallback: string) {
    const res = await action.run(runAction, { fallbackErrorMessage: fallback });
    if (res === null) return;
    setDialogOpen(false);
    if (kind === "delete" && props.afterDeleteHref) router.push(props.afterDeleteHref);
    router.refresh();
  }

  const btnSize = props.compact ? "sm" : "sm";
  const btnClass = props.compact ? "h-8 px-2 text-xs" : "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          className={cn(buttonVariants({ variant: "outline", size: btnSize }), btnClass)}
          href={`/console/lostfound/${props.itemId}`}
        >
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

        {canOffline ? (
          <Button size={btnSize} className={btnClass} variant="outline" disabled={action.pending} onClick={() => open("offline")}>
            下架
          </Button>
        ) : null}

        {canRestore ? (
          <Button size={btnSize} className={btnClass} variant="outline" disabled={action.pending} onClick={() => open("restore")}>
            恢复
          </Button>
        ) : null}

        {canDelete ? (
          <Button size={btnSize} className={btnClass} variant="destructive" disabled={action.pending} onClick={() => open("delete")}>
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

            {needsReason ? (
              <div className="grid gap-2">
                <Label>{kind === "reject" ? "驳回理由（必填）" : "下架理由（必填）"}</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="将写入条目原因字段与审计…" />
              </div>
            ) : null}

            <InlineError message={action.error} />
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={action.pending} onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant={kind === "delete" ? "destructive" : "default"}
              disabled={action.pending || (needsReason && !reason.trim())}
              onClick={() => {
                const r = reason.trim();
                if (kind === "approve") void runAndRefresh(() => approveConsoleLostfound(props.itemId), "审核通过失败");
                if (kind === "reject") void runAndRefresh(() => rejectConsoleLostfound(props.itemId, { reason: r }), "驳回失败");
                if (kind === "offline") void runAndRefresh(() => offlineConsoleLostfound(props.itemId, { reason: r }), "下架失败");
                if (kind === "restore") void runAndRefresh(() => restoreConsoleLostfound(props.itemId), "恢复失败");
                if (kind === "delete") void runAndRefresh(() => deleteConsoleLostfound(props.itemId), "删除失败");
              }}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
