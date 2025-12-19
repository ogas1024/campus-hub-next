"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { InlineError } from "@/components/common/InlineError";
import { buttonVariants } from "@/components/ui/button";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
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
  const action = useAsyncAction();

  const canOperate = props.isMine || props.canManageAll;
  const viewLabel = props.canUpdate && canOperate ? "编辑" : "查看";

  async function run(runAction: () => Promise<unknown>, fallbackMessage: string) {
    const res = await action.run(runAction, { fallbackErrorMessage: fallbackMessage });
    if (res === null) return;
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
          href={`/console/surveys/${props.surveyId}/edit`}
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
              if (!confirm("确认删除该问卷（软删）？此操作不可恢复。")) return;
              void run(() => deleteConsoleSurvey(props.surveyId), "删除失败");
            }}
          >
            删除
          </button>
        ) : null}
      </div>

      <InlineError message={action.error} />
    </div>
  );
}

