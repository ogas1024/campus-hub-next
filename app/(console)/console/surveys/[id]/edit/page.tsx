import { hasPerm, requirePerm } from "@/lib/auth/permissions";

import EditSurveyClient from "./EditSurveyClient";

type Params = { params: Promise<{ id: string }> };

export default async function ConsoleSurveyEditPage({ params }: Params) {
  const user = await requirePerm("campus:survey:read");
  const { id } = await params;

  const [canUpdate, canPublish, canClose] = await Promise.all([
    hasPerm(user.id, "campus:survey:update"),
    hasPerm(user.id, "campus:survey:publish"),
    hasPerm(user.id, "campus:survey:close"),
  ]);

  return <EditSurveyClient surveyId={id} perms={{ canUpdate, canPublish, canClose }} />;
}

