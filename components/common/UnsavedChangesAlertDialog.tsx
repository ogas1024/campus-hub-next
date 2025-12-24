"use client";

import type * as React from "react";

import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onDiscard: () => void;
};

export function UnsavedChangesAlertDialog(props: Props) {
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title ?? "放弃未保存的修改？"}</AlertDialogTitle>
          <AlertDialogDescription>
            {props.description ?? "关闭后将丢失当前未保存内容。"}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancelButton>
            {props.cancelText ?? "继续编辑"}
          </AlertDialogCancelButton>
          <AlertDialogActionButton onClick={props.onDiscard}>
            {props.confirmText ?? "放弃修改"}
          </AlertDialogActionButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

