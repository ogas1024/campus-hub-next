"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmAlertDialog } from "@/components/common/ConfirmAlertDialog";
import { DialogLoadingSkeleton } from "@/components/common/DialogLoadingSkeleton";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { UnsavedChangesAlertDialog } from "@/components/common/UnsavedChangesAlertDialog";
import { DepartmentTreeSelector } from "@/components/organization/DepartmentTreeSelector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { fetchRoleDataScopes, setRoleDataScopes, type RoleDataScopeItem, type ScopeType } from "@/lib/api/data-permission";
import { fetchDepartments, type Department } from "@/lib/api/organization";
import {
  createRole,
  deleteRole,
  fetchPermissions,
  fetchRolePermissionCodes,
  fetchRoles,
  setRolePermissions,
  updateRole,
} from "@/lib/api/rbac";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  roleId?: string;
  onRequestClose: () => void;
  onCreated: (roleId: string) => void;
};

type Snapshot = {
  name: string;
  description: string;
  permissionCodes: string[];
  dataScopes: RoleDataScopeItem[];
};

const BUILTIN_ROLE_CODES = new Set(["user", "admin", "super_admin"]);

function validateModuleName(module: string) {
  return /^[a-z][a-z0-9_]*$/.test(module.trim());
}

const scopeOptions: Array<{ value: ScopeType; label: string; hint: string }> = [
  { value: "ALL", label: "ALL", hint: "全量数据" },
  { value: "CUSTOM", label: "CUSTOM", hint: "自定义部门（含子部门）" },
  { value: "DEPT_AND_CHILD", label: "DEPT_AND_CHILD", hint: "用户部门及子部门" },
  { value: "DEPT", label: "DEPT", hint: "仅用户部门" },
  { value: "SELF", label: "SELF", hint: "仅本人" },
  { value: "NONE", label: "NONE", hint: "无权限" },
];

function normalizeSnapshot(snapshot: Snapshot) {
  const permissionCodes = snapshot.permissionCodes
    .slice()
    .map((c) => c.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const dataScopes = snapshot.dataScopes
    .map((i) => ({
      module: i.module.trim(),
      scopeType: i.scopeType,
      departmentIds: i.scopeType === "CUSTOM" ? i.departmentIds.slice().sort() : [],
    }))
    .sort((a, b) => a.module.localeCompare(b.module));

  return {
    name: snapshot.name.trim(),
    description: snapshot.description,
    permissionCodes,
    dataScopes,
  };
}

function snapshotKey(snapshot: Snapshot) {
  return JSON.stringify(normalizeSnapshot(snapshot));
}

export function ConsoleRoleEditorDialog(props: Props) {
  const router = useRouter();
  const { pending: loaderPending, error: loaderError, run: runLoader, reset: resetLoader } = useAsyncAction({ fallbackErrorMessage: "加载失败" });
  const {
    pending: actionPending,
    error: actionError,
    run: runAction,
    reset: resetAction,
    setError: setActionError,
  } = useAsyncAction();

  const [activeTab, setActiveTab] = useState<"basics" | "permissions" | "scopes">("basics");

  const [loadedRoleId, setLoadedRoleId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [permissions, setPermissions] = useState<Array<{ id: string; code: string; description: string | null }>>([]);
  const [permQuery, setPermQuery] = useState("");
  const [selectedPermCodes, setSelectedPermCodes] = useState<Set<string>>(() => new Set());

  const [departments, setDepartments] = useState<Department[]>([]);
  const [scopeItems, setScopeItems] = useState<RoleDataScopeItem[]>([]);

  const [reason, setReason] = useState("");
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unsavedAlertOpen, setUnsavedAlertOpen] = useState(false);

  const isBuiltin = useMemo(() => BUILTIN_ROLE_CODES.has(roleCode), [roleCode]);

  function resetCreate() {
    resetLoader();
    resetAction();
    setActiveTab("basics");
    setLoadedRoleId(null);
    setRoleCode("");
    setName("");
    setDescription("");
    setPermissions([]);
    setPermQuery("");
    setSelectedPermCodes(new Set());
    setDepartments([]);
    setScopeItems([]);
    setReason("");
    setInitialSnapshot("");
  }

  const normalizedScopes = useMemo(() => {
    return scopeItems.map((i) => ({
      module: i.module.trim(),
      scopeType: i.scopeType,
      departmentIds: i.scopeType === "CUSTOM" ? i.departmentIds : [],
    }));
  }, [scopeItems]);

  const moduleErrors = useMemo(() => {
    const errors = new Map<number, string>();
    const moduleToIndex = new Map<string, number[]>();
    normalizedScopes.forEach((i, idx) => {
      if (!i.module) errors.set(idx, "module 不能为空");
      else if (!validateModuleName(i.module)) errors.set(idx, "仅允许小写字母/数字/下划线，且必须以字母开头");
      moduleToIndex.set(i.module, [...(moduleToIndex.get(i.module) ?? []), idx]);
      if (i.scopeType === "CUSTOM" && i.departmentIds.length === 0) errors.set(idx, "CUSTOM 需要选择部门");
    });
    for (const [m, indexes] of moduleToIndex.entries()) {
      if (m && indexes.length > 1) {
        for (const idx of indexes) errors.set(idx, "module 不允许重复");
      }
    }
    return errors;
  }, [normalizedScopes]);

  const currentSnapshot = useMemo<Snapshot>(
    () => ({
      name,
      description,
      permissionCodes: [...selectedPermCodes],
      dataScopes: scopeItems,
    }),
    [description, name, scopeItems, selectedPermCodes],
  );

  const dirty = useMemo(() => {
    if (!props.open) return false;
    if (props.mode === "create") return !!roleCode.trim() || !!name.trim() || !!description.trim() || !!reason.trim();
    if (!initialSnapshot) return false;
    return snapshotKey(currentSnapshot) !== initialSnapshot;
  }, [currentSnapshot, initialSnapshot, props.mode, props.open, description, name, reason, roleCode]);

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

    const id = props.roleId?.trim() ?? "";
    if (!id) return;
    if (loadedRoleId === id) return;

    let cancelled = false;
    void (async () => {
      resetAction();
      resetLoader();
      setActiveTab("basics");
      setRoleCode("");
      setName("");
      setDescription("");
      setPermQuery("");
      setSelectedPermCodes(new Set());
      setScopeItems([]);
      setReason("");
      setInitialSnapshot("");

      const res = await runLoader(async () => {
        const [rolesRes, permissionsRes, rolePermRes, roleScopesRes, departmentsRes] = await Promise.all([
          fetchRoles(),
          fetchPermissions(),
          fetchRolePermissionCodes(id),
          fetchRoleDataScopes(id),
          fetchDepartments(),
        ]);
        const role = rolesRes.items.find((r) => r.id === id) ?? null;
        return { role, permissionsRes, rolePermRes, roleScopesRes, departmentsRes };
      });
      if (cancelled) return;
      if (!res) return;
      if (!res.role) {
        setActionError("角色不存在或已删除");
        return;
      }

      setLoadedRoleId(id);
      setRoleCode(res.role.code);
      setName(res.role.name);
      setDescription(res.role.description ?? "");
      setPermissions(res.permissionsRes.items);
      setSelectedPermCodes(new Set(res.rolePermRes.permissionCodes));
      setScopeItems(res.roleScopesRes.items);
      setDepartments(res.departmentsRes.items);

      const snap = snapshotKey({
        name: res.role.name,
        description: res.role.description ?? "",
        permissionCodes: res.rolePermRes.permissionCodes,
        dataScopes: res.roleScopesRes.items,
      });
      setInitialSnapshot(snap);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadedRoleId, props.mode, props.open, props.roleId, resetAction, resetLoader, runLoader, setActionError]);

  const filteredPermissions = useMemo(() => {
    const keyword = permQuery.trim().toLowerCase();
    const items = permissions.slice();
    if (!keyword) return items;
    return items.filter((p) => `${p.code} ${p.description ?? ""}`.toLowerCase().includes(keyword));
  }, [permissions, permQuery]);

  async function submitCreate() {
    resetAction();
    const code = roleCode.trim();
    const nm = name.trim();
    if (!code || !nm) {
      setActionError("code 与 名称 必填");
      return;
    }
    const codeValid = /^[a-z][a-z0-9_]*$/.test(code);
    if (!codeValid) {
      setActionError("code 格式不正确：仅允许小写字母/数字/下划线，且必须以字母开头");
      return;
    }

    const res = await runAction(() =>
      createRole({
        code,
        name: nm,
        description: description.trim() ? description.trim() : undefined,
        reason: reason.trim() ? reason.trim() : undefined,
      }),
    );
    if (!res) return;
    toast.success("已创建角色", { description: `${code} · ${nm}` });
    props.onCreated(res.id);
    router.refresh();
  }

  async function submitSaveAll() {
    const id = props.roleId?.trim() ?? "";
    if (!id) return;

    resetAction();
    if (!name.trim()) {
      setActionError("名称不能为空");
      setActiveTab("basics");
      return;
    }
    if (moduleErrors.size > 0) {
      setActionError("存在未修正的数据范围配置项，请检查 module 与 CUSTOM 部门选择。");
      setActiveTab("scopes");
      return;
    }

    const payloadScopes = normalizedScopes.map((i) => ({
      module: i.module,
      scopeType: i.scopeType,
      departmentIds: i.scopeType === "CUSTOM" ? i.departmentIds : undefined,
    }));

    const reasonValue = reason.trim() ? reason.trim() : undefined;

    const before = initialSnapshot;
    const after = snapshotKey(currentSnapshot);
    const changed = before && before !== after;
    if (!changed) return;

    const res = await runAction(async () => {
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

      const basicsChanged = normalizedBefore.name !== normalizedAfter.name || normalizedBefore.description !== normalizedAfter.description;
      const permissionsChanged = JSON.stringify(normalizedBefore.permissionCodes) !== JSON.stringify(normalizedAfter.permissionCodes);
      const scopesChanged = JSON.stringify(normalizedBefore.dataScopes) !== JSON.stringify(normalizedAfter.dataScopes);

      if (basicsChanged) {
        await updateRole(id, {
          name: normalizedAfter.name ? normalizedAfter.name : undefined,
          description: normalizedAfter.description.trim() ? normalizedAfter.description.trim() : null,
          reason: reasonValue,
        });
      }

      if (permissionsChanged) {
        await setRolePermissions(id, { permissionCodes: normalizedAfter.permissionCodes, reason: reasonValue });
      }

      if (scopesChanged) {
        await setRoleDataScopes(id, { items: payloadScopes, reason: reasonValue });
      }
      return { basicsChanged, permissionsChanged, scopesChanged };
    }, { fallbackErrorMessage: "保存失败" });

    if (!res) return;

    setInitialSnapshot(after);
    setReason("");
    toast.success("已保存角色配置", {
      description: (() => {
        const parts: string[] = [];
        if (res.basicsChanged) parts.push("基础信息");
        if (res.permissionsChanged) parts.push("权限");
        if (res.scopesChanged) parts.push("数据范围");
        return parts.length > 0 ? `已更新：${parts.join("、")}` : undefined;
      })(),
    });
    router.refresh();
  }

  async function submitDelete() {
    const id = props.roleId?.trim() ?? "";
    if (!id) return;
    resetAction();
    const ok = await runAction(() => deleteRole(id, { reason: reason.trim() ? reason.trim() : undefined }), { fallbackErrorMessage: "删除失败" });
    if (!ok) return;
    toast.success("已删除角色", { description: roleCode.trim() ? roleCode : name.trim() ? name : id });
    setDeleteOpen(false);
    props.onRequestClose();
    router.refresh();
  }

  const footer =
    props.mode === "create" ? (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="outline" disabled={actionPending} onClick={() => requestClose()}>
          取消
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button disabled={actionPending} onClick={() => void submitCreate()}>
            {actionPending ? "提交中..." : "创建"}
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="outline" disabled={actionPending} onClick={() => requestClose()}>
          关闭
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!isBuiltin ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={actionPending}
              onClick={() => {
                resetAction();
                setDeleteOpen(true);
              }}
            >
              删除
            </Button>
          ) : null}

          <Button
            size="sm"
            disabled={actionPending || loaderPending || !dirty}
            onClick={() => {
              void submitSaveAll();
            }}
          >
            {actionPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    );

  const title = props.mode === "create" ? "新增角色" : name || "编辑角色";
  const descriptionText = props.mode === "create" ? "角色用于聚合权限与数据范围；权限码支持 `*` 通配符。" : roleCode || props.roleId || "—";

  const body =
    props.mode === "create" ? (
      <>
        <div className="grid gap-2">
          <Label>code（小写字母/数字/下划线）</Label>
          <Input value={roleCode} onChange={(e) => setRoleCode(e.target.value)} placeholder="例如 librarian" />
          {roleCode.trim() && !/^[a-z][a-z0-9_]*$/.test(roleCode.trim()) ? <div className="text-xs text-destructive">code 格式不正确</div> : null}
        </div>

        <div className="grid gap-2">
          <Label>名称</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 图书管理员" />
        </div>

        <div className="grid gap-2">
          <Label>描述（可选）</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简要说明该角色用于什么…" />
        </div>

        <div className="grid gap-2">
          <Label>原因（可选，将写入审计）</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
        </div>
      </>
    ) : loaderPending ? (
      <DialogLoadingSkeleton />
    ) : (
      <>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="basics">基础</TabsTrigger>
            <TabsTrigger value="permissions">权限</TabsTrigger>
            <TabsTrigger value="scopes">数据范围</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="mt-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>code</Label>
                <div className="rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">{roleCode}</div>
                {isBuiltin ? <div className="text-xs text-muted-foreground">内置角色不可删除。</div> : null}
              </div>

              <div className="grid gap-2">
                <Label>名称</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>描述（可选）</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="mt-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>搜索</Label>
                <Input value={permQuery} onChange={(e) => setPermQuery(e.target.value)} placeholder="按权限码/描述搜索…" />
              </div>

              <div className="grid gap-2">
                <Label>
                  权限（已选 {selectedPermCodes.size} / {permissions.length}）
                </Label>
                <div className="max-h-80 overflow-auto rounded-lg border border-border">
                  <div className="space-y-1 p-2">
                    {filteredPermissions.map((p) => {
                      const checked = selectedPermCodes.has(p.code);
                      return (
                        <label key={p.id} className="flex cursor-pointer items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-xs text-foreground">{p.code}</div>
                            {p.description ? <div className="truncate text-xs text-muted-foreground">{p.description}</div> : null}
                          </div>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelectedPermCodes((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(p.code);
                                else next.delete(p.code);
                                return next;
                              });
                            }}
                          />
                        </label>
                      );
                    })}
                    {filteredPermissions.length === 0 ? <div className="p-2 text-sm text-muted-foreground">无匹配权限</div> : null}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scopes" className="mt-4">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                建议按模块配置：例如 <code className="font-mono text-xs">notice</code>、<code className="font-mono text-xs">user</code>。仅在业务 Service 中显式使用该 module 时才会生效。
              </div>

              <div className="space-y-3">
                {scopeItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">暂无配置</div>
                ) : null}

                {scopeItems.map((it, idx) => {
                  const err = moduleErrors.get(idx);
                  const isCustom = it.scopeType === "CUSTOM";
                  return (
                    <div key={`${idx}-${it.module}`} className="rounded-xl border border-border bg-card p-4">
                      <div className="grid gap-3 lg:grid-cols-12">
                        <div className="lg:col-span-4">
                          <Label>module</Label>
                          <Input
                            value={it.module}
                            onChange={(e) => {
                              const v = e.target.value;
                              setScopeItems((prev) => prev.map((x, i) => (i === idx ? { ...x, module: v } : x)));
                            }}
                            placeholder="例如 notice"
                          />
                        </div>

                        <div className="lg:col-span-4">
                          <Label>scopeType</Label>
                          <Select
                            value={it.scopeType}
                            onChange={(e) => {
                              const v = e.target.value as ScopeType;
                              setScopeItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, scopeType: v, departmentIds: v === "CUSTOM" ? x.departmentIds : [] } : x)),
                              );
                            }}
                            className="mt-2"
                          >
                            {scopeOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label} · {o.hint}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="flex items-end justify-end lg:col-span-4">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setScopeItems((prev) => prev.filter((_, i) => i !== idx));
                            }}
                          >
                            移除
                          </Button>
                        </div>
                      </div>

                      {err ? <div className="mt-2 text-xs text-destructive">{err}</div> : null}

                      {isCustom ? (
                        <div className="mt-3 grid gap-2">
                          <Label>部门（包含子部门）</Label>
                          <DepartmentTreeSelector
                            departments={departments}
                            value={it.departmentIds}
                            onChange={(next) => {
                              setScopeItems((prev) => prev.map((x, i) => (i === idx ? { ...x, departmentIds: next } : x)));
                            }}
                            maxHeight={280}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                <Button
                  variant="outline"
                  onClick={() => {
                    setScopeItems((prev) => [...prev, { module: "", scopeType: "SELF", departmentIds: [] }]);
                  }}
                >
                  新增模块
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid gap-2">
          <Label>原因（可选，将写入审计）</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
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

      <ConfirmAlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="确认删除角色？"
        description={
          <>
            将删除该角色及其权限/数据范围配置（不可恢复）。
            <br />
            内置角色不可删除；删除后将影响现有用户的角色绑定。
          </>
        }
        confirmText={actionPending ? "删除中..." : "删除"}
        confirmDisabled={actionPending}
        onConfirm={() => {
          void submitDelete();
        }}
      />
    </>
  );
}
