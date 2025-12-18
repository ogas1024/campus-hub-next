export type DbScopeType = "all" | "custom" | "dept" | "dept_and_child" | "self" | "none";

export type ResolvedDataScope =
  | { scopeType: "ALL" }
  | { scopeType: "NONE" }
  | { scopeType: "SELF" }
  | { scopeType: "DEPT"; departmentIds: string[] }
  | { scopeType: "DEPT_AND_CHILD"; departmentIds: string[] }
  | { scopeType: "CUSTOM"; departmentIds: string[] };

export async function mergeConfiguredDataScope(params: {
  scopeTypes: DbScopeType[];
  customDepartmentIds: string[];
  userDepartmentIds: string[];
  expandToDescendants: (deptIds: string[]) => Promise<string[]>;
}): Promise<ResolvedDataScope> {
  if (params.scopeTypes.includes("all")) return { scopeType: "ALL" };

  if (params.scopeTypes.includes("custom")) {
    const expanded = await params.expandToDescendants(params.customDepartmentIds);
    return expanded.length === 0 ? { scopeType: "NONE" } : { scopeType: "CUSTOM", departmentIds: expanded };
  }

  if (params.scopeTypes.includes("dept_and_child")) {
    const expanded = await params.expandToDescendants(params.userDepartmentIds);
    return expanded.length === 0 ? { scopeType: "NONE" } : { scopeType: "DEPT_AND_CHILD", departmentIds: expanded };
  }

  if (params.scopeTypes.includes("dept")) {
    return params.userDepartmentIds.length === 0
      ? { scopeType: "NONE" }
      : { scopeType: "DEPT", departmentIds: params.userDepartmentIds };
  }

  if (params.scopeTypes.includes("self")) return { scopeType: "SELF" };
  return { scopeType: "NONE" };
}

