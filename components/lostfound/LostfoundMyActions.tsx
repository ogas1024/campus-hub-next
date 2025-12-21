"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { deleteMyLostfound, solveMyLostfound } from "@/lib/api/me-lostfound";

type Props = {
  id: string;
  status: "pending" | "published" | "rejected" | "offline";
  solvedAt: string | null;
};

export function LostfoundMyActions(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();

  const canEdit = props.status !== "offline" && !props.solvedAt;
  const canSolve = props.status === "published" && !props.solvedAt;

  async function solve() {
    if (!confirm("确认标记为已解决？标记后不可撤销。")) return;
    const res = await action.run(() => solveMyLostfound(props.id), { fallbackErrorMessage: "标记失败" });
    if (!res) return;
    router.refresh();
  }

  async function remove() {
    if (!confirm("确认删除？删除后对所有人不可见。")) return;
    const res = await action.run(() => deleteMyLostfound(props.id), { fallbackErrorMessage: "删除失败" });
    if (!res) return;
    router.refresh();
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canEdit ? (
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/lostfound/${props.id}/edit`}>
          编辑
        </Link>
      ) : (
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/lostfound/me/${props.id}`}>
          查看
        </Link>
      )}

      {canSolve ? (
        <Button size="sm" variant="outline" disabled={action.pending} onClick={() => void solve()}>
          标记已解决
        </Button>
      ) : null}

      <Button size="sm" variant="destructive" disabled={action.pending} onClick={() => void remove()}>
        删除
      </Button>
    </div>
  );
}
