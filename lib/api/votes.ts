import { apiGetJson, apiPostJson } from "@/lib/api/http";
import type { ScopeInput } from "@/lib/api/visibility-scope";
import type { VoteResults } from "@/lib/modules/votes/votes.analytics";

export type VoteStatus = "draft" | "published" | "closed";
export type VoteQuestionType = "single" | "multi";
export type { ScopeType } from "@/lib/api/visibility-scope";

export type VoteScopeInput = ScopeInput;

export type VoteOption = { id: string; label: string; sort: number };

export type VoteQuestion = {
  id: string;
  questionType: VoteQuestionType;
  title: string;
  description: string | null;
  required: boolean;
  sort: number;
  maxChoices: number;
  options: VoteOption[];
};

export type VoteAnswerValue = { optionId: string } | { optionIds: string[] };

export type PortalVoteDetail = {
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
  archivedAt: string | null;
  canSubmit: boolean;
  questions: VoteQuestion[];
  myResponse: null | { submittedAt: string; items: Array<{ questionId: string; value: VoteAnswerValue }> };
  results: VoteResults | null;
};

export type PortalVoteListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    title: string;
    status: "published" | "closed";
    effectiveStatus: "published" | "closed";
    startAt: string;
    endAt: string;
    anonymousResponses: boolean;
    pinned: boolean;
    phase: "upcoming" | "active" | "closed";
    submittedAt: string | null;
    updatedAt: string;
  }>;
};

export type MyVoteListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    title: string;
    status: "published" | "closed";
    effectiveStatus: "published" | "closed";
    startAt: string;
    endAt: string;
    anonymousResponses: boolean;
    pinned: boolean;
    archivedAt: string | null;
    phase: "upcoming" | "active" | "closed";
    submittedAt: string | null;
    updatedAt: string;
  }>;
};

export function fetchPortalVotes(params: { page: number; pageSize: number; q?: string }) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  return apiGetJson<PortalVoteListResponse>(`/api/votes?${sp.toString()}`);
}

export function fetchMyVotes(params: { page: number; pageSize: number; q?: string }) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  return apiGetJson<MyVoteListResponse>(`/api/votes/my?${sp.toString()}`);
}

export function fetchPortalVoteDetail(voteId: string) {
  return apiGetJson<PortalVoteDetail>(`/api/votes/${voteId}`);
}

export function submitVoteResponse(voteId: string, body: { items: Array<{ questionId: string; value: VoteAnswerValue }> }) {
  return apiPostJson<{ ok: true; responseId: string; submittedAt: string }>(`/api/votes/${voteId}/responses`, body);
}
