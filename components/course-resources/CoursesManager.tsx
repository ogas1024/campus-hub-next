"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createConsoleCourse,
  deleteConsoleCourse,
  updateConsoleCourse,
} from "@/lib/api/console-course-resources";
import type { Course, Major } from "@/lib/api/console-course-resources";
import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type CourseItem = Course & { majorName: string };

type Props = {
  courses: CourseItem[];
  majors: Major[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function CoursesManager(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();
  const [items, setItems] = useState<CourseItem[]>(() => props.courses);

  const majorsById = useMemo(() => new Map(props.majors.map((m) => [m.id, m])), [props.majors]);

  const sorted = useMemo(() => {
    const out = items.slice();
    out.sort((a, b) => {
      if (a.majorName !== b.majorName) return a.majorName.localeCompare(b.majorName, "zh-Hans-CN");
      if (a.sort !== b.sort) return a.sort - b.sort;
      return a.name.localeCompare(b.name, "zh-Hans-CN");
    });
    return out;
  }, [items]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createMajorId, setCreateMajorId] = useState(props.majors[0]?.id ?? "");
  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createEnabled, setCreateEnabled] = useState(true);
  const [createSort, setCreateSort] = useState(0);
  const [createRemark, setCreateRemark] = useState("");
  const [createReason, setCreateReason] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editMajorId, setEditMajorId] = useState("");
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editSort, setEditSort] = useState(0);
  const [editRemark, setEditRemark] = useState("");
  const [editReason, setEditReason] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  async function submitCreate() {
    const res = await action.run(
      () =>
        createConsoleCourse({
          majorId: createMajorId,
          name: createName.trim(),
          code: createCode.trim() ? createCode.trim() : null,
          enabled: createEnabled,
          sort: createSort,
          remark: createRemark.trim() ? createRemark.trim() : null,
          reason: createReason.trim() ? createReason.trim() : undefined,
        }),
      { fallbackErrorMessage: "创建失败" },
    );
    if (!res) return;

    const majorName = majorsById.get(createMajorId)?.name ?? "—";
    setItems((prev) => [
      ...prev,
      {
        id: res.id,
        majorId: createMajorId,
        majorName,
        name: createName.trim(),
        code: createCode.trim() ? createCode.trim() : null,
        enabled: createEnabled,
        sort: createSort,
        remark: createRemark.trim() ? createRemark.trim() : null,
      },
    ]);
    setCreateOpen(false);
    router.refresh();
  }

  async function submitUpdate() {
    if (!editId) return;
    const ok = await action.run(
      () =>
        updateConsoleCourse(editId, {
          majorId: editMajorId,
          name: editName.trim() ? editName.trim() : undefined,
          code: editCode.trim() ? editCode.trim() : null,
          enabled: editEnabled,
          sort: editSort,
          remark: editRemark.trim() ? editRemark.trim() : null,
          reason: editReason.trim() ? editReason.trim() : undefined,
        }),
      { fallbackErrorMessage: "保存失败" },
    );
    if (!ok) return;

    const majorName = majorsById.get(editMajorId)?.name ?? "—";
    setItems((prev) =>
      prev.map((c) =>
        c.id === editId
          ? {
              ...c,
              majorId: editMajorId,
              majorName,
              name: editName.trim() ? editName.trim() : c.name,
              code: editCode.trim() ? editCode.trim() : null,
              enabled: editEnabled,
              sort: editSort,
              remark: editRemark.trim() ? editRemark.trim() : null,
            }
          : c,
      ),
    );
    setEditOpen(false);
    router.refresh();
  }

  async function submitDelete() {
    if (!deleteId) return;
    const ok = await action.run(
      () => deleteConsoleCourse(deleteId, { reason: deleteReason.trim() ? deleteReason.trim() : undefined }),
      { fallbackErrorMessage: "删除失败" },
    );
    if (!ok) return;
    setItems((prev) => prev.filter((c) => c.id !== deleteId));
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{items.length} 门课程</div>

        {props.canCreate ? (
          <Dialog
            open={createOpen}
            onOpenChange={(next) => {
              if (next) {
                action.reset();
                setCreateMajorId(props.majors[0]?.id ?? "");
                setCreateName("");
                setCreateCode("");
                setCreateEnabled(true);
                setCreateSort(0);
                setCreateRemark("");
                setCreateReason("");
              }
              setCreateOpen(next);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">新增课程</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增课程</DialogTitle>
                <DialogDescription>课程归属于专业；Portal 仅展示启用课程。</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>专业</Label>
                  <Select value={createMajorId} onChange={(e) => setCreateMajorId(e.target.value)} disabled={props.majors.length === 0}>
                    {props.majors.length === 0 ? <option value="">暂无专业</option> : null}
                    {props.majors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>名称</Label>
                  <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="例如 数据结构" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>课程代码（可选）</Label>
                    <Input value={createCode} onChange={(e) => setCreateCode(e.target.value)} placeholder="例如 CS101" />
                  </div>
                  <div className="grid gap-2">
                    <Label>排序（sort）</Label>
                    <Input value={String(createSort)} onChange={(e) => setCreateSort(Number(e.target.value))} inputMode="numeric" type="number" min={0} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">启用</div>
                    <div className="text-xs text-muted-foreground">停用后仍保留数据，仅影响 Portal 可见性。</div>
                  </div>
                  <Switch checked={createEnabled} onCheckedChange={setCreateEnabled} />
                </div>
                <div className="grid gap-2">
                  <Label>备注（可选）</Label>
                  <Textarea value={createRemark} onChange={(e) => setCreateRemark(e.target.value)} placeholder="可填写课程说明、口径…" />
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
                <Button disabled={action.pending || !createMajorId || !createName.trim()} onClick={() => void submitCreate()}>
                  {action.pending ? "提交中..." : "创建"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">专业</th>
              <th className="px-3 py-2">sort</th>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">code</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">备注</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {sorted.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={7}>
                  暂无课程
                </td>
              </tr>
            ) : null}

            {sorted.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2 text-sm font-medium">{c.majorName}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{c.sort}</td>
                <td className="px-3 py-2 font-medium">
                  <div className="line-clamp-1">{c.name}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{c.id}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{c.code ?? "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      c.enabled
                        ? "rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                        : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {c.enabled ? "启用" : "停用"}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-muted-foreground">{c.remark ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {props.canUpdate ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={action.pending}
                        onClick={() => {
                          action.reset();
                          setEditId(c.id);
                          setEditMajorId(c.majorId);
                          setEditName(c.name);
                          setEditCode(c.code ?? "");
                          setEditEnabled(c.enabled);
                          setEditSort(c.sort);
                          setEditRemark(c.remark ?? "");
                          setEditReason("");
                          setEditOpen(true);
                        }}
                      >
                        编辑
                      </Button>
                    ) : null}
                    {props.canDelete ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={action.pending}
                        onClick={() => {
                          action.reset();
                          setDeleteId(c.id);
                          setDeleteReason("");
                          setDeleteOpen(true);
                        }}
                      >
                        删除
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑课程</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>专业</Label>
              <Select value={editMajorId} onChange={(e) => setEditMajorId(e.target.value)} disabled={props.majors.length === 0}>
                {props.majors.length === 0 ? <option value="">暂无专业</option> : null}
                {props.majors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>名称</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>课程代码（可选）</Label>
                <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>排序（sort）</Label>
                <Input value={String(editSort)} onChange={(e) => setEditSort(Number(e.target.value))} inputMode="numeric" type="number" min={0} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">启用</div>
                <div className="text-xs text-muted-foreground">停用后仍保留数据，仅影响 Portal 可见性。</div>
              </div>
              <Switch checked={editEnabled} onCheckedChange={setEditEnabled} />
            </div>
            <div className="grid gap-2">
              <Label>备注（可选）</Label>
              <Textarea value={editRemark} onChange={(e) => setEditRemark(e.target.value)} />
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
            <Button disabled={action.pending || !editMajorId || !editName.trim()} onClick={() => void submitUpdate()}>
              {action.pending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除课程</DialogTitle>
            <DialogDescription>将执行软删（deleted_at），不会级联删除资源。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>原因（可选，将写入审计）</Label>
              <Textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
            </div>
            <InlineError message={action.error} />
          </div>
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

