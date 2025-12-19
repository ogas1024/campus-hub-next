"use client";

import { useEffect, useMemo, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  fetchFacilityFloorOverview,
  fetchFacilityFloors,
  type Building,
  type FloorOverviewResponse,
} from "@/lib/api/facilities";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { useFacilityPortalConfig } from "@/lib/hooks/useFacilityPortalConfig";
import {
  DEFAULT_FACILITY_TIMELINE_DAYS,
  DEFAULT_FACILITY_TIMELINE_TICK_HOURS,
  FACILITY_TIMELINE_TICK_HOURS,
  FACILITY_TIMELINE_WINDOW_DAYS,
  formatFacilityFloorLabel,
} from "@/lib/modules/facilities/facilities.ui";

import { FacilityFloorGantt, type FacilityRoomRow, type FacilityTimelineItem } from "./FacilityFloorGantt";
import { ReservationEditorDialog } from "./ReservationEditorDialog";

type Props = {
  userId: string;
  buildings: Building[];
};

type Days = (typeof FACILITY_TIMELINE_WINDOW_DAYS)[number];
type TickHours = (typeof FACILITY_TIMELINE_TICK_HOURS)[number];

function todayLocalDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localDayStartIso(date: string) {
  const [y, m, d] = date.split("-").map((v) => Number(v));
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return dt.toISOString();
}

export function FacilitiesOverviewClient(props: Props) {
  const portalConfig = useFacilityPortalConfig();
  const floorsAction = useAsyncAction({ fallbackErrorMessage: "加载楼层失败" });
  const overviewAction = useAsyncAction({ fallbackErrorMessage: "加载纵览失败" });

  const buildingOptions = props.buildings;
  const buildingMap = useMemo(() => new Map(buildingOptions.map((b) => [b.id, b])), [buildingOptions]);

  const [buildingId, setBuildingId] = useState(() => buildingOptions[0]?.id ?? "");
  const [floors, setFloors] = useState<number[]>([]);
  const [floorNo, setFloorNo] = useState<number | null>(null);
  const [days, setDays] = useState<Days>(DEFAULT_FACILITY_TIMELINE_DAYS);
  const [fromDate, setFromDate] = useState(() => todayLocalDateString());
  const [tickHours, setTickHours] = useState<TickHours>(DEFAULT_FACILITY_TIMELINE_TICK_HOURS);

  const [overview, setOverview] = useState<FloorOverviewResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStartAt, setDialogStartAt] = useState<Date>(new Date());
  const [dialogEndAt, setDialogEndAt] = useState<Date | null>(null);
  const [dialogRoom, setDialogRoom] = useState<{ id: string; name: string; floorNo: number; buildingName: string; enabled: boolean } | null>(null);

  const buildingName = buildingMap.get(buildingId)?.name ?? "";

  function openCreate(room: FacilityRoomRow, startAt: Date, endAt?: Date) {
    setDialogRoom({ id: room.id, name: room.name, floorNo: room.floorNo, buildingName, enabled: room.enabled });
    setDialogStartAt(startAt);
    setDialogEndAt(endAt ?? null);
    setDialogOpen(true);
  }

  async function refreshFloors(nextBuildingId: string) {
    const res = await floorsAction.run(() => fetchFacilityFloors(nextBuildingId));
    if (!res) return;
    setFloors(res.floors);
    const nextFloor = res.floors[0] ?? null;
    setFloorNo((prev) => (prev != null && res.floors.includes(prev) ? prev : nextFloor));
  }

  async function refreshOverview(params: { buildingId: string; floorNo: number; from: string; days: Days }) {
    const res = await overviewAction.run(() => fetchFacilityFloorOverview(params));
    if (!res) return;
    setOverview(res);
  }

  useEffect(() => {
    if (!buildingId) return;
    void refreshFloors(buildingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  useEffect(() => {
    if (!buildingId || floorNo == null) {
      setOverview(null);
      return;
    }
    void refreshOverview({ buildingId, floorNo, from: localDayStartIso(fromDate), days });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId, days, floorNo, fromDate]);

  const windowFrom = overview ? new Date(overview.window.from) : new Date(localDayStartIso(fromDate));
  const windowTo = overview ? new Date(overview.window.to) : new Date(windowFrom.getTime() + days * 24 * 60 * 60 * 1000);

  const rooms: FacilityRoomRow[] = (overview?.rooms ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    floorNo: r.floorNo,
    enabled: r.enabled,
    capacity: r.capacity,
    remark: r.remark,
  }));

  const items: FacilityTimelineItem[] = (overview?.items ?? []).map((i) => ({
    id: i.id,
    roomId: i.roomId,
    status: i.status,
    startAt: new Date(i.startAt),
    endAt: new Date(i.endAt),
  }));

  return (
    <div className="space-y-4">
      <InlineError message={portalConfig.error || floorsAction.error || overviewAction.error} />

      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
          <Label>楼房</Label>
          <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            {buildingOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="md:col-span-2">
          <Label>楼层</Label>
          <Select value={floorNo == null ? "" : String(floorNo)} onChange={(e) => setFloorNo(e.target.value ? Number(e.target.value) : null)}>
            {floors.map((f) => (
              <option key={f} value={String(f)}>
                {formatFacilityFloorLabel(f)}
              </option>
            ))}
          </Select>
        </div>

        <div className="md:col-span-3">
          <Label>起始日期</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>

        <div className="md:col-span-1">
          <Label>窗口</Label>
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value) as Days)}>
            {FACILITY_TIMELINE_WINDOW_DAYS.map((d) => (
              <option key={d} value={String(d)}>
                {d} 天
              </option>
            ))}
          </Select>
        </div>

        <div className="md:col-span-1">
          <Label>刻度</Label>
          <Select value={String(tickHours)} onChange={(e) => setTickHours(Number(e.target.value) as TickHours)}>
            {FACILITY_TIMELINE_TICK_HOURS.map((h) => (
              <option key={h} value={String(h)}>
                {h}h
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-end gap-2 md:col-span-1">
          <Button
            variant="outline"
            className="w-full"
            disabled={!buildingId || floorNo == null || overviewAction.pending}
            onClick={() => {
              if (!buildingId || floorNo == null) return;
              void refreshOverview({ buildingId, floorNo, from: localDayStartIso(fromDate), days });
            }}
          >
            刷新
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">房间 {rooms.length} 间</Badge>
        <Badge variant="secondary">
          显示 {days} 天（{windowFrom.toLocaleDateString()} - {windowTo.toLocaleDateString()}）
        </Badge>
      </div>

      <FacilityFloorGantt
        buildingName={buildingName}
        floorNo={floorNo ?? 0}
        window={{ from: windowFrom, to: windowTo }}
        rooms={rooms}
        items={items}
        tickHours={tickHours}
        maxDurationHours={portalConfig.config?.maxDurationHours}
        canCreate={(room) => room.enabled}
        onCreate={({ room, startAt, endAt }) => openCreate(room, startAt, endAt)}
      />

      {dialogRoom ? (
        <ReservationEditorDialog
          userId={props.userId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode="create"
          room={dialogRoom}
          initialStartAt={dialogStartAt}
          initialEndAt={dialogEndAt ?? undefined}
          onSuccess={() => {
            if (!buildingId || floorNo == null) return;
            void refreshOverview({ buildingId, floorNo, from: localDayStartIso(fromDate), days });
          }}
        />
      ) : null}
    </div>
  );
}
