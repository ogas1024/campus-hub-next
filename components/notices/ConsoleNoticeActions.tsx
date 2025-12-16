"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiResponseError } from "@/lib/api/http";
import { deleteConsoleNotice, publishConsoleNotice, retractConsoleNotice, setConsoleNoticePinned } from "@/lib/api/notices";
import type { NoticeStatus } from "@/lib/api/notices";

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
  const [loading, setLoading] = useState(false);

  const canOperate = props.isMine || props.canManageAll;

  function getErrorMessage(err: unknown, fallback: string) {
    if (err instanceof ApiResponseError) return err.message || fallback;
    return fallback;
  }

  async function run(action: () => Promise<unknown>, fallbackMessage: string) {
    setLoading(true);
    try {
      await action();
      router.refresh();
    } catch (err) {
      window.alert(getErrorMessage(err, fallbackMessage));
    } finally {
      setLoading(false);
    }
  }

  const viewLabel = props.canUpdate && canOperate ? "编辑" : "查看";

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link
        className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50"
        href={`/console/notices/${props.noticeId}/edit`}
      >
        {viewLabel}
      </Link>

      {props.status === "draft" || props.status === "retracted" ? (
        props.canPublish && canOperate ? (
          <button
            type="button"
            className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            disabled={loading}
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
              className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-60"
              disabled={loading || props.isExpired}
              onClick={() => void run(() => setConsoleNoticePinned(props.noticeId, !props.pinned), "置顶操作失败")}
              title={props.isExpired ? "已过期公告不允许置顶" : undefined}
            >
              {props.pinned ? "取消置顶" : "置顶"}
            </button>
          ) : null}

          {props.canPublish && canOperate ? (
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-60"
              disabled={loading}
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
          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          disabled={loading}
          onClick={() => {
            if (!confirm("确认删除该公告（软删）？")) return;
            void run(() => deleteConsoleNotice(props.noticeId), "删除失败");
          }}
        >
          删除
        </button>
      ) : null}
    </div>
  );
}
