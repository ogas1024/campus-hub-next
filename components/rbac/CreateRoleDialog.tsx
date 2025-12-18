"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createRole } from "@/lib/api/rbac";
import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

export function CreateRoleDialog() {
  const router = useRouter();
  const action = useAsyncAction({ fallbackErrorMessage: "创建失败" });

  const [open, setOpen] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");

  const codeValid = useMemo(() => /^[a-z][a-z0-9_]*$/.test(code.trim()), [code]);

  async function submit() {
    const res = await action.run(() =>
      createRole({
        code: code.trim(),
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        reason: reason.trim() ? reason.trim() : undefined,
      }),
    );
    if (!res) return;
    setOpen(false);
    router.push(`/console/roles/${res.id}`);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setCode("");
          setName("");
          setDescription("");
          setReason("");
          action.reset();
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>新增角色</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>新增角色</DialogTitle>
          <DialogDescription>建议以业务能力命名：`librarian` / `major_lead` / `staff` 等。</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>code（小写字母/数字/下划线）</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例如 librarian" />
            {!codeValid && code.trim() ? <div className="text-xs text-destructive">code 格式不正确</div> : null}
          </div>

          <div className="grid gap-2">
            <Label>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 图书管理员" />
          </div>

          <div className="grid gap-2">
            <Label>描述（可选）</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简要说明该角色用于什么…" />
          </div>

          <div className="grid gap-2">
            <Label>原因（可选，将写入审计）</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
          </div>

          <InlineError message={action.error} />
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={action.pending} onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button disabled={action.pending || !codeValid || !name.trim()} onClick={() => void submit()}>
            {action.pending ? "提交中..." : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
