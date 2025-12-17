import { apiGetJson, apiPutJson } from "@/lib/api/http";

export type ScopeType = "ALL" | "CUSTOM" | "DEPT" | "DEPT_AND_CHILD" | "SELF" | "NONE";

export type RoleDataScopeItem = {
  module: string;
  scopeType: ScopeType;
  departmentIds: string[];
};

export type RoleDataScopesResponse = {
  roleId: string;
  items: RoleDataScopeItem[];
};

export function fetchRoleDataScopes(roleId: string) {
  return apiGetJson<RoleDataScopesResponse>(`/api/console/roles/${roleId}/data-scopes`);
}

export function setRoleDataScopes(roleId: string, body: { items: Array<{ module: string; scopeType: ScopeType; departmentIds?: string[] }>; reason?: string }) {
  return apiPutJson<RoleDataScopesResponse>(`/api/console/roles/${roleId}/data-scopes`, body);
}

