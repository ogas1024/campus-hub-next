import { redirect } from "next/navigation";

type Params = { params: Promise<{ majorId: string; courseId: string }> };

export default async function ShareCourseResourceRedirectPage({ params }: Params) {
  const { majorId, courseId } = await params;
  redirect(`/resources/majors/${encodeURIComponent(majorId)}/courses/${encodeURIComponent(courseId)}?dialog=resource-create`);
}
