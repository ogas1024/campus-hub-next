"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { InlineError } from "@/components/common/InlineError";
import { buttonVariants } from "@/components/ui/button";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { withDialogHref } from "@/lib/navigation/dialog";
import { cn } from "@/lib/utils";
import { closeConsoleSurvey, deleteConsoleSurvey, publishConsoleSurvey } from "@/lib/api/console-surveys";
import type { SurveyStatus } from "@/lib/api/surveys";

type Props = {
  surveyId: string;
  status: SurveyStatus;
  effectiveStatus: SurveyStatus;
  isMine: boolean;
  canUpdate: boolean;
  canPublish: boolean;
  canClose: boolean;
  canDelete: boolean;
  canManageAll: boolean;
};

export function ConsoleSurveyActions(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const action = useAsyncAction();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canOperate = props.isMine || props.canManageAll;
  const viewLabel = props.canUpdate && canOperate ? "编辑" : "查看";

  async function run(runAction: () => Promise<unknown>, fallbackMessage: string) {
    const res = await action.run(runAction, { fallbackErrorMessage: fallbackMessage });
    if (res === null) return;
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
          href={withDialogHref(buildHref(), { dialog: "survey-edit", id: props.surveyId })}
        >
          {viewLabel}
        </Link>

        <Link
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
          href={`/console/surveys/${props.surveyId}/results`}
        >
          结果
        </Link>

        {props.status === "draft" && props.canPublish && canOperate ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => void run(() => publishConsoleSurvey(props.surveyId), "发布失败")}
          >
            发布
          </button>
        ) : null}

        {props.effectiveStatus === "published" && props.canClose && canOperate ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => void run(() => closeConsoleSurvey(props.surveyId), "关闭失败")}
          >
            关闭
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
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="确认删除该问卷（软删）？"
        description="此操作不可恢复。"
        confirmText="删除"
        cancelText="取消"
        confirmDisabled={action.pending}
        onConfirm={() => {
          setDeleteOpen(false);
          void run(() => deleteConsoleSurvey(props.surveyId), "删除失败");
        }}
      />
    </div>
  );
}
