import { apiGetJson, apiPostJson, apiPutJson } from "@/lib/api/http";
import type { ScopeType, VoteQuestion, VoteScopeInput, VoteStatus } from "@/lib/api/votes";
import type { VoteResults } from "@/lib/modules/votes/votes.analytics";
import type { ScopeOptionsResponse } from "@/lib/api/visibility-scope";

export type VoteScopeOptionsResponse = ScopeOptionsResponse;

export type ConsoleVoteListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    title: string;
    status: VoteStatus;
    effectiveStatus: VoteStatus;
    startAt: string;
    endAt: string;
    anonymousResponses: boolean;
    visibleAll: boolean;
    pinned: boolean;
    archivedAt: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type ConsoleVoteDetail = {
  id: string;
  title: string;
  descriptionMd: string;
  status: VoteStatus;
  effectiveStatus: VoteStatus;
  startAt: string;
  endAt: string;
  anonymousResponses: boolean;
  visibleAll: boolean;
  pinned: boolean;
  pinnedAt: string | null;
  archivedAt: string | null;
  scopes: VoteScopeInput[];
  questions: VoteQuestion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export function fetchVoteScopeOptions() {
  return apiGetJson<VoteScopeOptionsResponse>("/api/console/votes/scope-options");
}

export function fetchConsoleVotes(params: {
  page: number;
  pageSize: number;
  q?: string;
  status?: "draft" | "published" | "closed";
  mine?: boolean;
  archived?: boolean;
}) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.mine) sp.set("mine", "true");
  if (params.archived) sp.set("archived", "true");
  return apiGetJson<ConsoleVoteListResponse>(`/api/console/votes?${sp.toString()}`);
}

export function createConsoleVote(body: {
  title: string;
  descriptionMd?: string;
  startAt: string;
  endAt: string;
  anonymousResponses: boolean;
  visibleAll: boolean;
  scopes: Array<{ scopeType: ScopeType; refId: string }>;
}) {
  return apiPostJson<{ id: string }>("/api/console/votes", body);
}

export function fetchConsoleVoteDetail(voteId: string) {
  return apiGetJson<ConsoleVoteDetail>(`/api/console/votes/${voteId}`);
}

export function updateConsoleVoteDraft(voteId: string, body: {
  title: string;
  descriptionMd?: string;
  startAt: string;
  endAt: string;
  anonymousResponses: boolean;
  visibleAll: boolean;
  scopes: Array<{ scopeType: ScopeType; refId: string }>;
  questions: Array<{
    id: string;
    questionType: "single" | "multi";
    title: string;
    description?: string | null;
    required: boolean;
    sort: number;
    maxChoices: number;
    options: Array<{ id: string; label: string; sort: number }>;
  }>;
}) {
  return apiPutJson<ConsoleVoteDetail>(`/api/console/votes/${voteId}`, body);
}

export function publishConsoleVote(voteId: string) {
  return apiPostJson<ConsoleVoteDetail>(`/api/console/votes/${voteId}/publish`);
}

export function closeConsoleVote(voteId: string) {
  return apiPostJson<ConsoleVoteDetail>(`/api/console/votes/${voteId}/close`);
}

export function extendConsoleVote(voteId: string, body: { endAt: string }) {
  return apiPostJson<ConsoleVoteDetail>(`/api/console/votes/${voteId}/extend`, body);
}

export function pinConsoleVote(voteId: string, body: { pinned: boolean }) {
  return apiPostJson<ConsoleVoteDetail>(`/api/console/votes/${voteId}/pin`, body);
}

export function archiveConsoleVote(voteId: string) {
  return apiPostJson<ConsoleVoteDetail>(`/api/console/votes/${voteId}/archive`);
}

export function fetchConsoleVoteResults(voteId: string) {
  return apiGetJson<{
    vote: {
      id: string;
      title: string;
      status: VoteStatus;
      startAt: string;
      endAt: string;
      anonymousResponses: boolean;
      visibleAll: boolean;
      pinned: boolean;
      archivedAt: string | null;
    };
    questions: VoteQuestion[];
    results: VoteResults;
  }>(`/api/console/votes/${voteId}/results`);
}
