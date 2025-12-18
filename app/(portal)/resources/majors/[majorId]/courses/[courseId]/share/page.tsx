import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PortalShareResourceForm } from "@/components/course-resources/PortalShareResourceForm";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { listPortalCourses, listPortalMajors } from "@/lib/modules/course-resources/courseResources.service";

export default async function ShareCourseResourcePage({ params }: { params: Promise<{ majorId: string; courseId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { majorId, courseId } = await params;

  const majors = await listPortalMajors();
  const major = majors.find((m) => m.id === majorId);
  if (!major) notFound();

  const courses = await listPortalCourses({ userId: user.id, majorId });
  const course = courses.find((c) => c.id === courseId);
  if (!course) notFound();

  const returnHref = `/resources/majors/${majorId}/courses/${courseId}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link className="hover:text-foreground" href="/resources">
            专业
          </Link>
          <span aria-hidden>/</span>
          <Link className="hover:text-foreground" href={`/resources/majors/${majorId}`}>
            {major.name}
          </Link>
          <span aria-hidden>/</span>
          <Link className="hover:text-foreground" href={returnHref}>
            {course.name}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">分享资源</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">分享资源</h1>
            <p className="text-sm text-muted-foreground">在此页面完成上传/外链填写并提交审核（创建即 draft，提交后进入 pending）。</p>
          </div>
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href={returnHref}>
            ← 返回课程
          </Link>
        </div>
      </div>

      <PortalShareResourceForm mode="fixed" major={{ id: major.id, name: major.name }} course={{ id: course.id, name: course.name }} returnHref={returnHref} />
    </div>
  );
}

