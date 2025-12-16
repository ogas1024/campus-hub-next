"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type NoticeStatus = "draft" | "published" | "retracted";

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

  async function post(path: string, body?: unknown) {
    setLoading(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(json?.error?.message ?? "操作失败");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function del(path: string) {
    if (!confirm("确认删除该公告（软删）？")) return;
    setLoading(true);
    try {
      const res = await fetch(path, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(json?.error?.message ?? "删除失败");
        return;
      }
      router.refresh();
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
            onClick={() => void post(`/api/console/notices/${props.noticeId}/publish`)}
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
              onClick={() => void post(`/api/console/notices/${props.noticeId}/pin`, { pinned: !props.pinned })}
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
              onClick={() => void post(`/api/console/notices/${props.noticeId}/retract`)}
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
          onClick={() => void del(`/api/console/notices/${props.noticeId}`)}
        >
          删除
        </button>
      ) : null}
    </div>
  );
}
