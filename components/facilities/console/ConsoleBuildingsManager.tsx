/**
 * 用法：
 * - Console 楼房管理页组件（由 `/console/facilities/buildings` 引用）。
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ConsoleDataTable } from "@/components/console/crud/ConsoleDataTable";
import { ConsoleDeleteDialog } from "@/components/console/crud/ConsoleDeleteDialog";
import { ConsoleFormDialog } from "@/components/console/crud/ConsoleFormDialog";
import { ConsolePage } from "@/components/console/crud/ConsolePage";
import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createConsoleFacilityBuilding,
  deleteConsoleFacilityBuilding,
  fetchConsoleFacilityBuildings,
  updateConsoleFacilityBuilding,
  type Building,
} from "@/lib/api/console-facilities";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { formatZhDateTime } from "@/lib/ui/datetime";

type Mode = "create" | "edit";

export function ConsoleBuildingsManager() {
  const router = useRouter();
  const loader = useAsyncAction({ fallbackErrorMessage: "加载楼房失败" });
  const action = useAsyncAction();

  const [items, setItems] = useState<Building[]>([]);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [sort, setSort] = useState(0);
  const [remark, setRemark] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Building | null>(null);

  async function reload() {
    const res = await loader.run(() => fetchConsoleFacilityBuildings());
    if (!res) return;
    setItems(res);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => (editingId ? items.find((b) => b.id === editingId) ?? null : null), [editingId, items]);

  function resetForm(nextMode: Mode, next?: Building) {
    action.reset();
    setMode(nextMode);
    setEditingId(next?.id ?? null);
    setName(next?.name ?? "");
    setEnabled(next?.enabled ?? true);
    setSort(next?.sort ?? 0);
    setRemark(next?.remark ?? "");
  }

  async function submit() {
    const nameValue = name.trim();
    if (!nameValue) {
      action.setError("名称必填");
      return;
    }

    if (mode === "create") {
      const res = await action.run(
        () =>
          createConsoleFacilityBuilding({
            name: nameValue,
            enabled,
            sort,
            remark: remark.trim() ? remark.trim() : undefined,
          }),
        { fallbackErrorMessage: "创建失败" },
      );
      if (!res) return;
      setOpen(false);
      await reload();
      router.refresh();
      return;
    }

    if (!editingId) return;
    const ok = await action.run(
      () =>
        updateConsoleFacilityBuilding(editingId, {
          name: nameValue,
          enabled,
          sort,
          remark: remark.trim() ? remark.trim() : null,
        }),
      { fallbackErrorMessage: "保存失败" },
    );
    if (!ok) return;
    setOpen(false);
    await reload();
    router.refresh();
  }

  async function submitDelete(reason?: string) {
    if (!deleting) return;
    const ok = await action.run(() => deleteConsoleFacilityBuilding(deleting.id, { reason }), { fallbackErrorMessage: "删除失败" });
    if (!ok) return;
    setDeleteOpen(false);
    setDeleting(null);
    await reload();
    router.refresh();
  }

  return (
    <ConsolePage
      title="楼房"
      description="楼房为功能房的上层空间；删除为软删，且要求楼房下无房间。"
      meta={<Badge variant="secondary">{items.length} 栋</Badge>}
      actions={
        <Button
          size="sm"
          onClick={() => {
            resetForm("create");
            setOpen(true);
          }}
        >
          新增楼房
        </Button>
      }
    >
      <InlineError message={loader.error} />

      <ConsoleDataTable
        headers={
          <tr>
            <th className="px-3 py-2">名称</th>
            <th className="px-3 py-2">状态</th>
            <th className="px-3 py-2 text-right">排序</th>
            <th className="px-3 py-2">备注</th>
            <th className="px-3 py-2">更新时间</th>
            <th className="px-3 py-2 text-right">操作</th>
          </tr>
        }
        rowCount={items.length}
        emptyColSpan={6}
        emptyText={
          loader.pending ? (
            <div className="mx-auto w-full max-w-sm space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-36" />
            </div>
          ) : (
            "暂无楼房"
          )
        }
      >
        {items.map((b) => (
          <tr key={b.id} className="border-t border-border">
            <td className="px-3 py-3">
              <div className="text-sm font-medium">{b.name}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{b.id}</div>
            </td>
            <td className="px-3 py-3">{b.enabled ? <Badge>启用</Badge> : <Badge variant="secondary">停用</Badge>}</td>
            <td className="px-3 py-3 text-right tabular-nums">{b.sort}</td>
            <td className="px-3 py-3 text-sm text-muted-foreground">{b.remark ?? "—"}</td>
            <td className="px-3 py-3 text-xs text-muted-foreground">{formatZhDateTime(new Date(b.updatedAt))}</td>
            <td className="px-3 py-3 text-right">
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={action.pending}
                  onClick={() => {
                    resetForm("edit", b);
                    setOpen(true);
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
                    setDeleting(b);
                    setDeleteOpen(true);
                  }}
                >
                  删除
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </ConsoleDataTable>

      <ConsoleFormDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setOpen(false);
          else setOpen(true);
        }}
        title={mode === "create" ? "新增楼房" : "编辑楼房"}
        description={mode === "create" ? "建议用“教学楼 A / 实训楼 / 图书馆”等命名；sort 越小越靠前。" : "修改名称/启停/排序/备注。"}
        pending={action.pending}
        error={action.error}
        confirmText={mode === "create" ? "创建" : "保存"}
        confirmDisabled={!name.trim()}
        onConfirm={() => void submit()}
      >
        {mode === "edit" && selected ? (
          <div className="grid gap-2">
            <Label>楼房 ID</Label>
            <div className="rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">{selected.id}</div>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label>名称</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 教学楼 A" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>排序（sort）</Label>
            <Input
              value={String(sort)}
              onChange={(e) => setSort(Number(e.target.value))}
              inputMode="numeric"
              type="number"
              min={0}
              max={9999}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">启用</div>
              <div className="text-xs text-muted-foreground">Portal 仅展示启用楼房。</div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>备注（可选）</Label>
          <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="可填写位置、说明、管理口径…" />
        </div>
      </ConsoleFormDialog>

      <ConsoleDeleteDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!next) setDeleteOpen(false);
          else setDeleteOpen(true);
        }}
        title={deleting ? `删除楼房：${deleting.name}` : "删除楼房"}
        description="删除为软删；且楼房下仍存在房间时将被拒绝。"
        pending={action.pending}
        error={action.error}
        confirmText="确认删除"
        onConfirm={({ reason }) => void submitDelete(reason)}
      />
    </ConsolePage>
  );
}
