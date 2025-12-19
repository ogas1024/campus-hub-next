/**
 * 用法：
 * - 统一“删除/解封”等需要二次确认的弹窗：
 *   <ConsoleDeleteDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="删除楼房"
 *     description="此操作不可恢复..."
 *     pending={action.pending}
 *     error={action.error}
 *     onConfirm={({ reason }) => void submit(reason)}
 *   />
 */

"use client";

import { useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  pending?: boolean;
  error?: string | null;
  confirmText?: string;
  onConfirm: (params: { reason?: string }) => void;
};

export function ConsoleDeleteDialog(props: Props) {
  return <ConsoleDeleteDialogInner {...props} key={props.open ? "open" : "closed"} />;
}

function ConsoleDeleteDialogInner(props: Props) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          {props.description ? <DialogDescription>{props.description}</DialogDescription> : null}
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>原因（可选，将写入审计）</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
          </div>
          <InlineError message={props.error ?? null} />
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={props.pending} onClick={() => props.onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={props.pending}
            onClick={() => props.onConfirm({ reason: reason.trim() ? reason.trim() : undefined })}
          >
            {props.pending ? "处理中..." : props.confirmText ?? "确认"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
