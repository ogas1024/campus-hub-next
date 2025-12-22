export type ScopeType = "role" | "department" | "position";

export type ScopeInput = { scopeType: ScopeType; refId: string };

export type ScopeOption = { id: string; name: string; parentId?: string | null; code?: string };

export type ScopeOptionsResponse = {
  roles: ScopeOption[];
  departments: ScopeOption[];
  positions: ScopeOption[];
};

