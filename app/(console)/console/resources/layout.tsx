import Link from "next/link";

import { ConsoleModuleTabs } from "@/components/console/ConsoleModuleTabs";
import { buttonVariants } from "@/components/ui/button";
import { hasPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ConsoleResourcesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [canReview, canList, canMajorList, canCourseList, canLeadUpdate] = await Promise.all([
    hasPerm(user.id, "campus:resource:review"),
    hasPerm(user.id, "campus:resource:list"),
    hasPerm(user.id, "campus:resource:major_list"),
    hasPerm(user.id, "campus:resource:course_list"),
    hasPerm(user.id, "campus:resource:major_lead_update"),
  ]);

  const tabs = [
    canReview ? { id: "pending", label: "待审核", href: "/console/resources/pending" } : null,
    canList ? { id: "published", label: "已发布", href: "/console/resources/published" } : null,
    canList ? { id: "rejected", label: "已驳回", href: "/console/resources/rejected" } : null,
    canList ? { id: "unpublished", label: "已下架", href: "/console/resources/unpublished" } : null,
    canMajorList ? { id: "majors", label: "专业", href: "/console/resources/majors" } : null,
    canCourseList ? { id: "courses", label: "课程", href: "/console/resources/courses" } : null,
    canLeadUpdate ? { id: "leads", label: "专业负责人", href: "/console/resources/leads" } : null,
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">课程资源分享</div>
            <div className="text-sm text-muted-foreground">按权限展示子功能；数据范围由后端强制（major_lead 仅本专业）。</div>
          </div>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/workbench">
            返回工作台
          </Link>
        </div>

        <ConsoleModuleTabs ariaLabel="课程资源分享 子导航" tabs={tabs} />
      </div>

      {children}
    </div>
  );
}

