/**
 * 用法：
 * - Console 房间管理页组件（由 `/console/facilities/rooms` 引用）。
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ConsoleDataTable } from "@/components/console/crud/ConsoleDataTable";
import { ConsoleDeleteDialog } from "@/components/console/crud/ConsoleDeleteDialog";
import { ConsoleFormDialog } from "@/components/console/crud/ConsoleFormDialog";
import { ConsolePage } from "@/components/console/crud/ConsolePage";
import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createConsoleFacilityRoom,
  deleteConsoleFacilityRoom,
  fetchConsoleFacilityBuildings,
  fetchConsoleFacilityRooms,
  updateConsoleFacilityRoom,
  type Building,
  type Room,
} from "@/lib/api/console-facilities";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { formatFacilityFloorLabel } from "@/lib/modules/facilities/facilities.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";

type Mode = "create" | "edit";

export function ConsoleRoomsManager() {
  const router = useRouter();
  const loader = useAsyncAction({ fallbackErrorMessage: "加载失败" });
  const action = useAsyncAction();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [floorFilter, setFloorFilter] = useState<string>("");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editing, setEditing] = useState<Room | null>(null);

  const [formBuildingId, setFormBuildingId] = useState("");
  const [formFloorNo, setFormFloorNo] = useState(1);
  const [formName, setFormName] = useState("");
  const [formCapacity, setFormCapacity] = useState<string>("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formSort, setFormSort] = useState(0);
  const [formRemark, setFormRemark] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Room | null>(null);

  async function loadBuildings() {
    const res = await loader.run(() => fetchConsoleFacilityBuildings());
    if (!res) return;
    setBuildings(res);
    if (!selectedBuildingId && res[0]) setSelectedBuildingId(res[0].id);
  }

  async function loadRooms(buildingId: string) {
    if (!buildingId) {
      setAllRooms([]);
      return;
    }
    const res = await loader.run(() => fetchConsoleFacilityRooms({ buildingId }));
    if (!res) return;
    setAllRooms(res);
  }

  useEffect(() => {
    void loadBuildings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedBuildingId) return;
    void loadRooms(selectedBuildingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuildingId]);

  const floorOptions = useMemo(() => {
    const set = new Set<number>();
    for (const r of allRooms) set.add(r.floorNo);
    return [...set].sort((a, b) => b - a);
  }, [allRooms]);

  const floorNo = floorFilter && /^-?\d+$/.test(floorFilter) ? Number(floorFilter) : null;
  const rooms = useMemo(() => {
    if (typeof floorNo !== "number") return allRooms;
    return allRooms.filter((r) => r.floorNo === floorNo);
  }, [allRooms, floorNo]);

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? null;

  function resetForm(nextMode: Mode, room?: Room) {
    action.reset();
    setMode(nextMode);
    setEditing(room ?? null);

    setFormBuildingId(room?.buildingId ?? selectedBuildingId ?? "");
    setFormFloorNo(room?.floorNo ?? (typeof floorNo === "number" ? floorNo : 1));
    setFormName(room?.name ?? "");
    setFormCapacity(room?.capacity != null ? String(room.capacity) : "");
    setFormEnabled(room?.enabled ?? true);
    setFormSort(room?.sort ?? 0);
    setFormRemark(room?.remark ?? "");
  }

  async function submit() {
    const buildingIdValue = formBuildingId || selectedBuildingId;
    if (!buildingIdValue) {
      action.setError("请先选择楼房");
      return;
    }
    const nameValue = formName.trim();
    if (!nameValue) {
      action.setError("名称必填");
      return;
    }

    const capacityText = formCapacity.trim();
    const capacityValue = capacityText ? Number(capacityText) : null;
    if (capacityValue != null && (!Number.isFinite(capacityValue) || !Number.isInteger(capacityValue) || capacityValue < 0)) {
      action.setError("容量必须为非负整数或留空");
      return;
    }

    if (mode === "create") {
      const res = await action.run(
        () =>
          createConsoleFacilityRoom({
            buildingId: buildingIdValue,
            floorNo: formFloorNo,
            name: nameValue,
            capacity: capacityValue,
            enabled: formEnabled,
            sort: formSort,
            remark: formRemark.trim() ? formRemark.trim() : undefined,
          }),
        { fallbackErrorMessage: "创建失败" },
      );
      if (!res) return;
      setOpen(false);
      await loadRooms(selectedBuildingId);
      router.refresh();
      return;
    }

    if (!editing) return;
    const ok = await action.run(
      () =>
        updateConsoleFacilityRoom(editing.id, {
          floorNo: formFloorNo,
          name: nameValue,
          capacity: capacityValue,
          enabled: formEnabled,
          sort: formSort,
          remark: formRemark.trim() ? formRemark.trim() : null,
        }),
      { fallbackErrorMessage: "保存失败" },
    );
    if (!ok) return;
    setOpen(false);
    await loadRooms(selectedBuildingId);
    router.refresh();
  }

  async function submitDelete(reason?: string) {
    if (!deleting) return;
    const ok = await action.run(() => deleteConsoleFacilityRoom(deleting.id, { reason }), { fallbackErrorMessage: "删除失败" });
    if (!ok) return;
    setDeleteOpen(false);
    setDeleting(null);
    await loadRooms(selectedBuildingId);
    router.refresh();
  }

  if (buildings.length === 0 && loader.pending) {
    return (
      <ConsolePage title="房间" description="加载中…">
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">加载中…</div>
      </ConsolePage>
    );
  }

  if (buildings.length === 0) {
    return (
      <ConsolePage title="房间" description="请先创建楼房，再创建房间。">
        <InlineError message={loader.error} />
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          暂无楼房。
          <div className="mt-3">
            <Link className={buttonVariants({ size: "sm" })} href="/console/facilities/buildings">
              去创建楼房
            </Link>
          </div>
        </div>
      </ConsolePage>
    );
  }

  return (
    <ConsolePage
      title="房间"
      description="楼房/楼层/房间三级管理：以 room.floorNo 表示楼层；删除要求该房间无任何预约记录。"
      meta={
        <div className="flex flex-wrap gap-2">
          {selectedBuilding ? <Badge variant="secondary">{selectedBuilding.name}</Badge> : null}
          {typeof floorNo === "number" ? (
            <Badge variant="secondary">楼层 {formatFacilityFloorLabel(floorNo)}</Badge>
          ) : (
            <Badge variant="secondary">全部楼层</Badge>
          )}
          <Badge variant="secondary">{rooms.length} 间</Badge>
        </div>
      }
      actions={
        <Button
          size="sm"
          onClick={() => {
            resetForm("create");
            setOpen(true);
          }}
        >
          新增房间
        </Button>
      }
    >
      <InlineError message={loader.error} />

      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
          <Label className="text-xs text-muted-foreground">楼房</Label>
          <Select
            value={selectedBuildingId}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedBuildingId(next);
              setFloorFilter("");
            }}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.enabled ? "" : "（停用）"}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs text-muted-foreground">楼层</Label>
          <Select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
            <option value="">全部楼层</option>
            {floorOptions.map((f) => (
              <option key={f} value={String(f)}>
                {formatFacilityFloorLabel(f)}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:col-span-5">
          <Label className="text-xs text-muted-foreground">提示</Label>
          <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            楼层不单独建表；如需“整层停用”，可筛选楼层后批量编辑（后续增强）。
          </div>
        </div>
      </div>

      <ConsoleDataTable
        headers={
          <tr>
            <th className="px-3 py-2">房间</th>
            <th className="px-3 py-2">状态</th>
            <th className="px-3 py-2 text-right">容量</th>
            <th className="px-3 py-2 text-right">排序</th>
            <th className="px-3 py-2">备注</th>
            <th className="px-3 py-2">更新时间</th>
            <th className="px-3 py-2 text-right">操作</th>
          </tr>
        }
        rowCount={rooms.length}
        emptyColSpan={7}
        emptyText={loader.pending ? "加载中…" : "暂无房间"}
      >
        {rooms.map((r) => (
          <tr key={r.id} className="border-t border-border">
            <td className="px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link className="line-clamp-1 font-medium hover:underline" href={`/facilities/rooms/${r.id}`}>
                  {r.name}
                </Link>
                <Badge variant="secondary">{formatFacilityFloorLabel(r.floorNo)}</Badge>
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{r.id}</div>
            </td>
            <td className="px-3 py-3">{r.enabled ? <Badge>启用</Badge> : <Badge variant="secondary">停用</Badge>}</td>
            <td className="px-3 py-3 text-right tabular-nums">{r.capacity ?? "—"}</td>
            <td className="px-3 py-3 text-right tabular-nums">{r.sort}</td>
            <td className="px-3 py-3 text-sm text-muted-foreground">{r.remark ?? "—"}</td>
            <td className="px-3 py-3 text-xs text-muted-foreground">{formatZhDateTime(new Date(r.updatedAt))}</td>
            <td className="px-3 py-3 text-right">
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={action.pending}
                  onClick={() => {
                    resetForm("edit", r);
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
                    setDeleting(r);
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
        title={mode === "create" ? "新增房间" : "编辑房间"}
        description={mode === "create" ? "支持负数楼层（如 -1 表示地下一层）。" : "支持修改楼层/名称/容量/启停/排序/备注。"}
        pending={action.pending}
        error={action.error}
        confirmText={mode === "create" ? "创建" : "保存"}
        confirmDisabled={!formName.trim() || !formBuildingId}
        onConfirm={() => void submit()}
      >
        {mode === "edit" && editing ? (
          <div className="grid gap-2">
            <Label>房间 ID</Label>
            <div className="rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">{editing.id}</div>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label>楼房</Label>
          <Select
            value={formBuildingId}
            onChange={(e) => setFormBuildingId(e.target.value)}
            disabled={mode === "edit"}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          {mode === "edit" ? <div className="text-xs text-muted-foreground">编辑时不支持变更楼房归属。</div> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>楼层（floorNo）</Label>
            <Input
              value={String(formFloorNo)}
              onChange={(e) => setFormFloorNo(Number(e.target.value))}
              inputMode="numeric"
              type="number"
              min={-50}
              max={200}
            />
          </div>
          <div className="grid gap-2">
            <Label>容量（可选）</Label>
            <Input value={formCapacity} onChange={(e) => setFormCapacity(e.target.value)} inputMode="numeric" type="number" min={0} max={9999} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>名称</Label>
          <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="例如 101 / 会议室 / 活动室" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>排序（sort）</Label>
            <Input value={String(formSort)} onChange={(e) => setFormSort(Number(e.target.value))} inputMode="numeric" type="number" min={0} max={9999} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">启用</div>
              <div className="text-xs text-muted-foreground">停用后禁止新增预约。</div>
            </div>
            <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>备注（可选）</Label>
          <Textarea value={formRemark} onChange={(e) => setFormRemark(e.target.value)} placeholder="可填写设备、用途、注意事项…" />
        </div>
      </ConsoleFormDialog>

      <ConsoleDeleteDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!next) setDeleteOpen(false);
          else setDeleteOpen(true);
        }}
        title={deleting ? `删除房间：${deleting.name}` : "删除房间"}
        description="删除为软删；房间存在任何预约记录时将被拒绝（建议改为“停用”）。"
        pending={action.pending}
        error={action.error}
        confirmText="确认删除"
        onConfirm={({ reason }) => void submitDelete(reason)}
      />
    </ConsolePage>
  );
}
