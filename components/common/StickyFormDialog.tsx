/**
 * 用法：
 * - 作为“新增/编辑”等长表单弹窗的统一布局：
 *   <StickyFormDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="新建"
 *     description="..."
 *     error={action.error}
 *     footer={...buttons}
 *   >
 *     ...fields
 *   </StickyFormDialog>
 */

"use client";

import type * as React from "react";

import { InlineError } from "@/components/common/InlineError";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
  error?: string | null;
  contentClassName?: string;
};

export function StickyFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={cn("max-w-3xl p-0", props.contentClassName)}>
        <div className="flex max-h-[80vh] flex-col overflow-hidden">
          <div className="border-b border-border px-6 py-5">
            <DialogHeader>
              <DialogTitle>{props.title}</DialogTitle>
              {props.description ? <DialogDescription>{props.description}</DialogDescription> : null}
            </DialogHeader>
            <InlineError className="mt-4" message={props.error ?? null} />
          </div>

          <div className="flex-1 overflow-auto px-6 py-5">
            <div className="grid gap-4">{props.children}</div>
          </div>

          <div className="border-t border-border bg-background px-6 py-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {props.footer}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

