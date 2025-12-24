"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { ConsoleDeleteDialog } from "@/components/console/crud/ConsoleDeleteDialog";
import { InlineError } from "@/components/common/InlineError";
import { buttonVariants } from "@/components/ui/button";
import { archiveConsoleMaterial, closeConsoleMaterial, deleteConsoleMaterial, publishConsoleMaterial } from "@/lib/api/console-materials";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { withDialogHref } from "@/lib/navigation/dialog";
import { cn } from "@/lib/utils";

type Props = {
  materialId: string;
  status: "draft" | "published" | "closed";
  isMine: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canClose: boolean;
  canArchive: boolean;
  canProcess: boolean;
  canManageAll: boolean;
};

export function ConsoleMaterialActions(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const action = useAsyncAction();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const canOperate = props.isMine || props.canManageAll;
  const viewLabel = props.status === "draft" && props.canUpdate && canOperate ? "编辑" : "查看";

  async function run(runAction: () => Promise<unknown>, fallbackMessage: string) {
    const res = await action.run(runAction, { fallbackErrorMessage: fallbackMessage });
    if (res === null) return;
    router.refresh();
  }

  async function submitDelete(reason?: string) {
    if (!props.canDelete || !canOperate) return;
    const res = await action.run(() => deleteConsoleMaterial(props.materialId, { reason }), { fallbackErrorMessage: "删除失败" });
    if (res === null) return;
    setDeleteOpen(false);
    router.refresh();
  }

  function buildHref() {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          scroll={false}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
          href={withDialogHref(buildHref(), { dialog: "material-edit", id: props.materialId })}
        >
          {viewLabel}
        </Link>

        {props.canProcess ? (
          <Link
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
            href={`/console/materials/${props.materialId}/submissions`}
          >
            提交管理
          </Link>
        ) : null}

        {props.status === "draft" && props.canPublish && canOperate ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => void run(() => publishConsoleMaterial(props.materialId), "发布失败")}
          >
            发布
          </button>
        ) : null}

        {props.status === "published" && props.canClose && canOperate ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => void run(() => closeConsoleMaterial(props.materialId), "关闭失败")}
          >
            关闭
          </button>
        ) : null}

        {props.status === "closed" && props.canArchive && canOperate ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => {
              action.reset();
              setArchiveOpen(true);
            }}
          >
            归档
          </button>
        ) : null}

        {props.canDelete && canOperate ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => {
              action.reset();
              setDeleteOpen(true);
            }}
          >
            删除
          </button>
        ) : null}
      </div>

      <InlineError message={action.error} />

      <ConfirmAlertDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="确认归档该任务？"
        description="归档后将从学生端隐藏，并对提交做归档标记。"
        confirmText="确认归档"
        confirmDisabled={action.pending}
        onConfirm={() => {
          setArchiveOpen(false);
          void run(() => archiveConsoleMaterial(props.materialId), "归档失败");
        }}
      />

      <ConsoleDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open) action.reset();
          setDeleteOpen(open);
        }}
        title="删除材料收集任务"
        description="删除为软删：将从列表隐藏；提交与文件不会物理删除；此操作不可恢复。"
        pending={action.pending}
        error={action.error}
        confirmText="确认删除"
        onConfirm={({ reason }) => void submitDelete(reason)}
      />
    </div>
  );
}
