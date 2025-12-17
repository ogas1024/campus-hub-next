"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { deleteConsoleNotice, publishConsoleNotice, retractConsoleNotice, setConsoleNoticePinned } from "@/lib/api/notices";
import type { NoticeStatus } from "@/lib/api/notices";
import { InlineError } from "@/components/common/InlineError";
import { buttonVariants } from "@/components/ui/button";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { cn } from "@/lib/utils";

type Props = {
  noticeId: string;
  status: NoticeStatus;
  pinned: boolean;
  isExpired: boolean;
  isMine: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canPin: boolean;
  canPublish: boolean;
  canManageAll: boolean;
};

export function ConsoleNoticeActions(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const canOperate = props.isMine || props.canManageAll;

  async function run(runAction: () => Promise<unknown>, fallbackMessage: string) {
    const res = await action.run(runAction, { fallbackErrorMessage: fallbackMessage });
    if (res === null) return;
    router.refresh();
  }

  const viewLabel = props.canUpdate && canOperate ? "编辑" : "查看";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
          href={`/console/notices/${props.noticeId}/edit`}
        >
          {viewLabel}
        </Link>

        {props.status === "draft" || props.status === "retracted" ? (
          props.canPublish && canOperate ? (
            <button
              type="button"
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8 px-2 text-xs")}
              disabled={action.pending}
              onClick={() => void run(() => publishConsoleNotice(props.noticeId), "发布失败")}
            >
              发布
            </button>
          ) : null
        ) : null}

        {props.status === "published" ? (
          <>
            {props.canPin && canOperate ? (
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                disabled={action.pending || props.isExpired}
                onClick={() => void run(() => setConsoleNoticePinned(props.noticeId, !props.pinned), "置顶操作失败")}
                title={props.isExpired ? "已过期公告不允许置顶" : undefined}
              >
                {props.pinned ? "取消置顶" : "置顶"}
              </button>
            ) : null}

            {props.canPublish && canOperate ? (
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                disabled={action.pending}
                onClick={() => void run(() => retractConsoleNotice(props.noticeId), "撤回失败")}
              >
                撤回
              </button>
            ) : null}
          </>
        ) : null}

        {props.canDelete && canOperate ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => {
              if (!confirm("确认删除该公告（软删）？")) return;
              void run(() => deleteConsoleNotice(props.noticeId), "删除失败");
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
