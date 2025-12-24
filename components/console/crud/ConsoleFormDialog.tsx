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

import { Button } from "@/components/ui/button";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";

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
  const footer = (
    <>
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
    </>
  );

  return (
    <StickyFormDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.title}
      description={props.description}
      error={props.error ?? null}
      footer={footer}
      contentClassName="max-w-xl"
    >
      {props.children}
    </StickyFormDialog>
  );
}
