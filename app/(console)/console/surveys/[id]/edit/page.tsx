import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export default async function ConsoleSurveyEditPage({ params }: Params) {
  const { id } = await params;
  redirect(`/console/surveys?dialog=survey-edit&id=${encodeURIComponent(id)}`);
}
