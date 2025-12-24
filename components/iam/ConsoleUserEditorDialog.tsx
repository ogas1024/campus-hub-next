"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DialogLoadingSkeleton } from "@/components/common/DialogLoadingSkeleton";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { UnsavedChangesAlertDialog } from "@/components/common/UnsavedChangesAlertDialog";
import { UserLifecycleActions } from "@/components/iam/UserLifecycleActions";
import { UserStatusBadge } from "@/components/iam/UserStatusBadge";
import { DepartmentTreeSelector } from "@/components/organization/DepartmentTreeSelector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createConsoleUser,
  fetchConsoleUserDetail,
  inviteConsoleUser,
  setUserDepartments,
  setUserPositions,
  setUserRoles,
  type ConsoleUserDetailResponse,
} from "@/lib/api/iam";
import { fetchDepartments, fetchPositions, type Department, type Position } from "@/lib/api/organization";
import { fetchRoles, type Role } from "@/lib/api/rbac";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { cn } from "@/lib/utils";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  userId?: string;
  perms: {
    canCreate: boolean;
    canInvite: boolean;
    canApprove: boolean;
    canDisable: boolean;
    canBan: boolean;
    canDelete: boolean;
    canAssignRole: boolean;
    canAssignOrg: boolean;
  };
  onRequestClose: () => void;
  onCreated: (userId: string) => void;
};

type Snapshot = {
  roleIds: string[];
  departmentIds: string[];
  positionIds: string[];
};

function normalizeSnapshot(snapshot: Snapshot) {
  return {
    roleIds: snapshot.roleIds.slice().sort(),
    departmentIds: snapshot.departmentIds.slice().sort(),
    positionIds: snapshot.positionIds.slice().sort(),
  };
}

function snapshotKey(snapshot: Snapshot) {
  return JSON.stringify(normalizeSnapshot(snapshot));
}

function isStudentId(value: string) {
  return /^[0-9]{16}$/.test(value.trim());
}

function displayUserShort(detail: ConsoleUserDetailResponse | null) {
  if (!detail) return "—";
  const email = detail.email ?? "无邮箱";
  return `${detail.profile.studentId} · ${email}${detail.emailVerified ? "" : "（未验证邮箱）"}`;
}

export function ConsoleUserEditorDialog(props: Props) {
  const router = useRouter();
  const { pending: loaderPending, error: loaderError, run: runLoader, reset: resetLoader } = useAsyncAction({ fallbackErrorMessage: "加载失败" });
  const {
    pending: actionPending,
    error: actionError,
    run: runAction,
    reset: resetAction,
    setError: setActionError,
  } = useAsyncAction();

  const [activeTab, setActiveTab] = useState<"overview" | "roles" | "departments" | "positions">("overview");

  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConsoleUserDetailResponse | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  const [roleQuery, setRoleQuery] = useState("");
  const [positionQuery, setPositionQuery] = useState("");

  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(() => new Set());
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedPositionIds, setSelectedPositionIds] = useState<Set<string>>(() => new Set());

  const [reason, setReason] = useState("");
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  const [unsavedAlertOpen, setUnsavedAlertOpen] = useState(false);

  const availableCreateTabs = useMemo(() => {
    const tabs: Array<{ id: "create" | "invite"; label: string }> = [];
    if (props.perms.canCreate) tabs.push({ id: "create", label: "手动创建" });
    if (props.perms.canInvite) tabs.push({ id: "invite", label: "邀请注册" });
    return tabs;
  }, [props.perms.canCreate, props.perms.canInvite]);

  const [createTab, setCreateTab] = useState<"create" | "invite">(() => availableCreateTabs[0]?.id ?? "create");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [emailConfirm, setEmailConfirm] = useState(false);

  function resetCreate() {
    resetLoader();
    resetAction();
    setActiveTab("overview");
    setLoadedUserId(null);
    setDetail(null);
    setRoles([]);
    setDepartments([]);
    setPositions([]);
    setRoleQuery("");
    setPositionQuery("");
    setSelectedRoleIds(new Set());
    setSelectedDepartmentIds([]);
    setSelectedPositionIds(new Set());
    setReason("");
    setInitialSnapshot("");

    setCreateTab(availableCreateTabs[0]?.id ?? (props.perms.canInvite ? "invite" : "create"));
    setEmail("");
    setName("");
    setStudentId("");
    setPassword("");
    setEmailConfirm(false);
  }

  const currentSnapshot = useMemo<Snapshot>(
    () => ({
      roleIds: [...selectedRoleIds],
      departmentIds: selectedDepartmentIds.slice(),
      positionIds: [...selectedPositionIds],
    }),
    [selectedDepartmentIds, selectedPositionIds, selectedRoleIds],
  );

  const dirty = useMemo(() => {
    if (!props.open) return false;
    if (props.mode === "create") return !!email.trim() || !!name.trim() || !!studentId.trim() || !!password.trim();
    if (!initialSnapshot) return false;
    return snapshotKey(currentSnapshot) !== initialSnapshot;
  }, [props.mode, props.open, initialSnapshot, currentSnapshot, email, name, password, studentId]);

  function requestClose() {
    if (actionPending || loaderPending) return;
    if (dirty) {
      setUnsavedAlertOpen(true);
      return;
    }
    resetCreate();
    props.onRequestClose();
  }

  useEffect(() => {
    if (!props.open) return;
    if (props.mode !== "edit") return;

    const id = props.userId?.trim() ?? "";
    if (!id) return;
    if (loadedUserId === id) return;

    let cancelled = false;
    void (async () => {
      resetLoader();
      resetAction();
      setActiveTab("overview");
      setDetail(null);
      setRoles([]);
      setDepartments([]);
      setPositions([]);
      setRoleQuery("");
      setPositionQuery("");
      setSelectedRoleIds(new Set());
      setSelectedDepartmentIds([]);
      setSelectedPositionIds(new Set());
      setReason("");
      setInitialSnapshot("");

      const res = await runLoader(async () => {
        const detailRes = await fetchConsoleUserDetail(id);

        const rolesRes = props.perms.canAssignRole ? await fetchRoles() : null;
        const departmentsRes = props.perms.canAssignOrg ? await fetchDepartments() : null;
        const positionsRes = props.perms.canAssignOrg ? await fetchPositions() : null;

        return { detailRes, rolesRes, departmentsRes, positionsRes };
      });
      if (cancelled) return;
      if (!res) return;

      setLoadedUserId(id);
      setDetail(res.detailRes);
      const roleItems = res.rolesRes?.items ?? [];
      setRoles(roleItems);
      setDepartments(res.departmentsRes?.items ?? []);
      setPositions(res.positionsRes?.items ?? []);

      const builtinUserRoleId = roleItems.find((r) => r.code === "user")?.id ?? null;
      const roleIds = res.detailRes.roles.map((r) => r.id);
      const effectiveRoleIds =
        builtinUserRoleId && !roleIds.includes(builtinUserRoleId) ? [...roleIds, builtinUserRoleId] : roleIds;
      const departmentIds = res.detailRes.departments.map((d) => d.id);
      const positionIds = res.detailRes.positions.map((p) => p.id);

      setSelectedRoleIds(new Set(effectiveRoleIds));
      setSelectedDepartmentIds(departmentIds);
      setSelectedPositionIds(new Set(positionIds));

      setInitialSnapshot(snapshotKey({ roleIds: effectiveRoleIds, departmentIds, positionIds }));
    })();

    return () => {
      cancelled = true;
    };
  }, [loadedUserId, props.mode, props.open, props.perms.canAssignOrg, props.perms.canAssignRole, props.userId, resetAction, resetLoader, runLoader]);

  const filteredRoles = useMemo(() => {
    const keyword = roleQuery.trim().toLowerCase();
    const items = roles.slice();
    if (!keyword) return items;
    return items.filter((r) => `${r.code} ${r.name} ${r.description ?? ""}`.toLowerCase().includes(keyword));
  }, [roleQuery, roles]);

  const filteredPositions = useMemo(() => {
    const keyword = positionQuery.trim().toLowerCase();
    const items = positions.slice();
    if (!keyword) return items;
    return items.filter((p) => `${p.code ?? ""} ${p.name} ${p.description ?? ""}`.toLowerCase().includes(keyword));
  }, [positionQuery, positions]);

  async function submitCreate() {
    resetAction();
    const emailValue = email.trim();
    const nameValue = name.trim();
    const studentIdValue = studentId.trim();

    if (!emailValue || !nameValue || !isStudentId(studentIdValue)) {
      setActionError("请检查邮箱/姓名/学号格式。");
      return;
    }
    if (createTab === "create" && password.length < 8) {
      setActionError("密码至少 8 位。");
      return;
    }
    if (createTab === "create" && !props.perms.canCreate) {
      setActionError("无权限：campus:user:create");
      return;
    }
    if (createTab === "invite" && !props.perms.canInvite) {
      setActionError("无权限：campus:user:invite");
      return;
    }

    const res = await runAction(async () => {
      if (createTab === "create") {
        const created = await createConsoleUser({
          email: emailValue,
          password,
          emailConfirm,
          name: nameValue,
          studentId: studentIdValue,
        });
        return { userId: created.id };
      }
      const created = await inviteConsoleUser({
        email: emailValue,
        name: nameValue,
        studentId: studentIdValue,
      });
      return { userId: created.userId };
    }, { fallbackErrorMessage: createTab === "create" ? "创建失败" : "邀请失败" });

    if (!res) return;
    props.onCreated(res.userId);
    router.refresh();
  }

  async function submitSaveAll() {
    const id = props.userId?.trim() ?? "";
    if (!id) return;

    if (!props.perms.canAssignRole && !props.perms.canAssignOrg) return;

    resetAction();

    const before = initialSnapshot;
    const after = snapshotKey(currentSnapshot);
    const changed = before && before !== after;
    if (!changed) return;

    const ok = await runAction(async () => {
      const normalizedBefore = (() => {
        if (!before) return null;
        try {
          return JSON.parse(before) as ReturnType<typeof normalizeSnapshot>;
        } catch {
          return null;
        }
      })();
      if (!normalizedBefore) throw new Error("INITIAL_SNAPSHOT_INVALID");

      const normalizedAfter = normalizeSnapshot(currentSnapshot);
      const reasonValue = reason.trim() ? reason.trim() : undefined;

      if (props.perms.canAssignRole && JSON.stringify(normalizedBefore.roleIds) !== JSON.stringify(normalizedAfter.roleIds)) {
        const builtinUserRoleId = roles.find((r) => r.code === "user")?.id ?? null;
        const roleIds = (() => {
          if (!builtinUserRoleId) return normalizedAfter.roleIds;
          if (normalizedAfter.roleIds.includes(builtinUserRoleId)) return normalizedAfter.roleIds;
          const next = normalizedAfter.roleIds.concat(builtinUserRoleId);
          next.sort();
          return next;
        })();
        await setUserRoles(id, { roleIds, reason: reasonValue });
      }

      if (props.perms.canAssignOrg && JSON.stringify(normalizedBefore.departmentIds) !== JSON.stringify(normalizedAfter.departmentIds)) {
        await setUserDepartments(id, { departmentIds: normalizedAfter.departmentIds, reason: reasonValue });
      }

      if (props.perms.canAssignOrg && JSON.stringify(normalizedBefore.positionIds) !== JSON.stringify(normalizedAfter.positionIds)) {
        await setUserPositions(id, { positionIds: normalizedAfter.positionIds, reason: reasonValue });
      }
    }, { fallbackErrorMessage: "保存失败" });

    if (!ok) return;
    setInitialSnapshot(after);
    setReason("");
    router.refresh();
  }

  const title = props.mode === "create" ? "新增用户" : detail?.profile.name || "用户详情";
  const descriptionText =
    props.mode === "create"
      ? "通过 Supabase Auth Admin API 创建/邀请用户，写入审计。"
      : displayUserShort(detail);

  const footer =
    props.mode === "create" ? (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="outline" disabled={actionPending} onClick={() => requestClose()}>
          取消
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            disabled={
              actionPending ||
              !email.trim() ||
              !name.trim() ||
              !isStudentId(studentId) ||
              (createTab === "create" && password.length < 8) ||
              (createTab === "create" ? !props.perms.canCreate : !props.perms.canInvite)
            }
            onClick={() => void submitCreate()}
          >
            {actionPending ? "提交中..." : createTab === "create" ? "创建" : "发送邀请"}
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="outline" disabled={actionPending} onClick={() => requestClose()}>
          关闭
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={
              actionPending ||
              loaderPending ||
              !dirty ||
              (!props.perms.canAssignRole && !props.perms.canAssignOrg)
            }
            onClick={() => void submitSaveAll()}
          >
            {actionPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    );

  const body =
    props.mode === "create" ? (
      <>
        {availableCreateTabs.length > 1 ? (
          <Tabs value={createTab} onValueChange={(v) => setCreateTab(v as typeof createTab)}>
            <TabsList>
              {availableCreateTabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}

        <div className="grid gap-2">
          <Label>邮箱</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
        </div>

        {createTab === "create" ? (
          <div className="grid gap-2">
            <Label>密码（≥8 位）</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>姓名</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>学号（16 位数字）</Label>
            <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} inputMode="numeric" />
            {!isStudentId(studentId) && studentId.trim() ? <div className="text-xs text-destructive">学号格式不正确</div> : null}
          </div>
        </div>

        {createTab === "create" ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">标记邮箱已验证</div>
              <div className="text-xs text-muted-foreground">仅当你确定邮箱可用且无需走验证流程时使用。</div>
            </div>
            <Switch checked={emailConfirm} onCheckedChange={setEmailConfirm} />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
            将向邮箱发送邀请链接（Supabase 默认邮件模板）。用户完成邮箱验证后会按“注册审核开关”进入 active 或待审核。
          </div>
        )}
      </>
    ) : loaderPending ? (
      <DialogLoadingSkeleton />
    ) : !detail ? (
      <div className="text-sm text-muted-foreground">用户不存在或已删除</div>
    ) : (
      <>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="roles">角色</TabsTrigger>
            <TabsTrigger value="departments">部门</TabsTrigger>
            <TabsTrigger value="positions">岗位</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-muted p-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">{detail.profile.name}</div>
                  <div className="text-xs text-muted-foreground">{displayUserShort(detail)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <UserStatusBadge status={detail.profile.status} />
                  <UserLifecycleActions
                    userId={detail.id}
                    status={detail.profile.status}
                    canApprove={props.perms.canApprove}
                    canDisable={props.perms.canDisable}
                    canBan={props.perms.canBan}
                    canDelete={props.perms.canDelete}
                  />
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-sm font-medium">基本信息</div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">用户 ID</dt>
                      <dd className="break-all font-mono text-xs text-foreground">{detail.id}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">用户名</dt>
                      <dd className="text-foreground">{detail.profile.username ?? "—"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">头像</dt>
                      <dd className="text-foreground">{detail.profile.avatarUrl ? "已设置" : "—"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">创建时间</dt>
                      <dd className="text-foreground">{new Date(detail.profile.createdAt).toLocaleString()}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">更新时间</dt>
                      <dd className="text-foreground">{new Date(detail.profile.updatedAt).toLocaleString()}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">最近登录</dt>
                      <dd className="text-foreground">{detail.profile.lastLoginAt ? new Date(detail.profile.lastLoginAt).toLocaleString() : "—"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="text-sm font-medium">Auth 状态</div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">Auth 创建</dt>
                      <dd className="text-foreground">{detail.auth.createdAt ? new Date(detail.auth.createdAt).toLocaleString() : "—"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">最后登录</dt>
                      <dd className="text-foreground">{detail.auth.lastSignInAt ? new Date(detail.auth.lastSignInAt).toLocaleString() : "—"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">封禁至</dt>
                      <dd className="text-foreground">{detail.auth.bannedUntil ? new Date(detail.auth.bannedUntil).toLocaleString() : "—"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">删除时间</dt>
                      <dd className="text-foreground">{detail.auth.deletedAt ? new Date(detail.auth.deletedAt).toLocaleString() : "—"}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="mt-4">
            {props.perms.canAssignRole ? (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>搜索</Label>
                  <Input value={roleQuery} onChange={(e) => setRoleQuery(e.target.value)} placeholder="按 code/name 搜索…" />
                </div>
                <div className="grid gap-2">
                  <Label>
                    角色（已选 {selectedRoleIds.size} / {roles.length}）
                  </Label>
                  <div className="max-h-80 overflow-auto rounded-lg border border-border">
                    <div className="space-y-1 p-2">
                      {filteredRoles.map((r) => {
                        const checked = selectedRoleIds.has(r.id);
                        const isBuiltinUser = r.code === "user";
                        return (
                          <label
                            key={r.id}
                            className={cn(
                              "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground",
                              isBuiltinUser ? "opacity-80" : null,
                            )}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {r.code} · {r.name}
                              </div>
                              {r.description ? <div className="truncate text-xs text-muted-foreground">{r.description}</div> : null}
                            </div>
                            <Checkbox
                              checked={checked}
                              disabled={isBuiltinUser}
                              onCheckedChange={(v) => {
                                setSelectedRoleIds((prev) => {
                                  const next = new Set(prev);
                                  if (isBuiltinUser) return next;
                                  if (v) next.add(r.id);
                                  else next.delete(r.id);
                                  return next;
                                });
                              }}
                            />
                          </label>
                        );
                      })}
                      {filteredRoles.length === 0 ? <div className="p-2 text-sm text-muted-foreground">无匹配角色</div> : null}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">覆盖式保存；内置角色 user 将被强制保留。</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">无权限编辑角色（campus:user:assign_role）。</div>
                <div className="flex flex-wrap gap-1">
                  {detail.roles.length === 0 ? <span className="text-sm text-muted-foreground">—</span> : null}
                  {detail.roles.map((r) => (
                    <span key={r.id} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {r.code} · {r.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="departments" className="mt-4">
            {props.perms.canAssignOrg ? (
              <div className="grid gap-2">
                <Label>部门（精确选择，不自动折叠为父部门）</Label>
                <DepartmentTreeSelector
                  departments={departments}
                  value={selectedDepartmentIds}
                  onChange={setSelectedDepartmentIds}
                  selectionMode="exact"
                  maxHeight={360}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">无权限编辑部门（campus:user:assign_org）。</div>
                <div className="flex flex-wrap gap-1">
                  {detail.departments.length === 0 ? <span className="text-sm text-muted-foreground">—</span> : null}
                  {detail.departments.map((d) => (
                    <span key={d.id} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="positions" className="mt-4">
            {props.perms.canAssignOrg ? (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>搜索</Label>
                  <Input value={positionQuery} onChange={(e) => setPositionQuery(e.target.value)} placeholder="按 code/name 搜索…" />
                </div>
                <div className="grid gap-2">
                  <Label>
                    岗位（已选 {selectedPositionIds.size} / {positions.length}）
                  </Label>
                  <div className="max-h-80 overflow-auto rounded-lg border border-border">
                    <div className="space-y-1 p-2">
                      {filteredPositions.map((p) => {
                        const checked = selectedPositionIds.has(p.id);
                        return (
                          <label
                            key={p.id}
                            className={cn(
                              "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground",
                              p.enabled ? null : "opacity-80",
                            )}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {p.code ? `${p.code} · ` : ""}
                                {p.name}
                                {p.enabled ? "" : "（停用）"}
                              </div>
                              {p.description ? <div className="truncate text-xs text-muted-foreground">{p.description}</div> : null}
                            </div>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setSelectedPositionIds((prev) => {
                                  const next = new Set(prev);
                                  if (v) next.add(p.id);
                                  else next.delete(p.id);
                                  return next;
                                });
                              }}
                            />
                          </label>
                        );
                      })}
                      {filteredPositions.length === 0 ? <div className="p-2 text-sm text-muted-foreground">无匹配岗位</div> : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">无权限编辑岗位（campus:user:assign_org）。</div>
                <div className="flex flex-wrap gap-1">
                  {detail.positions.length === 0 ? <span className="text-sm text-muted-foreground">—</span> : null}
                  {detail.positions.map((p) => (
                    <span key={p.id} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="grid gap-2">
          <Label>原因（可选，将写入审计）</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、处理原因、备注…" />
        </div>
      </>
    );

  return (
    <>
      <StickyFormDialog
        open={props.open}
        onOpenChange={(open) => {
          if (open) return;
          requestClose();
        }}
        title={title}
        description={descriptionText}
        error={actionError ?? loaderError}
        footer={footer}
        contentClassName="max-w-5xl"
      >
        {body}
      </StickyFormDialog>

      <UnsavedChangesAlertDialog
        open={unsavedAlertOpen}
        onOpenChange={setUnsavedAlertOpen}
        onDiscard={() => {
          setUnsavedAlertOpen(false);
          resetCreate();
          props.onRequestClose();
        }}
      />
    </>
  );
}
