"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { setUserDepartments } from "@/lib/api/iam";
import type { Department } from "@/lib/api/organization";
import { DepartmentTreeSelector } from "@/components/organization/DepartmentTreeSelector";
import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  userId: string;
  departments: Department[];
  value: string[];
  disabled?: boolean;
};

export function UserDepartmentsEditor(props: Props) {
  const router = useRouter();
  const action = useAsyncAction({ fallbackErrorMessage: "保存失败" });
  const [open, setOpen] = useState(false);

  const [selected, setSelected] = useState<string[]>(() => props.value);
  const [reason, setReason] = useState("");

  const deptById = useMemo(() => new Map(props.departments.map((d) => [d.id, d])), [props.departments]);
  const selectedLabels = useMemo(() => selected.map((id) => deptById.get(id)?.name ?? "未知部门"), [deptById, selected]);
  const chips = selectedLabels.slice(0, 6);

  async function submit() {
    await action.run(async () => {
      await setUserDepartments(props.userId, { departmentIds: selected, reason: reason.trim() ? reason.trim() : undefined });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {chips.length === 0 ? <span className="text-sm text-muted-foreground">—</span> : null}
          {chips.map((label) => (
            <span key={label} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {label}
            </span>
          ))}
          {selectedLabels.length > chips.length ? (
            <span className="text-xs text-muted-foreground">+{selectedLabels.length - chips.length}</span>
          ) : null}
        </div>

        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (next) {
              setSelected(props.value);
              setReason("");
              action.reset();
            }
            setOpen(next);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" disabled={props.disabled}>
              编辑
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>编辑用户部门</DialogTitle>
              <DialogDescription>覆盖式保存；此处为“精确选择”，不会自动折叠为父部门。</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>部门</Label>
                <DepartmentTreeSelector
                  departments={props.departments}
                  value={selected}
                  onChange={setSelected}
                  selectionMode="exact"
                  maxHeight={360}
                />
              </div>

              <div className="grid gap-2">
                <Label>原因（可选，将写入审计）</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、处理原因、备注…" />
              </div>

              <InlineError message={action.error} />
            </div>

            <DialogFooter>
              <Button variant="outline" disabled={action.pending} onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button disabled={action.pending} onClick={() => void submit()}>
                {action.pending ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
