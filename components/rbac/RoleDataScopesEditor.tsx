"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { setRoleDataScopes } from "@/lib/api/data-permission";
import type { RoleDataScopeItem, ScopeType } from "@/lib/api/data-permission";
import type { Department } from "@/lib/api/organization";
import { InlineError } from "@/components/common/InlineError";
import { DepartmentTreeSelector } from "@/components/organization/DepartmentTreeSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  roleId: string;
  departments: Department[];
  value: RoleDataScopeItem[];
};

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

export function RoleDataScopesEditor(props: Props) {
  const router = useRouter();
  const action = useAsyncAction({ fallbackErrorMessage: "保存失败" });

  const [items, setItems] = useState<RoleDataScopeItem[]>(() => props.value);
  const [reason, setReason] = useState("");

  const normalized = useMemo(() => {
    return items.map((i) => ({
      module: i.module.trim(),
      scopeType: i.scopeType,
      departmentIds: i.scopeType === "CUSTOM" ? i.departmentIds : [],
    }));
  }, [items]);

  const moduleErrors = useMemo(() => {
    const errors = new Map<number, string>();
    const moduleToIndex = new Map<string, number[]>();
    normalized.forEach((i, idx) => {
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
  }, [normalized]);

  async function submit() {
    action.reset();
    if (moduleErrors.size > 0) {
      action.setError("存在未修正的配置项，请检查 module 与 CUSTOM 部门选择。");
      return;
    }
    const payload = normalized.map((i) => ({
      module: i.module,
      scopeType: i.scopeType,
      departmentIds: i.scopeType === "CUSTOM" ? i.departmentIds : undefined,
    }));
    await action.run(async () => {
      await setRoleDataScopes(props.roleId, { items: payload, reason: reason.trim() ? reason.trim() : undefined });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        建议按模块配置：例如 `notice`、`user`。仅在业务 Service 中显式使用该 module 时才会生效。
      </div>

      <div className="space-y-3">
        {items.length === 0 ? <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">暂无配置</div> : null}

        {items.map((it, idx) => {
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
                      setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, module: v } : x)));
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
                      setItems((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, scopeType: v, departmentIds: v === "CUSTOM" ? x.departmentIds : [] } : x,
                        ),
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
                      setItems((prev) => prev.filter((_, i) => i !== idx));
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
                    departments={props.departments}
                    value={it.departmentIds}
                    onChange={(next) => {
                      setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, departmentIds: next } : x)));
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
            setItems((prev) => [...prev, { module: "", scopeType: "SELF", departmentIds: [] }]);
          }}
        >
          新增模块
        </Button>
      </div>

      <div className="grid gap-2">
        <Label>原因（可选，将写入审计）</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="可填写工单号、变更原因、备注…" />
      </div>

      <InlineError message={action.error} />

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setItems(props.value);
            setReason("");
          }}
          disabled={action.pending}
        >
          重置
        </Button>
        <Button disabled={action.pending} onClick={() => void submit()}>
          {action.pending ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
