import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { getCurrentUser } from "@/lib/auth/session";
import { listPortalMajors } from "@/lib/modules/course-resources/courseResources.service";

export default async function ResourcesMajorsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const majors = await listPortalMajors();

  return (
    <div className="space-y-6">
      <PageHeader
        title="课程资源"
        description="按“专业 → 课程 → 资源”逐级浏览；资源下载会自动计数。"
        actions={
          <>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources/me">
              我的投稿
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/resources/leaderboard">
              榜单
            </Link>
          </>
        }
      />

      {majors.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">暂无可用专业（请联系管理员在管理端创建并启用）。</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {majors.map((m) => (
            <Link
              key={m.id}
              href={`/resources/majors/${m.id}`}
              className="rounded-xl border border-border bg-card p-4 transition-colors duration-[var(--motion-duration-hover)] ease-[var(--motion-ease-standard)] hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <div className="text-base font-semibold">{m.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">点击进入课程列表</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
