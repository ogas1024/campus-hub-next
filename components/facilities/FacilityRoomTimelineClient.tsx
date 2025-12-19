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
import { FacilityFloorGantt, type FacilityRoomRow, type FacilityTimelineItem } from "@/components/facilities/FacilityFloorGantt";
import { ReservationEditorDialog } from "@/components/facilities/ReservationEditorDialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fetchFacilityRoomTimeline, type RoomTimelineResponse } from "@/lib/api/facilities";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { formatFacilityFloorLabel } from "@/lib/modules/facilities/facilities.ui";

type Props = {
  userId: string;
  roomId: string;
};

type Days = 7 | 30;

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
  const timelineAction = useAsyncAction({ fallbackErrorMessage: "加载时间轴失败" });

  const initialDays = useMemo<Days>(() => (sp.get("days") === "7" ? 7 : 30), [sp]);
  const initialFromDate = useMemo(() => {
    const raw = sp.get("from");
    return raw ? isoToLocalDateString(raw) : todayLocalDateString();
  }, [sp]);

  const [days, setDays] = useState<Days>(initialDays);
  const [fromDate, setFromDate] = useState(initialFromDate);
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{data?.room.name ?? "房间时间轴"}</h1>
          {data ? (
            <p className="text-sm text-muted-foreground">
              {data.room.buildingName} / {formatFacilityFloorLabel(data.room.floorNo)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">加载中…</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/facilities">
            ← 返回纵览
          </Link>
        </div>
      </div>

      <InlineError message={timelineAction.error} />

      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <Label>起始日期</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>窗口</Label>
          <Select value={String(days)} onChange={(e) => setDays((e.target.value === "7" ? 7 : 30) as Days)}>
            <option value="7">7 天</option>
            <option value="30">30 天</option>
          </Select>
        </div>
        <div className="flex items-end md:col-span-2">
          <Button
            variant="outline"
            className="w-full"
            disabled={timelineAction.pending}
            onClick={() => {
              if (timelineAction.pending) return;
              void (async () => {
                const res = await timelineAction.run(() => fetchFacilityRoomTimeline({ roomId: props.roomId, from: localDayStartIso(fromDate), days }));
                if (!res) return;
                setData(res);
              })();
            }}
          >
            刷新
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:col-span-5">
          <Badge variant="secondary">
            显示 {days} 天（{windowFrom.toLocaleDateString()} - {windowTo.toLocaleDateString()}）
          </Badge>
          {data && !data.room.enabled ? <Badge variant="secondary">该房间已停用（仅可查看占用）</Badge> : null}
        </div>
      </div>

      {roomRow ? (
        <>
          <FacilityFloorGantt
            buildingName={data!.room.buildingName}
            floorNo={data!.room.floorNo}
            window={{ from: windowFrom, to: windowTo }}
            rooms={[roomRow]}
            items={items}
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
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">加载中…</div>
      )}
    </div>
  );
}
