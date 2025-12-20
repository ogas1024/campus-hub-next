import { apiGetJson, apiPostJson } from "@/lib/api/http";

export type SurveyStatus = "draft" | "published" | "closed";
export type SurveyQuestionType = "text" | "single" | "multi" | "rating";
export type ScopeType = "role" | "department" | "position";

export type SurveyScopeInput = { scopeType: ScopeType; refId: string };

export type SurveyOption = { id: string; label: string; sort: number };

export type SurveyQuestion = {
  id: string;
  sectionId: string;
  questionType: SurveyQuestionType;
  title: string;
  description: string | null;
  required: boolean;
  sort: number;
  options: SurveyOption[];
};

export type SurveySection = {
  id: string;
  title: string;
  sort: number;
  questions: SurveyQuestion[];
};

export type SurveyAnswerValue =
  | { text: string }
  | { optionId: string }
  | { optionIds: string[] }
  | { value: number };

export type PortalSurveyDetail = {
  id: string;
  title: string;
  descriptionMd: string;
  status: SurveyStatus;
  effectiveStatus: SurveyStatus;
  startAt: string;
  endAt: string;
  anonymousResponses: boolean;
  visibleAll: boolean;
  canSubmit: boolean;
  sections: SurveySection[];
  myResponse: null | { submittedAt: string; items: Array<{ questionId: string; value: SurveyAnswerValue }> };
};

export type PortalSurveyListResponse = {
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
    phase: "upcoming" | "active" | "closed";
    submittedAt: string | null;
    updatedAt: string;
  }>;
};

export function fetchPortalSurveys(params: { page: number; pageSize: number; q?: string }) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  return apiGetJson<PortalSurveyListResponse>(`/api/surveys?${sp.toString()}`);
}

export function fetchPortalSurveyDetail(surveyId: string) {
  return apiGetJson<PortalSurveyDetail>(`/api/surveys/${surveyId}`);
}

export function submitSurveyResponse(surveyId: string, body: { items: Array<{ questionId: string; value: SurveyAnswerValue }> }) {
  return apiPostJson<{ ok: true; responseId: string; submittedAt: string }>(`/api/surveys/${surveyId}/responses`, body);
}

