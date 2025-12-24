import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export default async function SurveyDetailPage({ params }: Params) {
  const { id } = await params;
  redirect(`/surveys?dialog=survey-fill&id=${encodeURIComponent(id)}`);
}
