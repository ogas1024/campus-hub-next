import { hasPerm, requirePerm } from "@/lib/auth/permissions";

import SurveyResultsClient from "./SurveyResultsClient";

type Params = { params: Promise<{ id: string }> };

export default async function ConsoleSurveyResultsPage({ params }: Params) {
  const user = await requirePerm("campus:survey:read");
  const { id } = await params;

  const [canUpdate, canExport, canAiSummary] = await Promise.all([
    hasPerm(user.id, "campus:survey:update"),
    hasPerm(user.id, "campus:survey:export"),
    hasPerm(user.id, "campus:survey:ai_summary"),
  ]);

  return <SurveyResultsClient surveyId={id} perms={{ canUpdate, canExport, canAiSummary }} />;
}

