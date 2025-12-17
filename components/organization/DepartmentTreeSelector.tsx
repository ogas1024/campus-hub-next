"use client";

import { useMemo } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { DepartmentItem, DepartmentNode } from "@/lib/modules/organization/departmentTree";
import { buildDepartmentTree, collectAncestorIds, collectDescendantIds } from "@/lib/modules/organization/departmentTree";

type Props = {
  departments: DepartmentItem[];
  value: string[];
  onChange: (next: string[]) => void;
  selectionMode?: "scope" | "exact";
  className?: string;
  maxHeight?: number;
  disabled?: boolean;
};

function isNodeFullyCheckedScope(node: DepartmentNode, checked: Set<string>): boolean {
  if (checked.has(node.id)) return true;
  if (node.children.length === 0) return false;
  return node.children.every((c) => isNodeFullyCheckedScope(c, checked));
}

function computeIndeterminateScope(node: DepartmentNode, checked: Set<string>): boolean {
  if (checked.has(node.id)) return false;
  if (node.children.length === 0) return false;
  const states = node.children.map((c) => ({
    checked: isNodeFullyCheckedScope(c, checked),
    indeterminate: computeIndeterminateScope(c, checked),
  }));
  const any = states.some((s) => s.checked || s.indeterminate);
  const all = states.every((s) => s.checked);
  return any && !all;
}

function expandValueToChecked(params: { value: string[]; byId: Map<string, DepartmentNode> }) {
  const checked = new Set<string>();
  for (const id of params.value) {
    const node = params.byId.get(id);
    if (!node) continue;
    for (const descId of collectDescendantIds(node)) checked.add(descId);
  }
  return checked;
}

function computeIndeterminateExact(node: DepartmentNode, checked: Set<string>): boolean {
  if (checked.has(node.id)) return false;
  if (node.children.length === 0) return false;
  return node.children.some((c) => checked.has(c.id) || computeIndeterminateExact(c, checked));
}

function toCoverSet(params: { checked: Set<string>; byId: Map<string, DepartmentNode> }) {
  const out: string[] = [];
  for (const id of params.checked) {
    const parentId = params.byId.get(id)?.parentId ?? null;
    if (!parentId || !params.checked.has(parentId)) out.push(id);
  }
  return out;
}

export function DepartmentTreeSelector(props: Props) {
  const { roots, byId } = useMemo(() => buildDepartmentTree(props.departments), [props.departments]);

  const selectionMode = props.selectionMode ?? "scope";

  const checked = useMemo(() => {
    if (selectionMode === "exact") return new Set(props.value);
    return expandValueToChecked({ value: props.value, byId });
  }, [props.value, byId, selectionMode]);

  function toggle(node: DepartmentNode) {
    if (props.disabled) return;

    if (selectionMode === "exact") {
      const next = new Set(checked);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      props.onChange([...next]);
      return;
    }

    const next = new Set(checked);

    const isChecked = isNodeFullyCheckedScope(node, next);
    const ids = collectDescendantIds(node);

    if (isChecked) {
      for (const id of ids) next.delete(id);
      for (const ancestorId of collectAncestorIds(byId, node.id)) next.delete(ancestorId);
    } else {
      for (const id of ids) next.add(id);
    }

    const ancestorIds = collectAncestorIds(byId, node.id);
    for (const ancestorId of ancestorIds) {
      const ancestor = byId.get(ancestorId);
      if (!ancestor) continue;
      const allChildrenFull = ancestor.children.every((c) => isNodeFullyCheckedScope(c, next));
      if (allChildrenFull) next.add(ancestor.id);
      else next.delete(ancestor.id);
    }

    props.onChange(toCoverSet({ checked: next, byId }));
  }

  function renderNode(node: DepartmentNode, depth: number) {
    const fully = selectionMode === "exact" ? checked.has(node.id) : isNodeFullyCheckedScope(node, checked);
    const indeterminate = selectionMode === "exact" ? computeIndeterminateExact(node, checked) : computeIndeterminateScope(node, checked);
    const checkboxState: boolean | "indeterminate" = fully ? true : indeterminate ? "indeterminate" : false;

    return (
      <div key={node.id}>
        <div
          onClick={() => toggle(node)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground",
            props.disabled ? "cursor-not-allowed opacity-60" : null,
          )}
          style={{ paddingLeft: depth * 14 + 8 }}
        >
          <Checkbox
            checked={checkboxState}
            onCheckedChange={() => toggle(node)}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
          <span className="truncate text-sm">{node.name}</span>
        </div>
        {node.children.length > 0 ? <div className="space-y-0.5">{node.children.map((c) => renderNode(c, depth + 1))}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-background", props.className)}>
      <ScrollArea className={cn("w-full", props.maxHeight ? undefined : "max-h-80")} style={props.maxHeight ? { height: props.maxHeight } : undefined}>
        <div className="space-y-0.5 p-2">
          {roots.length === 0 ? <div className="p-2 text-sm text-muted-foreground">暂无部门</div> : null}
          {roots.map((n) => renderNode(n, 0))}
        </div>
      </ScrollArea>
    </div>
  );
}
