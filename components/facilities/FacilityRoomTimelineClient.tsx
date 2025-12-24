/**
 * 用法：
 * - Portal 单房间页时间轴（含发起预约）：
 *   <FacilityRoomTimelineClient userId="..." roomId="..." />
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { InlineError } from "@/components/common/InlineError";
import { FiltersPanel } from "@/components/common/FiltersPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { FacilityFloorGantt, type FacilityRoomRow, type FacilityTimelineItem } from "@/components/facilities/FacilityFloorGantt";
import { ReservationEditorDialog } from "@/components/facilities/ReservationEditorDialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFacilityRoomTimeline, type RoomTimelineResponse } from "@/lib/api/facilities";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { useFacilityPortalConfig } from "@/lib/hooks/useFacilityPortalConfig";
import {
  DEFAULT_FACILITY_TIMELINE_DAYS,
  DEFAULT_FACILITY_TIMELINE_TICK_HOURS,
  FACILITY_TIMELINE_TICK_HOURS,
  FACILITY_TIMELINE_WINDOW_DAYS,
  formatFacilityFloorLabel,
} from "@/lib/modules/facilities/facilities.ui";

type Props = {
  userId: string;
  roomId: string;
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

function isoToLocalDateString(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return todayLocalDateString();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function FacilityRoomTimelineClient(props: Props) {
  const sp = useSearchParams();
  const portalConfig = useFacilityPortalConfig();
  const timelineAction = useAsyncAction({ fallbackErrorMessage: "加载时间轴失败" });

  const initialDays = useMemo<Days>(() => {
    const raw = sp.get("days");
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && FACILITY_TIMELINE_WINDOW_DAYS.some((d) => d === n)) return n as Days;
    return DEFAULT_FACILITY_TIMELINE_DAYS;
  }, [sp]);
  const initialFromDate = useMemo(() => {
    const raw = sp.get("from");
    return raw ? isoToLocalDateString(raw) : todayLocalDateString();
  }, [sp]);

  const [days, setDays] = useState<Days>(initialDays);
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [tickHours, setTickHours] = useState<TickHours>(DEFAULT_FACILITY_TIMELINE_TICK_HOURS);
  const [data, setData] = useState<RoomTimelineResponse | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStartAt, setDialogStartAt] = useState<Date>(new Date());
  const [dialogEndAt, setDialogEndAt] = useState<Date | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await timelineAction.run(() => fetchFacilityRoomTimeline({ roomId: props.roomId, from: localDayStartIso(fromDate), days }));
      if (!res) return;
      setData(res);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, fromDate, props.roomId]);

  const windowFrom = data ? new Date(data.window.from) : new Date(localDayStartIso(fromDate));
  const windowTo = data ? new Date(data.window.to) : new Date(windowFrom.getTime() + days * 24 * 60 * 60 * 1000);

  const roomRow: FacilityRoomRow | null = data
    ? {
        id: data.room.id,
        name: data.room.name,
        floorNo: data.room.floorNo,
        enabled: data.room.enabled,
        capacity: data.room.capacity,
        remark: data.room.remark,
      }
    : null;

  const items: FacilityTimelineItem[] = (data?.items ?? []).map((i) => ({
    id: i.id,
    roomId: i.roomId,
    status: i.status,
    startAt: new Date(i.startAt),
    endAt: new Date(i.endAt),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={data?.room.name ?? "房间时间轴"}
        description={data ? `${data.room.buildingName} / ${formatFacilityFloorLabel(data.room.floorNo)}` : <Skeleton className="h-4 w-48" />}
        actions={
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/facilities">
            ← 返回纵览
          </Link>
        }
      />

      <InlineError message={portalConfig.error || timelineAction.error} />

      <FiltersPanel>
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <Label>起始日期</Label>
            <Input uiSize="sm" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>窗口</Label>
            <Select uiSize="sm" value={String(days)} onChange={(e) => setDays(Number(e.target.value) as Days)}>
              {FACILITY_TIMELINE_WINDOW_DAYS.map((d) => (
                <option key={d} value={String(d)}>
                  {d} 天
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>刻度</Label>
            <Select uiSize="sm" value={String(tickHours)} onChange={(e) => setTickHours(Number(e.target.value) as TickHours)}>
              {FACILITY_TIMELINE_TICK_HOURS.map((h) => (
                <option key={h} value={String(h)}>
                  {h}h
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end md:col-span-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={timelineAction.pending}
              onClick={() => {
                if (timelineAction.pending) return;
                void (async () => {
                  const res = await timelineAction.run(() =>
                    fetchFacilityRoomTimeline({ roomId: props.roomId, from: localDayStartIso(fromDate), days }),
                  );
                  if (!res) return;
                  setData(res);
                })();
              }}
            >
              刷新
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:col-span-3">
            <Badge variant="secondary">
              显示 {days} 天（{windowFrom.toLocaleDateString()} - {windowTo.toLocaleDateString()}）
            </Badge>
            {data && !data.room.enabled ? <Badge variant="secondary">该房间已停用（仅可查看占用）</Badge> : null}
          </div>
        </div>
      </FiltersPanel>

      {roomRow ? (
        <>
          <FacilityFloorGantt
            buildingName={data!.room.buildingName}
            floorNo={data!.room.floorNo}
            window={{ from: windowFrom, to: windowTo }}
            rooms={[roomRow]}
            items={items}
            tickHours={tickHours}
            maxDurationHours={portalConfig.config?.maxDurationHours}
            canCreate={(room) => room.enabled}
            onCreate={({ room, startAt, endAt }) => {
              if (!room.enabled) return;
              setDialogStartAt(startAt);
              setDialogEndAt(endAt ?? null);
              setDialogOpen(true);
            }}
          />

          <ReservationEditorDialog
            userId={props.userId}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            mode="create"
            room={{
              id: data!.room.id,
              name: data!.room.name,
              buildingName: data!.room.buildingName,
              floorNo: data!.room.floorNo,
              enabled: data!.room.enabled,
            }}
            initialStartAt={dialogStartAt}
            initialEndAt={dialogEndAt ?? undefined}
            onSuccess={() => {
              void (async () => {
                const res = await timelineAction.run(() => fetchFacilityRoomTimeline({ roomId: props.roomId, from: localDayStartIso(fromDate), days }));
                if (!res) return;
                setData(res);
              })();
            }}
          />
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
