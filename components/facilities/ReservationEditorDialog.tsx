"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMyReservation, fetchMyReservationDetail, updateMyReservation, type MyReservationDetail } from "@/lib/api/me-reservations";
import type { UserSearchItem } from "@/lib/api/users";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { formatFacilityFloorLabel } from "@/lib/modules/facilities/facilities.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";

import { ParticipantPicker } from "./ParticipantPicker";

type RoomInfo = { id: string; name: string; buildingName: string; floorNo: number; enabled: boolean };

type CreateModeProps = {
  mode: "create";
  room: RoomInfo;
  initialStartAt: Date;
  initialEndAt?: Date;
};

type ResubmitModeProps = {
  mode: "resubmit";
  reservationId: string;
};

type Props = {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
} & (CreateModeProps | ResubmitModeProps);

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDatetimeLocalValue(date: Date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

const DEFAULT_DURATION_HOURS = 2;

export function ReservationEditorDialog(props: Props) {
  const key =
    props.mode === "create"
      ? `create:${props.room.id}:${props.initialStartAt.toISOString()}:${props.initialEndAt ? props.initialEndAt.toISOString() : ""}:${props.open ? "1" : "0"}`
      : `resubmit:${props.reservationId}:${props.open ? "1" : "0"}`;
  return <ReservationEditorDialogInner key={key} {...props} />;
}

function ReservationEditorDialogInner(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();
  const loader = useAsyncAction({ fallbackErrorMessage: "加载失败" });

  const [room, setRoom] = useState<RoomInfo | null>(() => (props.mode === "create" ? props.room : null));
  const [reservation, setReservation] = useState<MyReservationDetail | null>(null);

  const [purpose, setPurpose] = useState("");
  const [startLocal, setStartLocal] = useState(() => {
    if (props.mode !== "create") return "";
    const start = new Date(props.initialStartAt);
    return toDatetimeLocalValue(start);
  });
  const [endLocal, setEndLocal] = useState(() => {
    if (props.mode !== "create") return "";
    const start = new Date(props.initialStartAt);
    const initialEnd = props.initialEndAt ? new Date(props.initialEndAt) : null;
    const end =
      initialEnd && Number.isFinite(initialEnd.getTime()) && initialEnd.getTime() > start.getTime()
        ? initialEnd
        : new Date(start.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);
    return toDatetimeLocalValue(end);
  });
  const [selected, setSelected] = useState<UserSearchItem[]>([]);

  const totalCount = selected.length + 1;
  const canSubmit = useMemo(() => {
    if (!room) return false;
    if (!purpose.trim()) return false;
    if (!startLocal || !endLocal) return false;
    if (totalCount < 3) return false;
    const start = new Date(startLocal);
    const end = new Date(endLocal);
    if (!Number.isFinite(start.getTime())) return false;
    if (!Number.isFinite(end.getTime())) return false;
    if (end.getTime() <= start.getTime()) return false;
    if (props.mode === "resubmit" && reservation?.status !== "rejected") return false;
    return true;
  }, [endLocal, props.mode, purpose, reservation?.status, room, startLocal, totalCount]);

  async function loadResubmit(reservationId: string) {
    const detail = await loader.run(() => fetchMyReservationDetail(reservationId));
    if (!detail) return;

    setReservation(detail);
    setRoom({
      id: detail.room.id,
      name: detail.room.name,
      buildingName: detail.building.name,
      floorNo: detail.room.floorNo,
      enabled: true,
    });
    setPurpose(detail.purpose);

    const start = new Date(detail.startAt);
    const end = new Date(detail.endAt);
    setStartLocal(toDatetimeLocalValue(start));
    setEndLocal(toDatetimeLocalValue(end));

    setSelected(detail.participants.filter((p) => !p.isApplicant).map((p) => ({ id: p.id, name: p.name, studentId: p.studentId })));
  }

  useEffect(() => {
    if (!props.open) return;
    if (props.mode !== "resubmit") return;
    void loadResubmit(props.reservationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.mode, props.mode === "resubmit" ? props.reservationId : null]);

  async function submit() {
    if (!room) return;
    const start = new Date(startLocal);
    const end = new Date(endLocal);
    if (!Number.isFinite(start.getTime())) {
      action.setError("开始时间无效");
      return;
    }
    if (!Number.isFinite(end.getTime())) {
      action.setError("结束时间无效");
      return;
    }

    const participantUserIds = selected.map((u) => u.id);

    if (props.mode === "create") {
      const res = await action.run(
        () =>
          createMyReservation({
            roomId: room.id,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            purpose: purpose.trim(),
            participantUserIds,
          }),
        { fallbackErrorMessage: "创建失败" },
      );
      if (!res) return;

      props.onOpenChange(false);
      props.onSuccess?.();
      router.refresh();
      return;
    }

    if (!reservation) return;

    const ok = await action.run(
      () =>
        updateMyReservation(reservation.id, {
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          purpose: purpose.trim(),
          participantUserIds,
        }),
      { fallbackErrorMessage: "重提失败" },
    );
    if (!ok) return;

    props.onOpenChange(false);
    props.onSuccess?.();
    router.refresh();
  }

  function applyDuration(hours: number) {
    const start = new Date(startLocal);
    if (!Number.isFinite(start.getTime())) return;
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
    setEndLocal(toDatetimeLocalValue(end));
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "提交预约" : "修改并重提"}</DialogTitle>
          <DialogDescription>
            {room ? (
              <>
                {room.buildingName} / {formatFacilityFloorLabel(room.floorNo)} / {room.name}
              </>
            ) : (
              "加载中…"
            )}
          </DialogDescription>
        </DialogHeader>

        <InlineError message={loader.error || action.error} />

        {reservation?.status === "rejected" && reservation.rejectReason ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
            <div className="font-medium text-rose-700">驳回原因</div>
            <div className="mt-1 text-rose-700/90">{reservation.rejectReason}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              当前时间段：{formatZhDateTime(new Date(reservation.startAt))} - {formatZhDateTime(new Date(reservation.endAt))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>使用目的</Label>
            <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="请输入用途（1~200 字）" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>开始时间</Label>
              <Input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => {
                  const nextStartLocal = e.target.value;
                  setStartLocal(nextStartLocal);

                  const start = new Date(nextStartLocal);
                  if (!Number.isFinite(start.getTime())) return;

                  const end = new Date(endLocal);
                  if (!Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()) {
                    const nextEnd = new Date(start.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);
                    setEndLocal(toDatetimeLocalValue(nextEnd));
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>结束时间</Label>
              <Input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[1, 2, 4, 8, 24].map((h) => (
              <Button key={h} type="button" variant="outline" size="sm" onClick={() => applyDuration(h)}>
                {h}h
              </Button>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => applyDuration(72)}>
              72h
            </Button>
          </div>

          <div className="grid gap-2">
            <Label>使用人（含申请人不少于 3 人）</Label>
            <ParticipantPicker userId={props.userId} value={selected} onChange={setSelected} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={action.pending}>
            取消
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit || action.pending}>
            {props.mode === "create" ? "提交" : "重提"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
