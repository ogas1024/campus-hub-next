/**
 * 用法：
 * - 作为“新增/编辑/驳回”等表单弹窗通用壳：
 *   <ConsoleFormDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="新增"
 *     description="..."
 *     pending={action.pending}
 *     error={action.error}
 *     confirmText="保存"
 *     confirmDisabled={!canSubmit}
 *     onConfirm={() => void submit()}
 *   >
 *     ...fields
 *   </ConsoleFormDialog>
 */

"use client";

import type * as React from "react";

import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  error?: string | null;
  pending?: boolean;
  confirmText?: string;
  confirmDisabled?: boolean;
  confirmVariant?: "default" | "destructive";
  onConfirm: () => void;
  cancelText?: string;
};

export function ConsoleFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          {props.description ? <DialogDescription>{props.description}</DialogDescription> : null}
        </DialogHeader>

        <InlineError message={props.error ?? null} />

        <div className="grid gap-4">{props.children}</div>

        <DialogFooter>
          <Button variant="outline" disabled={props.pending} onClick={() => props.onOpenChange(false)}>
            {props.cancelText ?? "取消"}
          </Button>
          <Button
            variant={props.confirmVariant ?? "default"}
            disabled={props.pending || props.confirmDisabled}
            onClick={() => props.onConfirm()}
          >
            {props.pending ? "处理中..." : props.confirmText ?? "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

