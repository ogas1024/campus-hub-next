import { redirect } from "next/navigation";

export default function NewSurveyPage() {
  redirect("/console/surveys?dialog=survey-create");
}
