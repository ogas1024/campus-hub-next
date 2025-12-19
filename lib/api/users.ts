import { apiGetJson } from "@/lib/api/http";

export type UserSearchItem = { id: string; name: string; studentId: string };

export function searchUsers(params: { q: string; limit?: number }) {
  const sp = new URLSearchParams();
  sp.set("q", params.q);
  if (params.limit) sp.set("limit", String(params.limit));
  return apiGetJson<{ items: UserSearchItem[] }>(`/api/users/search?${sp.toString()}`);
}

