"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createDepartment, deleteDepartment, updateDepartment } from "@/lib/api/organization";
import type { Department } from "@/lib/api/organization";
import { buildDepartmentTree, collectDescendantIds } from "@/lib/modules/organization/departmentTree";
import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { cn } from "@/lib/utils";

type Props = {
  departments: Department[];
};

function flattenDeptOptions(roots: ReturnType<typeof buildDepartmentTree>["roots"]) {
  const out: Array<{ id: string; label: string }> = [];
  const stack: Array<{ node: (typeof roots)[number]; depth: number }> = roots.map((n) => ({ node: n, depth: 0 })).reverse();

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    const prefix = depth === 0 ? "" : `${"—".repeat(depth)} `;
    out.push({ id: node.id, label: `${prefix}${node.name}` });
    for (let i = node.children.length - 1; i >= 0; i -= 1) stack.push({ node: node.children[i]!, depth: depth + 1 });
  }

  return out;
}

function DepartmentEditor(props: {
  department: { id: string; name: string; parentId: string | null; sort: number };
  parentOptions: Array<{ id: string; label: string }>;
  invalidParentIds: Set<string>;
  action: ReturnType<typeof useAsyncAction>;
  onSave: (params: { id: string; name: string; parentId: string | null; sort: number; reason?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(props.department.name);
  const [parentId, setParentId] = useState<string | null>(props.department.parentId);
  const [sort, setSort] = useState(props.department.sort);
  const [reason, setReason] = useState("");

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>部门 ID</Label>
        <div className="rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">{props.department.id}</div>
      </div>

      <div className="grid gap-2">
        <Label>名称</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid gap-2">
        <Label>父部门</Label>
        <Select
          value={parentId ?? ""}
          onChange={(e) => setParentId(e.target.value ? e.target.value : null)}
        >
          <option value="">无（根部门）</option>
          {props.parentOptions.map((opt) => (
            <option key={opt.id} value={opt.id} disabled={props.invalidParentIds.has(opt.id)}>
              {opt.label}
              {props.invalidParentIds.has(opt.id) ? "（不可选）" : ""}
            </option>
          ))}
        </Select>
        <div className="text-xs text-muted-foreground">为防止循环依赖，禁止移动到自身或子部门。</div>
      </div>

      <div className="grid gap-2">
        <Label>排序（sort）</Label>
        <Input value={String(sort)} onChange={(e) => setSort(Number(e.target.value))} inputMode="numeric" type="number" min={0} />
      </div>

      <div className="grid gap-2">
        <Label>原因（可选，将写入审计）</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
      </div>

      <InlineError message={props.action.error} />

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          disabled={props.action.pending}
          onClick={() => {
            setName(props.department.name);
            setParentId(props.department.parentId);
            setSort(props.department.sort);
            setReason("");
            props.action.reset();
          }}
        >
          重置
        </Button>
        <Button
          disabled={props.action.pending || !name.trim()}
          onClick={() =>
            void props.onSave({
              id: props.department.id,
              name: name.trim(),
              parentId,
              sort,
              reason: reason.trim() ? reason.trim() : undefined,
            })
          }
        >
          {props.action.pending ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}

export function DepartmentsManager(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();
  const [items, setItems] = useState<Department[]>(() => props.departments);
  const [selectedId, setSelectedId] = useState<string | null>(() => props.departments[0]?.id ?? null);

  const { roots, byId } = useMemo(() => buildDepartmentTree(items), [items]);

  const effectiveSelectedId = useMemo(() => {
    if (selectedId && byId.has(selectedId)) return selectedId;
    return roots[0]?.id ?? null;
  }, [selectedId, byId, roots]);

  const selected = effectiveSelectedId ? byId.get(effectiveSelectedId) ?? null : null;

  const parentOptions = useMemo(() => flattenDeptOptions(roots), [roots]);
  const invalidParentIds = useMemo(() => (selected ? new Set(collectDescendantIds(selected)) : new Set<string>()), [selected]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createSort, setCreateSort] = useState(0);
  const [createReason, setCreateReason] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  async function submitCreate() {
    const res = await action.run(
      () =>
        createDepartment({
          name: createName.trim(),
          parentId: createParentId ?? null,
          sort: createSort,
          reason: createReason.trim() ? createReason.trim() : undefined,
        }),
      { fallbackErrorMessage: "创建失败" },
    );
    if (!res) return;
    const next: Department = { id: res.id, name: createName.trim(), parentId: createParentId ?? null, sort: createSort };
    setItems((prev) => [...prev, next]);
    setSelectedId(res.id);
    setCreateOpen(false);
    router.refresh();
  }

  async function submitUpdate(params: { id: string; name: string; parentId: string | null; sort: number; reason?: string }) {
    if (params.id === (params.parentId ?? null)) {
      action.setError("parentId 不能为自身");
      return;
    }
    if (params.parentId && invalidParentIds.has(params.parentId)) {
      action.setError("禁止移动到子部门");
      return;
    }

    const ok = await action.run(
      () =>
        updateDepartment(params.id, {
          name: params.name,
          parentId: params.parentId,
          sort: params.sort,
          reason: params.reason,
        }),
      { fallbackErrorMessage: "保存失败" },
    );
    if (!ok) return;
    setItems((prev) => prev.map((d) => (d.id === params.id ? { ...d, name: params.name, parentId: params.parentId, sort: params.sort } : d)));
    router.refresh();
  }

  async function submitDelete() {
    if (!selected) return;
    const ok = await action.run(
      () => deleteDepartment(selected.id, { reason: deleteReason.trim() ? deleteReason.trim() : undefined }),
      { fallbackErrorMessage: "删除失败" },
    );
    if (!ok) return;
    setItems((prev) => prev.filter((d) => d.id !== selected.id));
    setSelectedId(null);
    setDeleteOpen(false);
    router.refresh();
  }

  function renderTreeNode(node: (typeof roots)[number], depth: number) {
    const active = node.id === effectiveSelectedId;
    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            action.reset();
            setSelectedId(node.id);
          }}
          className={cn(
            "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground",
            active ? "bg-muted" : null,
          )}
          style={{ paddingLeft: depth * 14 + 8 }}
        >
          <span className="truncate text-sm">{node.name}</span>
          <span className="text-xs text-muted-foreground">{node.sort}</span>
        </button>
        {node.children.length > 0 ? <div className="space-y-0.5">{node.children.map((c) => renderTreeNode(c, depth + 1))}</div> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="lg:col-span-4">
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">组织树</div>
            <Dialog
              open={createOpen}
              onOpenChange={(next) => {
                if (next) {
                  setCreateName("");
                  setCreateSort(0);
                  setCreateParentId(effectiveSelectedId ?? null);
                  setCreateReason("");
                  action.reset();
                }
                setCreateOpen(next);
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  新增
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>新增部门</DialogTitle>
                  <DialogDescription>支持树形组织；sort 越小越靠前。</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>名称</Label>
                    <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="例如 计科2023-1班" />
                  </div>

                  <div className="grid gap-2">
                    <Label>父部门（可选）</Label>
                    <Select
                      value={createParentId ?? ""}
                      onChange={(e) => setCreateParentId(e.target.value ? e.target.value : null)}
                    >
                      <option value="">无（根部门）</option>
                      {parentOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>排序（sort）</Label>
                    <Input
                      value={String(createSort)}
                      onChange={(e) => setCreateSort(Number(e.target.value))}
                      inputMode="numeric"
                      type="number"
                      min={0}
                    />
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
          <div className="mt-2 text-xs text-muted-foreground">{items.length} 个部门</div>
        </div>

        <ScrollArea className="h-[520px]">
          <div className="space-y-0.5 p-2">{roots.map((n) => renderTreeNode(n, 0))}</div>
        </ScrollArea>
      </Card>

      <Card className="lg:col-span-8">
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">详情</div>
            {selected ? (
              <Dialog
                open={deleteOpen}
                onOpenChange={(next) => {
                  if (next) {
                    setDeleteReason("");
                    action.reset();
                  }
                  setDeleteOpen(next);
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    删除
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>删除部门</DialogTitle>
                    <DialogDescription>存在子部门或用户绑定会被拒绝（409）。后续可再扩展“级联迁移”。</DialogDescription>
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
            ) : null}
          </div>
        </div>

        <div className="p-4">
          {!selected ? <div className="text-sm text-muted-foreground">请选择一个部门进行编辑</div> : null}

          {selected ? (
            <DepartmentEditor
              key={selected.id}
              department={selected}
              parentOptions={parentOptions}
              invalidParentIds={invalidParentIds}
              action={action}
              onSave={submitUpdate}
            />
          ) : null}
        </div>
      </Card>
    </div>
  );
}
