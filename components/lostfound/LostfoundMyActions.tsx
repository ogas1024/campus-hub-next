"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { InlineError } from "@/components/common/InlineError";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { deleteMyLostfound, solveMyLostfound } from "@/lib/api/me-lostfound";

type Props = {
  id: string;
  editHref?: string;
  status: "pending" | "published" | "rejected" | "offline";
  solvedAt: string | null;
};

export function LostfoundMyActions(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();
  const [solveOpen, setSolveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canEdit = props.status !== "offline" && !props.solvedAt;
  const canSolve = props.status === "published" && !props.solvedAt;

  async function solve() {
    const res = await action.run(() => solveMyLostfound(props.id), { fallbackErrorMessage: "标记失败" });
    if (!res) return;
    router.refresh();
  }

  async function remove() {
    const res = await action.run(() => deleteMyLostfound(props.id), { fallbackErrorMessage: "删除失败" });
    if (!res) return;
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        {canEdit ? (
          <Link
            scroll={false}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={props.editHref ?? `/lostfound/me?dialog=lostfound-edit&id=${encodeURIComponent(props.id)}`}
          >
            编辑
          </Link>
        ) : (
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/lostfound/me/${props.id}`}>
            查看
          </Link>
        )}

        {canSolve ? (
          <Button size="sm" variant="outline" disabled={action.pending} onClick={() => setSolveOpen(true)}>
            标记已解决
          </Button>
        ) : null}

        <Button size="sm" variant="destructive" disabled={action.pending} onClick={() => setDeleteOpen(true)}>
          删除
        </Button>
      </div>

      <InlineError message={action.error} />

      <ConfirmAlertDialog
        open={solveOpen}
        onOpenChange={setSolveOpen}
        title="确认标记为已解决？"
        description="标记后不可撤销。"
        confirmText="确认标记"
        cancelText="取消"
        confirmDisabled={action.pending}
        onConfirm={() => void solve()}
      />

      <ConfirmAlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="确认删除？"
        description="删除后对所有人不可见。"
        confirmText="删除"
        cancelText="取消"
        confirmDisabled={action.pending}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
