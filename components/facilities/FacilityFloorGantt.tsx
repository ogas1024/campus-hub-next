"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFacilityFloorLabel } from "@/lib/modules/facilities/facilities.ui";
import { formatZhDateTime } from "@/lib/ui/datetime";
import { cn } from "@/lib/utils";

export type FacilityRoomRow = {
  id: string;
  name: string;
  floorNo: number;
  enabled: boolean;
  capacity: number | null;
  remark: string | null;
};

export type FacilityTimelineItem = {
  id: string;
  roomId: string;
  status: "pending" | "approved";
  startAt: Date;
  endAt: Date;
};

type Props = {
  buildingName: string;
  floorNo: number;
  window: { from: Date; to: Date };
  rooms: FacilityRoomRow[];
  items: FacilityTimelineItem[];
  canCreate: (room: FacilityRoomRow) => boolean;
  onCreate: (params: { room: FacilityRoomRow; startAt: Date; endAt?: Date }) => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SNAP_MINUTES = 30;
const SNAP_MS = SNAP_MINUTES * 60 * 1000;
const DAY_WIDTH = 120;
const LEFT_COL_WIDTH = 240;
const DRAG_THRESHOLD_PX = 6;
const EDGE_SCROLL_THRESHOLD_PX = 48;
const EDGE_SCROLL_MAX_SPEED_PX = 18;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatMd(value: Date) {
  const m = pad2(value.getMonth() + 1);
  const d = pad2(value.getDate());
  return `${m}-${d}`;
}

function formatHm(value: Date) {
  const hh = pad2(value.getHours());
  const mm = pad2(value.getMinutes());
  return `${hh}:${mm}`;
}

function formatHeaderDay(value: Date) {
  const m = pad2(value.getMonth() + 1);
  const d = pad2(value.getDate());
  const w = ["日", "一", "二", "三", "四", "五", "六"][value.getDay()] ?? "";
  return `${m}-${d} 周${w}`;
}

function snapToSlot(value: number) {
  return Math.floor(value / SNAP_MS) * SNAP_MS;
}

function snapUpToSlot(value: number) {
  return Math.ceil(value / SNAP_MS) * SNAP_MS;
}

function formatDurationMinutes(totalMinutes: number) {
  const total = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m} 分钟`;
  if (m <= 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分钟`;
}

export function FacilityFloorGantt(props: Props) {
  const fromMs = props.window.from.getTime();
  const toMs = props.window.to.getTime();
  const durationMs = Math.max(1, toMs - fromMs);

  const dayCount = useMemo(() => Math.max(1, Math.round(durationMs / DAY_MS)), [durationMs]);
  const days = useMemo(() => Array.from({ length: dayCount }, (_, i) => new Date(fromMs + i * DAY_MS)), [dayCount, fromMs]);

  const byRoomId = useMemo(() => {
    const map = new Map<string, FacilityTimelineItem[]>();
    for (const it of props.items) {
      const list = map.get(it.roomId) ?? [];
      list.push(it);
      map.set(it.roomId, list);
    }
    for (const [, list] of map) list.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return map;
  }, [props.items]);

  const timeAreaWidth = dayCount * DAY_WIDTH;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragTargetRef = useRef<HTMLDivElement | null>(null);
  const dragClientXRef = useRef<number | null>(null);

  const [drag, setDrag] = useState<{
    roomId: string;
    pointerId: number;
    startClientX: number;
    startMs: number;
    currentMs: number;
  } | null>(null);

  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const nowPercent = nowMs >= fromMs && nowMs <= toMs ? ((nowMs - fromMs) / durationMs) * 100 : null;
  const hoverPercent = hoverMs != null ? ((hoverMs - fromMs) / durationMs) * 100 : null;

  useEffect(() => {
    const handle = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(handle);
  }, []);

  function msFromClientX(el: HTMLDivElement, clientX: number) {
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = rect.width <= 1 ? 0 : x / rect.width;
    const raw = fromMs + ratio * durationMs;
    const snapped = snapToSlot(raw);
    return Math.max(fromMs, Math.min(toMs, snapped));
  }

  useEffect(() => {
    if (!drag) return;
    const pointerId = drag.pointerId;

    let rafId = 0;
    const step = () => {
      const scroller = scrollRef.current;
      const clientX = dragClientXRef.current;
      const target = dragTargetRef.current;

      if (scroller && typeof clientX === "number") {
        const rect = scroller.getBoundingClientRect();

        let delta = 0;
        if (clientX < rect.left + EDGE_SCROLL_THRESHOLD_PX) {
          const t = (rect.left + EDGE_SCROLL_THRESHOLD_PX - clientX) / EDGE_SCROLL_THRESHOLD_PX;
          delta = -EDGE_SCROLL_MAX_SPEED_PX * Math.min(1, Math.max(0, t));
        } else if (clientX > rect.right - EDGE_SCROLL_THRESHOLD_PX) {
          const t = (clientX - (rect.right - EDGE_SCROLL_THRESHOLD_PX)) / EDGE_SCROLL_THRESHOLD_PX;
          delta = EDGE_SCROLL_MAX_SPEED_PX * Math.min(1, Math.max(0, t));
        }

        if (delta !== 0) {
          const next = Math.max(0, Math.min(scroller.scrollLeft + delta, scroller.scrollWidth - scroller.clientWidth));
          scroller.scrollLeft = next;

          if (target) {
            const ms = msFromClientX(target, clientX);
            setDrag((prev) => {
              if (!prev) return prev;
              if (prev.pointerId !== pointerId) return prev;
              if (prev.currentMs === ms) return prev;
              return { ...prev, currentMs: ms };
            });
            setHoverMs(ms);
          }
        }
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.pointerId, fromMs, durationMs, toMs]);

  return (
    <div ref={scrollRef} className="overflow-x-auto rounded-xl border border-border bg-card">
      <div style={{ minWidth: LEFT_COL_WIDTH + timeAreaWidth }}>
        <div className="sticky top-0 z-10 flex border-b border-border bg-card">
          <div className="shrink-0 border-r border-border px-3 py-2" style={{ width: LEFT_COL_WIDTH }}>
            <div className="text-sm font-semibold">房间</div>
            <div className="text-xs text-muted-foreground">
              {props.buildingName} / {formatFacilityFloorLabel(props.floorNo)}
            </div>
          </div>
          <div className="relative flex" style={{ width: timeAreaWidth }}>
            {days.map((d) => (
              <div key={d.toISOString()} className="border-r border-border px-2 py-2 text-xs text-muted-foreground" style={{ width: DAY_WIDTH }}>
                {formatHeaderDay(d)}
              </div>
            ))}

            {typeof hoverPercent === "number" ? (
              <>
                <div className="pointer-events-none absolute inset-y-0 w-px bg-sky-500/60" style={{ left: `${hoverPercent}%` }} />
                <div
                  className="pointer-events-none absolute top-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-700"
                  style={{ left: `${Math.min(98, Math.max(2, hoverPercent))}%`, transform: "translateX(-50%)" }}
                >
                  指针 {formatMd(new Date(hoverMs!))} {formatHm(new Date(hoverMs!))}
                </div>
              </>
            ) : null}

            {typeof nowPercent === "number" ? (
              <div className="pointer-events-none absolute inset-y-0 w-px bg-rose-500/60" style={{ left: `${nowPercent}%` }} />
            ) : null}
          </div>
        </div>

        <div className="divide-y divide-border">
          {props.rooms.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">该楼层暂无房间（或未启用）。</div>
          ) : (
            props.rooms.map((room) => {
              const roomItems = byRoomId.get(room.id) ?? [];
              const createDisabled = !props.canCreate(room);

              const activeDrag = drag?.roomId === room.id ? drag : null;
              const selection = activeDrag
                ? {
                    startMs: Math.min(activeDrag.startMs, activeDrag.currentMs),
                    endMs: Math.max(activeDrag.startMs, activeDrag.currentMs),
                  }
                : null;

              return (
                <div key={room.id} className="flex">
                  <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-card px-3 py-3" style={{ width: LEFT_COL_WIDTH }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link className="line-clamp-1 font-medium hover:underline" href={`/facilities/rooms/${room.id}`}>
                          {room.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {!room.enabled ? <Badge variant="secondary">停用</Badge> : null}
                          {typeof room.capacity === "number" ? <span className="text-xs text-muted-foreground">容量 {room.capacity}</span> : null}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={createDisabled}
                        onClick={() => props.onCreate({ room, startAt: new Date(snapToSlot(Date.now())) })}
                      >
                        预约
                      </Button>
                    </div>

                    <div className="mt-2 font-mono text-[11px] text-muted-foreground">{room.id}</div>
                  </div>

                  <div
                    className={cn("relative h-14", createDisabled ? "cursor-not-allowed" : "cursor-crosshair")}
                    style={{
                      width: timeAreaWidth,
                      backgroundImage:
                        "repeating-linear-gradient(to right, transparent, transparent calc(120px - 1px), hsl(var(--border)) calc(120px - 1px), hsl(var(--border)) 120px)",
                      backgroundSize: `${DAY_WIDTH}px 100%`,
                    }}
                    onPointerDown={(e) => {
                      if (createDisabled) return;
                      const target = e.target as HTMLElement;
                      if (target.dataset.kind === "bar") return;

                      const ms = msFromClientX(e.currentTarget, e.clientX);

                      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                      dragTargetRef.current = e.currentTarget;
                      dragClientXRef.current = e.clientX;
                      setHoverMs(ms);
                      setDrag({ roomId: room.id, pointerId: e.pointerId, startClientX: e.clientX, startMs: ms, currentMs: ms });
                    }}
                    onPointerMove={(e) => {
                      const ms = msFromClientX(e.currentTarget, e.clientX);
                      setHoverMs(ms);

                      if (!drag) return;
                      if (drag.pointerId !== e.pointerId) return;
                      if (drag.roomId !== room.id) return;

                      dragClientXRef.current = e.clientX;
                      setDrag((prev) => {
                        if (!prev) return prev;
                        if (prev.pointerId !== e.pointerId) return prev;
                        if (prev.roomId !== room.id) return prev;
                        if (prev.currentMs === ms) return prev;
                        return { ...prev, currentMs: ms };
                      });
                    }}
                    onPointerUp={(e) => {
                      if (!drag) return;
                      if (drag.pointerId !== e.pointerId) return;
                      if (drag.roomId !== room.id) return;

                      const isClick = Math.abs(e.clientX - drag.startClientX) < DRAG_THRESHOLD_PX;
                      const rawStart = isClick ? drag.startMs : Math.min(drag.startMs, drag.currentMs);
                      const rawEnd = isClick ? drag.startMs : Math.max(drag.startMs, drag.currentMs);
                      dragTargetRef.current = null;
                      dragClientXRef.current = null;
                      setDrag(null);

                      if (isClick) {
                        props.onCreate({ room, startAt: new Date(rawStart) });
                        return;
                      }

                      const start = snapToSlot(rawStart);
                      const end = Math.max(start + SNAP_MS, Math.min(toMs, snapUpToSlot(rawEnd)));
                      props.onCreate({ room, startAt: new Date(start), endAt: new Date(end) });
                    }}
                    onPointerCancel={(e) => {
                      if (!drag) return;
                      if (drag.pointerId !== e.pointerId) return;
                      dragTargetRef.current = null;
                      dragClientXRef.current = null;
                      setDrag(null);
                    }}
                    onPointerLeave={() => {
                      if (drag) return;
                      setHoverMs(null);
                    }}
                  >
                    {!selection ? (
                      <div className="absolute inset-x-0 top-1 px-2 text-[11px] text-muted-foreground">
                        <span className="rounded-md bg-muted/50 px-1.5 py-0.5">点击/拖拽空白选择时间段（30min 吸附）</span>
                      </div>
                    ) : null}

                    {typeof nowPercent === "number" ? (
                      <div className="pointer-events-none absolute inset-y-0 w-px bg-rose-500/50" style={{ left: `${nowPercent}%` }} />
                    ) : null}

                    {typeof hoverPercent === "number" ? (
                      <div className="pointer-events-none absolute inset-y-0 w-px bg-sky-500/40" style={{ left: `${hoverPercent}%` }} />
                    ) : null}

                    {selection ? (
                      <>
                        <div
                          data-kind="selection"
                          className="pointer-events-none absolute top-7 h-4 rounded-md border border-sky-600/60 bg-sky-500/15"
                          style={{
                            left: `${((Math.max(fromMs, selection.startMs) - fromMs) / durationMs) * 100}%`,
                            width: `${((Math.min(toMs, selection.endMs) - Math.max(fromMs, selection.startMs)) / durationMs) * 100}%`,
                          }}
                        />
                        <div
                          data-kind="selection-label"
                          className="pointer-events-none absolute top-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-700"
                          style={{
                            left: `${Math.min(98, Math.max(2, ((activeDrag.currentMs - fromMs) / durationMs) * 100))}%`,
                            transform: "translateX(-50%)",
                          }}
                        >
                          {(() => {
                            const start = snapToSlot(selection.startMs);
                            const end = Math.max(start + SNAP_MS, Math.min(toMs, snapUpToSlot(selection.endMs)));
                            const minutes = (end - start) / 60_000;
                            const startDt = new Date(start);
                            const endDt = new Date(end);
                            const sameDay = startDt.toDateString() === endDt.toDateString();
                            const startLabel = `${formatMd(startDt)} ${formatHm(startDt)}`;
                            const endLabel = sameDay ? formatHm(endDt) : `${formatMd(endDt)} ${formatHm(endDt)}`;
                            return `${startLabel} → ${endLabel}（${formatDurationMinutes(minutes)}）`;
                          })()}
                        </div>
                      </>
                    ) : null}

                    {roomItems.map((it) => {
                      const rawStart = it.startAt.getTime();
                      const rawEnd = it.endAt.getTime();
                      const start = Math.max(fromMs, rawStart);
                      const end = Math.min(toMs, rawEnd);
                      if (end <= start) return null;

                      const left = ((start - fromMs) / durationMs) * 100;
                      const width = ((end - start) / durationMs) * 100;
                      const title = `${it.status === "approved" ? "已批准" : "待审核"}：${formatZhDateTime(it.startAt)} - ${formatZhDateTime(it.endAt)}`;

                      return (
                        <div
                          key={it.id}
                          data-kind="bar"
                          title={title}
                          className={cn(
                            "absolute top-7 h-4 rounded-md border",
                            it.status === "approved"
                              ? "border-emerald-700/40 bg-emerald-500/70"
                              : "border-amber-600/60 bg-amber-400/20 border-dashed",
                          )}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
