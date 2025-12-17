"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createPosition, deletePosition, updatePosition } from "@/lib/api/organization";
import type { Position } from "@/lib/api/organization";
import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type PositionItem = Pick<Position, "id" | "code" | "name" | "description" | "enabled" | "sort">;

type Props = {
  positions: PositionItem[];
};

export function PositionsManager(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();
  const [items, setItems] = useState<PositionItem[]>(() => props.positions);

  const sorted = useMemo(() => {
    const out = items.slice();
    out.sort((a, b) => (a.sort !== b.sort ? a.sort - b.sort : a.name.localeCompare(b.name, "zh-Hans-CN")));
    return out;
  }, [items]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createEnabled, setCreateEnabled] = useState(true);
  const [createSort, setCreateSort] = useState(0);
  const [createReason, setCreateReason] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editSort, setEditSort] = useState(0);
  const [editReason, setEditReason] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  async function submitCreate() {
    const res = await action.run(
      () =>
        createPosition({
        code: createCode.trim() ? createCode.trim() : undefined,
        name: createName.trim(),
        description: createDescription.trim() ? createDescription.trim() : undefined,
        enabled: createEnabled,
        sort: createSort,
        reason: createReason.trim() ? createReason.trim() : undefined,
        }),
      { fallbackErrorMessage: "创建失败" },
    );
    if (!res) return;
    const next: PositionItem = {
      id: res.id,
      code: createCode.trim() ? createCode.trim() : null,
      name: createName.trim(),
      description: createDescription.trim() ? createDescription.trim() : null,
      enabled: createEnabled,
      sort: createSort,
    };
    setItems((prev) => [...prev, next]);
    setCreateOpen(false);
    router.refresh();
  }

  async function submitUpdate() {
    if (!editId) return;
    const ok = await action.run(async () => {
      await updatePosition(editId, {
        code: editCode.trim() ? editCode.trim() : null,
        name: editName.trim() ? editName.trim() : undefined,
        description: editDescription.trim() ? editDescription.trim() : null,
        enabled: editEnabled,
        sort: editSort,
        reason: editReason.trim() ? editReason.trim() : undefined,
      });
    }, { fallbackErrorMessage: "保存失败" });
    if (!ok) return;
    setItems((prev) =>
      prev.map((p) =>
        p.id === editId
          ? {
              ...p,
              code: editCode.trim() ? editCode.trim() : null,
              name: editName.trim() ? editName.trim() : p.name,
              description: editDescription.trim() ? editDescription.trim() : null,
              enabled: editEnabled,
              sort: editSort,
            }
          : p,
      ),
    );
    setEditOpen(false);
    router.refresh();
  }

  async function submitDelete() {
    if (!deleteId) return;
    const ok = await action.run(
      () => deletePosition(deleteId, { reason: deleteReason.trim() ? deleteReason.trim() : undefined }),
      { fallbackErrorMessage: "删除失败" },
    );
    if (!ok) return;
    setItems((prev) => prev.filter((p) => p.id !== deleteId));
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{items.length} 个岗位</div>

        <Dialog
          open={createOpen}
          onOpenChange={(next) => {
            if (next) {
              setCreateCode("");
              setCreateName("");
              setCreateDescription("");
              setCreateEnabled(true);
              setCreateSort(0);
              setCreateReason("");
              action.reset();
            }
            setCreateOpen(next);
          }}
        >
          <DialogTrigger asChild>
            <Button>新增岗位</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>新增岗位</DialogTitle>
              <DialogDescription>code 可用于业务规则/筛选（可选）；enabled 为停用/启用开关。</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>code（可选）</Label>
                  <Input value={createCode} onChange={(e) => setCreateCode(e.target.value)} placeholder="例如 librarian" />
                </div>
                <div className="grid gap-2">
                  <Label>排序（sort）</Label>
                  <Input value={String(createSort)} onChange={(e) => setCreateSort(Number(e.target.value))} inputMode="numeric" type="number" min={0} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>名称</Label>
                <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="例如 图书管理员" />
              </div>

              <div className="grid gap-2">
                <Label>描述（可选）</Label>
                <Textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="简要说明岗位职责…" />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">启用</div>
                  <div className="text-xs text-muted-foreground">停用后不影响已有绑定，仅用于业务判断。</div>
                </div>
                <Switch checked={createEnabled} onCheckedChange={setCreateEnabled} />
              </div>

              <div className="grid gap-2">
                <Label>原因（可选，将写入审计）</Label>
                <Textarea value={createReason} onChange={(e) => setCreateReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
              </div>

              <InlineError message={action.error} />
            </div>

            <DialogFooter>
              <Button variant="outline" disabled={action.pending} onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button disabled={action.pending || !createName.trim()} onClick={() => void submitCreate()}>
                {action.pending ? "提交中..." : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">sort</th>
              <th className="px-3 py-2">code</th>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">描述</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {sorted.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={6}>
                  暂无岗位
                </td>
              </tr>
            ) : null}

            {sorted.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs text-muted-foreground">{p.sort}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.code ?? "—"}</td>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      p.enabled
                        ? "rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                        : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {p.enabled ? "启用" : "停用"}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-muted-foreground">{p.description ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={action.pending}
                      onClick={() => {
                        action.reset();
                        setEditId(p.id);
                        setEditCode(p.code ?? "");
                        setEditName(p.name);
                        setEditDescription(p.description ?? "");
                        setEditEnabled(p.enabled);
                        setEditSort(p.sort);
                        setEditReason("");
                        setEditOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={action.pending}
                      onClick={() => {
                        action.reset();
                        setDeleteId(p.id);
                        setDeleteReason("");
                        setDeleteOpen(true);
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(next) => {
          if (!next) setEditId(null);
          setEditOpen(next);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>编辑岗位</DialogTitle>
            <DialogDescription>覆盖式更新；删除岗位会自动解绑用户。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>code（可选）</Label>
                <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>排序（sort）</Label>
                <Input value={String(editSort)} onChange={(e) => setEditSort(Number(e.target.value))} inputMode="numeric" type="number" min={0} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>名称</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>描述（可选）</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">启用</div>
                <div className="text-xs text-muted-foreground">停用后不影响已有绑定，仅用于业务判断。</div>
              </div>
              <Switch checked={editEnabled} onCheckedChange={setEditEnabled} />
            </div>

            <div className="grid gap-2">
              <Label>原因（可选，将写入审计）</Label>
              <Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
            </div>

            <InlineError message={action.error} />
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={action.pending} onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button disabled={action.pending || !editName.trim()} onClick={() => void submitUpdate()}>
              {action.pending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!next) setDeleteId(null);
          setDeleteOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除岗位</DialogTitle>
            <DialogDescription>若存在用户绑定，将自动解绑（MVP 行为）。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label>原因（可选，将写入审计）</Label>
            <Textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="可填写工单号、删除原因、备注…" />
          </div>

          <InlineError message={action.error} />

          <DialogFooter>
            <Button variant="outline" disabled={action.pending} onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" disabled={action.pending} onClick={() => void submitDelete()}>
              {action.pending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
