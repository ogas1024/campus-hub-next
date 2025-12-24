/**
 * 用法：
 * - Console 封禁管理页组件（由 `/console/facilities/bans` 引用）。
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import { ConsoleDataTable } from "@/components/console/crud/ConsoleDataTable";
import { ConsoleDeleteDialog } from "@/components/console/crud/ConsoleDeleteDialog";
import { ConsoleFormDialog } from "@/components/console/crud/ConsoleFormDialog";
import { ConsolePage } from "@/components/console/crud/ConsolePage";
import { InlineError } from "@/components/common/InlineError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  createConsoleFacilityBan,
  fetchConsoleFacilityBans,
  revokeConsoleFacilityBan,
  type FacilityBanItem,
} from "@/lib/api/console-facilities";
import { searchUsers, type UserSearchItem } from "@/lib/api/users";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { formatZhDateTime } from "@/lib/ui/datetime";

function toIsoOrNull(value: string) {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export function ConsoleBansManager() {
  const loader = useAsyncAction({ fallbackErrorMessage: "加载封禁失败" });
  const action = useAsyncAction();

  const [items, setItems] = useState<FacilityBanItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserSearchItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchItem | null>(null);
  const [duration, setDuration] = useState("");
  const [expiresAtRaw, setExpiresAtRaw] = useState("");
  const [reason, setReason] = useState("");

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<FacilityBanItem | null>(null);

  async function reload() {
    const res = await loader.run(() => fetchConsoleFacilityBans());
    if (!res) return;
    setItems(res.items);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    const q = userQuery.trim();
    if (!q) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        const res = await action.run(() => searchUsers({ q, limit: 10 }), { fallbackErrorMessage: "搜索用户失败" });
        if (!res) return;
        setUserResults(res.items);
      })();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [action, createOpen, userQuery]);

  const activeCount = useMemo(() => items.filter((x) => x.active).length, [items]);

  async function submitCreate() {
    if (!selectedUser) {
      action.setError("请选择要封禁的用户");
      return;
    }
    if (duration.trim() && expiresAtRaw.trim()) {
      action.setError("duration 与 expiresAt 仅能二选一");
      return;
    }

    const expiresAt = expiresAtRaw.trim() ? toIsoOrNull(expiresAtRaw) : null;
    if (expiresAtRaw.trim() && !expiresAt) {
      action.setError("expiresAt 时间格式无效");
      return;
    }

    const ok = await action.run(
      () =>
        createConsoleFacilityBan({
          userId: selectedUser.id,
          duration: duration.trim() ? duration.trim() : undefined,
          expiresAt: expiresAt ?? undefined,
          reason: reason.trim() ? reason.trim() : undefined,
        }),
      { fallbackErrorMessage: "封禁失败" },
    );
    if (!ok) return;
    setCreateOpen(false);
    await reload();
  }

  async function submitRevoke(reasonValue?: string) {
    if (!revokeTarget) return;
    const ok = await action.run(() => revokeConsoleFacilityBan(revokeTarget.id, { reason: reasonValue }), { fallbackErrorMessage: "解封失败" });
    if (!ok) return;
    setRevokeOpen(false);
    setRevokeTarget(null);
    await reload();
  }

  return (
    <ConsolePage
      title="封禁"
      description="模块级封禁：仅影响“创建新预约”；可设置时长/到期时间（均可选），到期后自动失效。"
      meta={
        <>
          <Badge variant="secondary">共 {items.length} 条</Badge>
          <Badge variant="secondary">当前生效 {activeCount} 条</Badge>
        </>
      }
      actions={
        <Button
          size="sm"
          onClick={() => {
            action.reset();
            setUserQuery("");
            setUserResults([]);
            setSelectedUser(null);
            setDuration("");
            setExpiresAtRaw("");
            setReason("");
            setCreateOpen(true);
          }}
        >
          新增封禁
        </Button>
      }
    >
      <InlineError message={loader.error} />

      <ConsoleDataTable
        headers={
          <tr>
            <th className="px-3 py-2">用户</th>
            <th className="px-3 py-2">状态</th>
            <th className="px-3 py-2">原因</th>
            <th className="px-3 py-2">生效/到期/解封</th>
            <th className="px-3 py-2 text-right">操作</th>
          </tr>
        }
        rowCount={items.length}
        emptyColSpan={5}
        emptyText={
          loader.pending ? (
            <div className="mx-auto w-full max-w-sm space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-36" />
            </div>
          ) : (
            "暂无封禁"
          )
        }
      >
        {items.map((it) => (
          <tr key={it.id} className="border-t border-border">
            <td className="px-3 py-3">
              <div className="text-sm font-medium">{it.user.name}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{it.user.studentId}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{it.user.id}</div>
            </td>
            <td className="px-3 py-3">
              {it.active ? <Badge>生效中</Badge> : <Badge variant="secondary">已失效</Badge>}
            </td>
            <td className="px-3 py-3 text-sm text-muted-foreground">{it.reason ?? "—"}</td>
            <td className="px-3 py-3 text-xs text-muted-foreground">
              <div>创建：{formatZhDateTime(new Date(it.createdAt))}</div>
              <div>到期：{it.expiresAt ? formatZhDateTime(new Date(it.expiresAt)) : "永久"}</div>
              <div>解封：{it.revokedAt ? formatZhDateTime(new Date(it.revokedAt)) : "—"}</div>
            </td>
            <td className="px-3 py-3 text-right">
              {it.active ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={action.pending}
                  onClick={() => {
                    action.reset();
                    setRevokeTarget(it);
                    setRevokeOpen(true);
                  }}
                >
                  解封
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        ))}
      </ConsoleDataTable>

      <ConsoleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新增封禁"
        description="duration 与 expiresAt 二选一；两者都为空表示永久封禁。"
        pending={action.pending}
        error={action.error}
        confirmText="封禁"
        confirmVariant="destructive"
        confirmDisabled={!selectedUser}
        onConfirm={() => void submitCreate()}
      >
        <div className="grid gap-2">
          <Label>用户（必选）</Label>
          {selectedUser ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
              <span className="font-medium">{selectedUser.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{selectedUser.studentId}</span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelectedUser(null)} disabled={action.pending}>
                清除
              </Button>
            </div>
          ) : (
            <>
              <Input
                value={userQuery}
                onChange={(e) => {
                  const next = e.target.value;
                  setUserQuery(next);
                  if (!next.trim()) {
                    setUserResults([]);
                    action.reset();
                  }
                }}
                placeholder="按姓名/学号/邮箱搜索…"
              />
              {userResults.length > 0 ? (
                <div className="rounded-lg border border-border bg-background">
                  <ScrollArea className="max-h-56">
                    <div className="p-1">
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setSelectedUser(u);
                            setUserQuery("");
                            setUserResults([]);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">{u.name}</div>
                            <div className="truncate font-mono text-xs text-muted-foreground">{u.studentId}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">选择</div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="grid gap-2">
          <Label>duration（可选）</Label>
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="示例：7d / 12h / 1h30m（留空=不按时长）" />
          <div className="text-xs text-muted-foreground">若填写 duration，则服务端会自动计算 expiresAt。</div>
        </div>

        <div className="grid gap-2">
          <Label>expiresAt（可选）</Label>
          <Input value={expiresAtRaw} onChange={(e) => setExpiresAtRaw(e.target.value)} placeholder="ISO 或 yyyy-mm-ddThh:mm（留空=永久）" />
        </div>

        <div className="grid gap-2">
          <Label>原因（可选）</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="将写入审计；对前台用户不可见。" />
        </div>
      </ConsoleFormDialog>

      <ConsoleDeleteDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title={revokeTarget ? `解封：${revokeTarget.user.name}` : "解封"}
        description="解封后：该用户可再次创建新预约（既有预约不受影响）。"
        pending={action.pending}
        error={action.error}
        confirmText="确认解封"
        onConfirm={({ reason }) => void submitRevoke(reason)}
      />
    </ConsolePage>
  );
}
