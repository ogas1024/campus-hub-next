import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { listPortalCourses, listPortalMajors } from "@/lib/modules/course-resources/courseResources.service";

export default async function ResourceCoursesPage({ params }: { params: Promise<{ majorId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { majorId } = await params;

  const majors = await listPortalMajors();
  const major = majors.find((m) => m.id === majorId);
  if (!major) notFound();

  const courses = await listPortalCourses({ userId: user.id, majorId });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link className="hover:text-foreground" href="/resources">
            专业
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{major.name}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{major.name}</h1>
            <p className="text-sm text-muted-foreground">选择课程进入资源列表。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources/me">
              我的投稿
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources/leaderboard">
              榜单
            </Link>
          </div>
        </div>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">该专业暂无课程（请联系管理员维护课程字典）。</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/resources/majors/${majorId}/courses/${c.id}`}
              className="rounded-xl border border-border bg-card p-5 hover:bg-accent"
            >
              <div className="text-base font-semibold">{c.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">点击查看已发布资源</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

