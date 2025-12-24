"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchConsoleUsers } from "@/lib/api/iam";
import type { ConsoleUserListItem } from "@/lib/api/iam";
import {
  createConsoleMajor,
  deleteConsoleMajor,
  fetchConsoleMajorLeads,
  setConsoleMajorLeads,
  updateConsoleMajor,
} from "@/lib/api/console-course-resources";
import type { Major, MajorLeadItem } from "@/lib/api/console-course-resources";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { ConsoleDeleteDialog } from "@/components/console/crud/ConsoleDeleteDialog";
import { ConsoleFormDialog } from "@/components/console/crud/ConsoleFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type MajorItem = Major;

type Props = {
  majors: MajorItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canUpdateLeads: boolean;
  canUserList: boolean;
};

function isUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export function MajorsManager(props: Props) {
  const router = useRouter();
  const action = useAsyncAction();
  const [items, setItems] = useState<MajorItem[]>(() => props.majors);

  const sorted = useMemo(() => {
    const out = items.slice();
    out.sort((a, b) => (a.sort !== b.sort ? a.sort - b.sort : a.name.localeCompare(b.name, "zh-Hans-CN")));
    return out;
  }, [items]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEnabled, setCreateEnabled] = useState(true);
  const [createSort, setCreateSort] = useState(0);
  const [createRemark, setCreateRemark] = useState("");
  const [createReason, setCreateReason] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editSort, setEditSort] = useState(0);
  const [editRemark, setEditRemark] = useState("");
  const [editReason, setEditReason] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [leadsOpen, setLeadsOpen] = useState(false);
  const [leadsMajor, setLeadsMajor] = useState<MajorItem | null>(null);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadItems, setLeadItems] = useState<MajorLeadItem[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [leadsReason, setLeadsReason] = useState("");

  const [userQuery, setUserQuery] = useState("");
  const [userSearching, setUserSearching] = useState(false);
  const [userResults, setUserResults] = useState<ConsoleUserListItem[]>([]);
  const [manualUserId, setManualUserId] = useState("");

  async function submitCreate() {
    const res = await action.run(
      () =>
        createConsoleMajor({
          name: createName.trim(),
          enabled: createEnabled,
          sort: createSort,
          remark: createRemark.trim() ? createRemark.trim() : null,
          reason: createReason.trim() ? createReason.trim() : undefined,
        }),
      { fallbackErrorMessage: "创建失败" },
    );
    if (!res) return;

    setItems((prev) => [
      ...prev,
      { id: res.id, name: createName.trim(), enabled: createEnabled, sort: createSort, remark: createRemark.trim() ? createRemark.trim() : null },
    ]);
    setCreateOpen(false);
    router.refresh();
  }

  async function submitUpdate() {
    if (!editId) return;
    const ok = await action.run(
      () =>
        updateConsoleMajor(editId, {
          name: editName.trim() ? editName.trim() : undefined,
          enabled: editEnabled,
          sort: editSort,
          remark: editRemark.trim() ? editRemark.trim() : null,
          reason: editReason.trim() ? editReason.trim() : undefined,
        }),
      { fallbackErrorMessage: "保存失败" },
    );
    if (!ok) return;

    setItems((prev) =>
      prev.map((m) =>
        m.id === editId
          ? { ...m, name: editName.trim() ? editName.trim() : m.name, enabled: editEnabled, sort: editSort, remark: editRemark.trim() ? editRemark.trim() : null }
          : m,
      ),
    );
    setEditOpen(false);
    router.refresh();
  }

  async function submitDelete(reason?: string) {
    if (!deleteId) return;
    const ok = await action.run(() => deleteConsoleMajor(deleteId, { reason }), { fallbackErrorMessage: "删除失败" });
    if (!ok) return;
    setItems((prev) => prev.filter((m) => m.id !== deleteId));
    setDeleteOpen(false);
    router.refresh();
  }

  async function openLeadsDialog(major: MajorItem) {
    action.reset();
    setLeadsMajor(major);
    setLeadsOpen(true);
    setLeadsLoading(true);
    setLeadItems([]);
    setSelectedLeadIds(new Set());
    setUserQuery("");
    setUserResults([]);
    setManualUserId("");
    setLeadsReason("");

    const res = await action.run(() => fetchConsoleMajorLeads(major.id), { fallbackErrorMessage: "加载负责人失败" });
    if (!res) {
      setLeadsLoading(false);
      return;
    }

    setLeadItems(res);
    setSelectedLeadIds(new Set(res.map((x) => x.userId)));
    setLeadsLoading(false);
  }

  async function submitLeads() {
    if (!leadsMajor) return;
    const userIds = [...selectedLeadIds];
    const ok = await action.run(
      () =>
        setConsoleMajorLeads(leadsMajor.id, {
          userIds,
          reason: leadsReason.trim() ? leadsReason.trim() : undefined,
        }),
      { fallbackErrorMessage: "保存负责人失败" },
    );
    if (!ok) return;
    setLeadsOpen(false);
    router.refresh();
  }

  async function searchUsers() {
    if (!props.canUserList) return;
    const q = userQuery.trim();
    if (!q) return;

    setUserSearching(true);
    setUserResults([]);
    const res = await action.run(
      () => fetchConsoleUsers({ page: 1, pageSize: 10, q, status: "active", sortBy: "createdAt", sortOrder: "desc" }),
      { fallbackErrorMessage: "搜索用户失败" },
    );
    setUserSearching(false);
    if (!res) return;
    setUserResults(res.items);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{items.length} 个专业</div>

        {props.canCreate ? (
          <Button
            size="sm"
            disabled={action.pending}
            onClick={() => {
              action.reset();
              setCreateName("");
              setCreateEnabled(true);
              setCreateSort(0);
              setCreateRemark("");
              setCreateReason("");
              setCreateOpen(true);
            }}
          >
            新增专业
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">sort</th>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">备注</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {sorted.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={5}>
                  暂无专业
                </td>
              </tr>
            ) : null}

            {sorted.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs text-muted-foreground">{m.sort}</td>
                <td className="px-3 py-2 font-medium">
                  <div className="line-clamp-1">{m.name}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{m.id}</div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      m.enabled
                        ? "rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                        : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {m.enabled ? "启用" : "停用"}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-muted-foreground">{m.remark ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {props.canUpdateLeads ? (
                      <Button size="sm" variant="outline" disabled={action.pending} onClick={() => void openLeadsDialog(m)}>
                        负责人
                      </Button>
                    ) : null}
                    {props.canUpdate ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={action.pending}
                        onClick={() => {
                          action.reset();
                          setEditId(m.id);
                          setEditName(m.name);
                          setEditEnabled(m.enabled);
                          setEditSort(m.sort);
                          setEditRemark(m.remark ?? "");
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
                          setDeleteId(m.id);
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

      <ConsoleFormDialog
        open={createOpen}
        onOpenChange={(next) => {
          if (!next && action.pending) return;
          if (!next) action.reset();
          setCreateOpen(next);
        }}
        title="新增专业"
        description="专业为课程与资源的上层归属；删除为软删（不级联删除课程/资源）。"
        pending={action.pending}
        error={action.error}
        confirmText="创建"
        confirmDisabled={!createName.trim()}
        onConfirm={() => void submitCreate()}
      >
        <div className="grid gap-2">
          <Label>名称</Label>
          <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="例如 计算机科学与技术" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>排序（sort）</Label>
            <Input value={String(createSort)} onChange={(e) => setCreateSort(Number(e.target.value))} inputMode="numeric" type="number" min={0} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">启用</div>
              <div className="text-xs text-muted-foreground">Portal 仅展示启用的专业。</div>
            </div>
            <Switch checked={createEnabled} onCheckedChange={setCreateEnabled} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>备注（可选）</Label>
          <Textarea value={createRemark} onChange={(e) => setCreateRemark(e.target.value)} placeholder="可填写专业说明、口径…" />
        </div>
        <div className="grid gap-2">
          <Label>原因（可选，将写入审计）</Label>
          <Textarea value={createReason} onChange={(e) => setCreateReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
        </div>
      </ConsoleFormDialog>

      <ConsoleFormDialog
        open={editOpen}
        onOpenChange={(next) => {
          if (!next && action.pending) return;
          if (!next) action.reset();
          setEditOpen(next);
        }}
        title="编辑专业"
        pending={action.pending}
        error={action.error}
        confirmText="保存"
        confirmDisabled={!editName.trim()}
        onConfirm={() => void submitUpdate()}
      >
        <div className="grid gap-2">
          <Label>名称</Label>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>排序（sort）</Label>
            <Input value={String(editSort)} onChange={(e) => setEditSort(Number(e.target.value))} inputMode="numeric" type="number" min={0} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">启用</div>
              <div className="text-xs text-muted-foreground">Portal 仅展示启用的专业。</div>
            </div>
            <Switch checked={editEnabled} onCheckedChange={setEditEnabled} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>备注（可选）</Label>
          <Textarea value={editRemark} onChange={(e) => setEditRemark(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>原因（可选，将写入审计）</Label>
          <Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
        </div>
      </ConsoleFormDialog>

      <ConsoleDeleteDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!next && action.pending) return;
          if (!next) action.reset();
          setDeleteOpen(next);
        }}
        title="删除专业"
        description="将执行软删（deleted_at），不会级联删除课程/资源。"
        pending={action.pending}
        error={action.error}
        confirmText="确认删除"
        onConfirm={({ reason }) => void submitDelete(reason)}
      />

      <StickyFormDialog
        open={leadsOpen}
        onOpenChange={(next) => {
          if (next) return;
          if (action.pending) return;
          action.reset();
          setLeadsOpen(false);
          setLeadsMajor(null);
        }}
        title="配置专业负责人"
        description={
          leadsMajor ? (
            <>
              专业：<span className="font-medium">{leadsMajor.name}</span>
            </>
          ) : undefined
        }
        error={action.error}
        contentClassName="max-w-2xl"
        footer={
          <>
            <Button variant="outline" disabled={action.pending} onClick={() => setLeadsOpen(false)}>
              取消
            </Button>
            <Button disabled={action.pending || !leadsMajor} onClick={() => void submitLeads()}>
              {action.pending ? "处理中..." : "保存"}
            </Button>
          </>
        }
      >
        <div className="rounded-lg border border-border bg-muted p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">当前负责人</div>
            <Badge variant="secondary">{selectedLeadIds.size} 人</Badge>
          </div>
          {leadsLoading ? (
            <div className="mt-3 space-y-3">
              <Skeleton className="h-4 w-28" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          ) : selectedLeadIds.size === 0 ? (
            <div className="mt-2 text-sm text-muted-foreground">暂无负责人</div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {leadItems.map((u) => (
                <span key={u.userId} className="rounded-full border border-border bg-background px-2 py-1 text-xs">
                  {u.name ?? u.username ?? u.email ?? u.userId}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label>手动添加 userId（UUID）</Label>
          <div className="flex gap-2">
            <Input value={manualUserId} onChange={(e) => setManualUserId(e.target.value)} placeholder="粘贴用户 UUID" />
            <Button
              variant="outline"
              disabled={action.pending}
              onClick={() => {
                const id = manualUserId.trim();
                if (!id) return;
                if (!isUuid(id)) {
                  action.setError("userId 必须为 UUID");
                  return;
                }
                setSelectedLeadIds((prev) => new Set([...prev, id]));
                setManualUserId("");
              }}
            >
              添加
            </Button>
          </div>
        </div>

        {props.canUserList ? (
          <div className="grid gap-2">
            <Label>搜索用户（需 user:list 权限）</Label>
            <div className="flex gap-2">
              <Input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="按姓名/邮箱/学号…" />
              <Button variant="outline" disabled={userSearching || action.pending || !userQuery.trim()} onClick={() => void searchUsers()}>
                {userSearching ? "搜索中..." : "搜索"}
              </Button>
            </div>

            {userResults.length > 0 ? (
              <ScrollArea className="h-56 rounded-lg border border-border bg-background">
                <div className="space-y-1 p-2">
                  {userResults.map((u) => {
                    const checked = selectedLeadIds.has(u.id);
                    return (
                      <label key={u.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{u.name}</div>
                          <div className="truncate font-mono text-xs text-muted-foreground">{u.email ?? u.id}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(selectedLeadIds);
                            if (e.target.checked) next.add(u.id);
                            else next.delete(u.id);
                            setSelectedLeadIds(next);
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-xs text-muted-foreground">输入关键词后点击搜索；仅显示 active 用户（最多 10 条）。</div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">当前账号无 user:list 权限；如需搜索，请先授予权限或手动输入 userId。</div>
        )}

        <div className="grid gap-2">
          <Label>原因（可选，将写入审计）</Label>
          <Textarea value={leadsReason} onChange={(e) => setLeadsReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
        </div>
      </StickyFormDialog>
    </div>
  );
}
