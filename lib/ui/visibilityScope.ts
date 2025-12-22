import type { ScopeInput, ScopeType } from "@/lib/api/visibility-scope";

export type SelectedScopes = Record<ScopeType, Set<string>>;

export function createEmptySelectedScopes(): SelectedScopes {
  return {
    role: new Set(),
    department: new Set(),
    position: new Set(),
  };
}

export function selectedScopesFromInputs(scopes: ScopeInput[] | null | undefined): SelectedScopes {
  const selected = createEmptySelectedScopes();
  if (!scopes) return selected;
  for (const s of scopes) {
    selected[s.scopeType].add(s.refId);
  }
  return selected;
}

export function selectedScopesToInputs(selected: SelectedScopes): ScopeInput[] {
  const items: ScopeInput[] = [];
  for (const refId of selected.role) items.push({ scopeType: "role", refId });
  for (const refId of selected.department) items.push({ scopeType: "department", refId });
  for (const refId of selected.position) items.push({ scopeType: "position", refId });
  return items;
}

