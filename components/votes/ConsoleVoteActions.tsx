"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ConsoleFormDialog } from "@/components/console/crud/ConsoleFormDialog";
import { InlineError } from "@/components/common/InlineError";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { archiveConsoleVote, closeConsoleVote, extendConsoleVote, pinConsoleVote, publishConsoleVote } from "@/lib/api/console-votes";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { cn } from "@/lib/utils";

type Props = {
  voteId: string;
  status: "draft" | "published" | "closed";
  effectiveStatus: "draft" | "published" | "closed";
  endAt: string;
  pinned: boolean;
  archivedAt: string | null;
  isMine: boolean;
  canUpdate: boolean;
  canPublish: boolean;
  canClose: boolean;
  canExtend: boolean;
  canPin: boolean;
  canArchive: boolean;
  canManageAll: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toIso(local: string, name: string) {
  if (!local) throw new Error(`${name} 必填`);
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} 格式无效`);
  return date.toISOString();
}

export function ConsoleVoteActions(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const canOperate = props.isMine || props.canManageAll;
  const viewLabel = props.status === "draft" && props.canUpdate && canOperate ? "编辑" : "查看";

  const [extendOpen, setExtendOpen] = useState(false);
  const [extendEndAtLocal, setExtendEndAtLocal] = useState(() => {
    const current = new Date(props.endAt);
    current.setDate(current.getDate() + 7);
    return toLocalInputValue(current.toISOString());
  });

  const canExtendNow = useMemo(() => {
    if (!props.canExtend || !canOperate) return false;
    if (props.archivedAt) return false;
    return props.status !== "draft";
  }, [props.archivedAt, props.canExtend, props.status, canOperate]);

  async function run(runAction: () => Promise<unknown>, fallbackMessage: string) {
    const res = await action.run(runAction, { fallbackErrorMessage: fallbackMessage });
    if (res === null) return;
    router.refresh();
  }

  async function doExtend() {
    try {
      const endAt = toIso(extendEndAtLocal, "endAt");
      const res = await action.run(() => extendConsoleVote(props.voteId, { endAt }), { fallbackErrorMessage: "延期失败" });
      if (res === null) return;
      setExtendOpen(false);
      router.refresh();
    } catch (err) {
      action.setError(err instanceof Error ? err.message : "延期失败");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")} href={`/console/votes/${props.voteId}/edit`}>
          {viewLabel}
        </Link>

        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")} href={`/console/votes/${props.voteId}/results`}>
          结果
        </Link>

        {props.status === "draft" && props.canPublish && canOperate ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => void run(() => publishConsoleVote(props.voteId), "发布失败")}
          >
            发布
          </button>
        ) : null}

        {props.effectiveStatus === "published" && props.canClose && canOperate ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => void run(() => closeConsoleVote(props.voteId), "关闭失败")}
          >
            关闭
          </button>
        ) : null}

        {canExtendNow ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => {
              action.reset();
              setExtendOpen(true);
            }}
          >
            延期
          </button>
        ) : null}

        {props.canPin && canOperate && !props.archivedAt && props.effectiveStatus === "published" && props.status === "published" ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: props.pinned ? "outline" : "default", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => void run(() => pinConsoleVote(props.voteId, { pinned: !props.pinned }), "置顶失败")}
          >
            {props.pinned ? "取消置顶" : "置顶"}
          </button>
        ) : null}

        {props.canArchive && canOperate && !props.archivedAt && props.effectiveStatus === "closed" ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
            disabled={action.pending}
            onClick={() => {
              if (!confirm("确认归档该投票？归档后将从学生端公共列表隐藏，但已参与用户仍可在“我的投票”中查看。")) return;
              void run(() => archiveConsoleVote(props.voteId), "归档失败");
            }}
          >
            归档
          </button>
        ) : null}
      </div>

      <InlineError message={action.error} />

      <ConsoleFormDialog
        open={extendOpen}
        onOpenChange={(open) => {
          if (open) action.reset();
          setExtendOpen(open);
        }}
        title="延期投票"
        description="允许到期后延期；endAt 必须晚于当前结束时间且晚于当前时间。"
        pending={action.pending}
        error={action.error}
        confirmText="确认延期"
        onConfirm={() => void doExtend()}
      >
        <div className="grid gap-1.5">
          <label className="text-sm font-medium">新的结束时间</label>
          <Input type="datetime-local" value={extendEndAtLocal} onChange={(e) => setExtendEndAtLocal(e.target.value)} required />
        </div>
      </ConsoleFormDialog>
    </div>
  );
}

