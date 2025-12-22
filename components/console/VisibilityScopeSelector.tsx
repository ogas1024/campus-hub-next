"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";

import { DepartmentTreeSelector } from "@/components/organization/DepartmentTreeSelector";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScopeOptionsResponse, ScopeType } from "@/lib/api/visibility-scope";
import type { SelectedScopes } from "@/lib/ui/visibilityScope";

type Props = {
  options: ScopeOptionsResponse | null;
  selected: SelectedScopes;
  setSelected: Dispatch<SetStateAction<SelectedScopes>>;
  disabled?: boolean;
};

export function VisibilityScopeSelector(props: Props) {
  const departmentItems = useMemo(() => {
    if (!props.options) return [];
    return props.options.departments.map((d) => ({
      id: d.id,
      name: d.name,
      parentId: d.parentId ?? null,
      sort: 0,
    }));
  }, [props.options]);

  function toggle(scopeType: ScopeType, id: string, checked: boolean) {
    props.setSelected((prev) => {
      const nextSet = new Set(prev[scopeType]);
      if (checked) nextSet.add(id);
      else nextSet.delete(id);
      return { ...prev, [scopeType]: nextSet };
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
      <div className="text-sm font-medium">可见范围</div>
      {!props.options ? (
        <div className="text-sm text-muted-foreground">加载中...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">角色</div>
            <ScrollArea className="h-56 rounded-md border border-border bg-background">
              <div className="space-y-1 p-2">
                {props.options.roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={props.selected.role.has(r.id)}
                      disabled={props.disabled}
                      onCheckedChange={(v) => toggle("role", r.id, v === true)}
                    />
                    <span className="truncate">{r.name}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">部门</div>
            {departmentItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无部门</div>
            ) : (
              <DepartmentTreeSelector
                departments={departmentItems}
                value={[...props.selected.department]}
                disabled={props.disabled}
                onChange={(nextIds) => props.setSelected((prev) => ({ ...prev, department: new Set(nextIds) }))}
                maxHeight={224}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">岗位</div>
            {props.options.positions.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无岗位</div>
            ) : (
              <ScrollArea className="h-56 rounded-md border border-border bg-background">
                <div className="space-y-1 p-2">
                  {props.options.positions.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={props.selected.position.has(p.id)}
                        disabled={props.disabled}
                        onCheckedChange={(v) => toggle("position", p.id, v === true)}
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

