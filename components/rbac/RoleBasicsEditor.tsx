"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteRole, updateRole } from "@/lib/api/rbac";
import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

const BUILTIN_ROLE_CODES = new Set(["user", "admin", "super_admin"]);

export function RoleBasicsEditor({ role }: { role: { id: string; code: string; name: string; description: string | null; updatedAt: string } }) {
  const router = useRouter();
  const action = useAsyncAction();
  const isBuiltin = useMemo(() => BUILTIN_ROLE_CODES.has(role.code), [role.code]);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [reason, setReason] = useState("");

  async function submitUpdate() {
    await action.run(async () => {
      await updateRole(role.id, {
        name: name.trim() ? name.trim() : undefined,
        description: description.trim() ? description.trim() : null,
        reason: reason.trim() ? reason.trim() : undefined,
      });
      setEditOpen(false);
      router.refresh();
    }, { fallbackErrorMessage: "保存失败" });
  }

  async function submitDelete() {
    await action.run(async () => {
      await deleteRole(role.id, { reason: reason.trim() ? reason.trim() : undefined });
      setDeleteOpen(false);
      router.push("/console/roles");
      router.refresh();
    }, { fallbackErrorMessage: "删除失败" });
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-4 text-sm">
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">code</dt>
          <dd className="font-mono text-xs">{role.code}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">名称</dt>
          <dd>{role.name}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">更新时间</dt>
          <dd>{new Date(role.updatedAt).toLocaleString()}</dd>
        </div>
        <div className="col-span-3 space-y-1">
          <dt className="text-xs text-muted-foreground">描述</dt>
          <dd>{role.description ?? "—"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Dialog
          open={editOpen}
          onOpenChange={(next) => {
            if (next) {
              setName(role.name);
              setDescription(role.description ?? "");
              setReason("");
              action.reset();
            }
            setEditOpen(next);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline">编辑</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>编辑角色</DialogTitle>
              <DialogDescription>仅支持修改名称/描述；code 不可变更。</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>名称</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>描述（可选）</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>原因（可选，将写入审计）</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
              </div>
              <InlineError message={action.error} />
            </div>

            <DialogFooter>
              <Button variant="outline" disabled={action.pending} onClick={() => setEditOpen(false)}>
                取消
              </Button>
              <Button disabled={action.pending || !name.trim()} onClick={() => void submitUpdate()}>
                {action.pending ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={deleteOpen}
          onOpenChange={(next) => {
            if (next) {
              setReason("");
              action.reset();
            }
            setDeleteOpen(next);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="destructive" disabled={isBuiltin}>
              删除
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>删除角色</DialogTitle>
              <DialogDescription>{isBuiltin ? "内置角色不可删除。" : "删除角色会影响用户权限，请谨慎操作。"}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label>原因（可选，将写入审计）</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、删除原因、备注…" />
            </div>

            <InlineError message={action.error} />

            <DialogFooter>
              <Button variant="outline" disabled={action.pending} onClick={() => setDeleteOpen(false)}>
                取消
              </Button>
              <Button variant="destructive" disabled={action.pending || isBuiltin} onClick={() => void submitDelete()}>
                {action.pending ? "删除中..." : "确认删除"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
