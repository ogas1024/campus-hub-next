"use client";

import { useEffect, useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { fetchFacilityRoomLeaderboard, fetchFacilityUserLeaderboard, type LeaderboardResponse } from "@/lib/api/facilities";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Days = 7 | 30;

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h <= 0) return `${m} 分钟`;
  if (m <= 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分钟`;
}

export function FacilityLeaderboardClient() {
  const action = useAsyncAction({ fallbackErrorMessage: "加载失败" });
  const [days, setDays] = useState<Days>(30);
  const [roomBoard, setRoomBoard] = useState<LeaderboardResponse | null>(null);
  const [userBoard, setUserBoard] = useState<LeaderboardResponse | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await action.run(async () => {
        const [rooms, users] = await Promise.all([fetchFacilityRoomLeaderboard(days), fetchFacilityUserLeaderboard(days)]);
        return { rooms, users };
      });
      if (!res) return;
      setRoomBoard(res.rooms);
      setUserBoard(res.users);
    })();
  }, [action, days]);

  const roomItems = roomBoard?.items ?? [];
  const userItems = userBoard?.items ?? [];

  const maxRoomSeconds = Math.max(1, ...roomItems.map((i) => i.totalSeconds));
  const maxUserSeconds = Math.max(1, ...userItems.map((i) => i.totalSeconds));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">窗口</Badge>
        <Select value={String(days)} onChange={(e) => setDays((e.target.value === "7" ? 7 : 30) as Days)}>
          <option value="7">近 7 天</option>
          <option value="30">近 30 天</option>
        </Select>
      </div>

      <InlineError message={action.error} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-semibold">房间时长榜</div>
            <div className="mt-1 text-xs text-muted-foreground">Top {Math.min(50, roomItems.length)}</div>

            {roomItems.length === 0 ? (
              <div className="mt-6 text-center text-sm text-muted-foreground">暂无数据</div>
            ) : (
              <div className="mt-4 space-y-2">
                {roomItems.map((it, idx) => (
                  <div key={it.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          #{idx + 1} {it.label}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{formatDuration(it.totalSeconds)}</div>
                      </div>
                      <div className="w-28 shrink-0">
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-emerald-500/70" style={{ width: `${(it.totalSeconds / maxRoomSeconds) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-semibold">用户时长榜（按申请人）</div>
            <div className="mt-1 text-xs text-muted-foreground">Top {Math.min(50, userItems.length)}</div>

            {userItems.length === 0 ? (
              <div className="mt-6 text-center text-sm text-muted-foreground">暂无数据</div>
            ) : (
              <div className="mt-4 space-y-2">
                {userItems.map((it, idx) => (
                  <div key={it.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          #{idx + 1} {it.label}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{formatDuration(it.totalSeconds)}</div>
                      </div>
                      <div className="w-28 shrink-0">
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-sky-500/70" style={{ width: `${(it.totalSeconds / maxUserSeconds) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
