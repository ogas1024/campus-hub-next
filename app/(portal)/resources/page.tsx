import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { listPortalMajors } from "@/lib/modules/course-resources/courseResources.service";

export default async function ResourcesMajorsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const majors = await listPortalMajors();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">课程资源</h1>
          <p className="text-sm text-muted-foreground">按“专业 → 课程 → 资源”逐级浏览；资源下载会自动计数。</p>
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
              className="rounded-xl border border-border bg-card p-5 hover:bg-accent"
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

