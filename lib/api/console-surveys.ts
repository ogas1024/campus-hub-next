import { apiDeleteJson, apiGetJson, apiPostJson, apiPutJson } from "@/lib/api/http";
import type { ScopeType, SurveyScopeInput, SurveySection, SurveyStatus } from "@/lib/api/surveys";
import type { SurveyResults } from "@/lib/modules/surveys/surveys.analytics";

export type SurveyScopeOptionsResponse = {
  roles: Array<{ id: string; name: string; code?: string }>;
  departments: Array<{ id: string; name: string; parentId?: string | null }>;
  positions: Array<{ id: string; name: string }>;
};

export type ConsoleSurveyListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    title: string;
    status: SurveyStatus;
    effectiveStatus: SurveyStatus;
    startAt: string;
    endAt: string;
    anonymousResponses: boolean;
    visibleAll: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type ConsoleSurveyDetail = {
  id: string;
  title: string;
  descriptionMd: string;
  status: SurveyStatus;
  effectiveStatus: SurveyStatus;
  startAt: string;
  endAt: string;
  anonymousResponses: boolean;
  visibleAll: boolean;
  scopes: SurveyScopeInput[];
  sections: SurveySection[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export function fetchSurveyScopeOptions() {
  return apiGetJson<SurveyScopeOptionsResponse>("/api/console/surveys/scope-options");
}

export function fetchConsoleSurveys(params: {
  page: number;
  pageSize: number;
  q?: string;
  status?: "draft" | "published" | "closed";
  mine?: boolean;
}) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.mine) sp.set("mine", "true");
  return apiGetJson<ConsoleSurveyListResponse>(`/api/console/surveys?${sp.toString()}`);
}

export function createConsoleSurvey(body: {
  title: string;
  descriptionMd?: string;
  startAt: string;
  endAt: string;
  anonymousResponses: boolean;
  visibleAll: boolean;
  scopes: Array<{ scopeType: ScopeType; refId: string }>;
}) {
  return apiPostJson<{ id: string }>("/api/console/surveys", body);
}

export function fetchConsoleSurveyDetail(surveyId: string) {
  return apiGetJson<ConsoleSurveyDetail>(`/api/console/surveys/${surveyId}`);
}

export function updateConsoleSurveyDraft(surveyId: string, body: {
  title: string;
  descriptionMd?: string;
  startAt: string;
  endAt: string;
  anonymousResponses: boolean;
  visibleAll: boolean;
  scopes: Array<{ scopeType: ScopeType; refId: string }>;
  sections: Array<{
    id: string;
    title: string;
    sort: number;
    questions: Array<{
      id: string;
      sectionId: string;
      questionType: "text" | "single" | "multi" | "rating";
      title: string;
      description?: string | null;
      required: boolean;
      sort: number;
      options?: Array<{ id: string; label: string; sort: number }>;
    }>;
  }>;
}) {
  return apiPutJson<ConsoleSurveyDetail>(`/api/console/surveys/${surveyId}`, body);
}

export function publishConsoleSurvey(surveyId: string) {
  return apiPostJson<ConsoleSurveyDetail>(`/api/console/surveys/${surveyId}/publish`);
}

export function closeConsoleSurvey(surveyId: string) {
  return apiPostJson<ConsoleSurveyDetail>(`/api/console/surveys/${surveyId}/close`);
}

export function deleteConsoleSurvey(surveyId: string) {
  return apiDeleteJson<{ ok: true }>(`/api/console/surveys/${surveyId}`);
}

export function fetchConsoleSurveyResults(surveyId: string) {
  return apiGetJson<{
    survey: {
      id: string;
      title: string;
      status: SurveyStatus;
      startAt: string;
      endAt: string;
      anonymousResponses: boolean;
      visibleAll: boolean;
    };
    sections: SurveySection[];
    results: SurveyResults;
  }>(`/api/console/surveys/${surveyId}/results`);
}

export function fetchConsoleSurveyAiSummary(surveyId: string) {
  return apiPostJson<{ markdown: string }>(`/api/console/surveys/${surveyId}/ai-summary`);
}

export function buildConsoleSurveyExportUrl(surveyId: string) {
  return `/api/console/surveys/${surveyId}/export`;
}
