export type DepartmentItem = {
  id: string;
  name: string;
  parentId: string | null;
  sort: number;
};

export type DepartmentNode = DepartmentItem & {
  children: DepartmentNode[];
};

function sortNodes(nodes: DepartmentNode[]) {
  nodes.sort((a, b) => {
    if (a.sort !== b.sort) return a.sort - b.sort;
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
  for (const n of nodes) sortNodes(n.children);
}

export function buildDepartmentTree(items: DepartmentItem[]) {
  const byId = new Map<string, DepartmentNode>();
  for (const item of items) byId.set(item.id, { ...item, children: [] });

  const roots: DepartmentNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortNodes(roots);
  return { roots, byId };
}

export function collectDescendantIds(root: DepartmentNode) {
  const ids: string[] = [];
  const stack: DepartmentNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    ids.push(node.id);
    for (const child of node.children) stack.push(child);
  }
  return ids;
}

export function collectAncestorIds(byId: Map<string, DepartmentNode>, startId: string) {
  const ids: string[] = [];
  let current = byId.get(startId);
  while (current?.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    ids.push(parent.id);
    current = parent;
  }
  return ids;
}

